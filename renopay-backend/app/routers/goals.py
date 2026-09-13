import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.money import rupees_to_paise, paise_to_rupees, generate_txn_ref
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.savings import SavingsGoal
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.schemas.features import CreateGoalRequest, AddSavingsRequest, SavingsGoalOut
from app.services.payment_engine import new_txn_group_id
from app.services.pin_auth import verify_user_pin, PinError
from app.ws.manager import manager as ws_manager

router = APIRouter()


@router.get("/", response_model=list[SavingsGoalOut])
async def list_goals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavingsGoal).where(SavingsGoal.user_id == user.id))
    return [SavingsGoalOut.from_model(g) for g in result.scalars().all()]


@router.post("/", response_model=SavingsGoalOut)
async def create_goal(
    payload: CreateGoalRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    target_paise = rupees_to_paise(payload.target)
    milestones = [round(target_paise * f) for f in (0.25, 0.5, 0.75, 1.0)]
    goal = SavingsGoal(
        user_id=user.id, name=payload.name, icon=payload.icon,
        target_paise=target_paise, milestones_paise=milestones,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return SavingsGoalOut.from_model(goal)


@router.post("/{goal_id}/add", response_model=SavingsGoalOut)
async def add_to_goal(
    goal_id: uuid.UUID, payload: AddSavingsRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account), db: AsyncSession = Depends(get_db),
):
    # This debits a real balance, so it gets the same PIN check as any
    # other money movement — checked BEFORE locking rows, same reasoning
    # as the payment engine (fail fast and cheap on a wrong PIN).
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    # Lock the account row first — this debit must be atomic with the
    # balance check, same discipline as the main payment engine.
    acc_result = await db.execute(select(Account).where(Account.id == account.id).with_for_update())
    locked_account = acc_result.scalar_one()

    goal_result = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id).with_for_update())
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")

    amount_paise = rupees_to_paise(payload.amount)
    if locked_account.current_balance_paise < amount_paise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Insufficient balance")

    locked_account.current_balance_paise -= amount_paise
    goal.saved_paise += amount_paise

    db.add(Transaction(
        txn_group_id=new_txn_group_id(), txn_ref=generate_txn_ref(), account_id=locked_account.id,
        counterparty_vpa="savings@vault", type=TxnType.DEBIT, status=TxnStatus.SUCCESS,
        category=TxnCategory.OTHER, amount_paise=amount_paise, description=f"Savings: {goal.name}",
        trust_score=99,
    ))
    await db.commit()
    await db.refresh(goal)
    await db.refresh(locked_account)

    await ws_manager.push(locked_account.user_id, "balance_update", {
        "balance": paise_to_rupees(locked_account.current_balance_paise), "reason": "savings_contribution",
    })
    return SavingsGoalOut.from_model(goal)


class AutoSaveRequest(BaseModel):
    enabled: bool
    daily_amount: float = Field(ge=0)



@router.patch("/{goal_id}/auto-save", response_model=SavingsGoalOut)
async def toggle_auto_save(
    goal_id: uuid.UUID,
    payload: AutoSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    goal.auto_save_enabled = payload.enabled
    goal.auto_save_paise = rupees_to_paise(payload.daily_amount)
    await db.commit()
    await db.refresh(goal)
    return SavingsGoalOut.from_model(goal)


class WithdrawSavingsRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=6)
    amount: float | None = None


@router.post("/{goal_id}/withdraw", response_model=SavingsGoalOut)
async def withdraw_from_goal(
    goal_id: uuid.UUID,
    payload: WithdrawSavingsRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    acc_result = await db.execute(select(Account).where(Account.id == account.id).with_for_update())
    locked_account = acc_result.scalar_one()

    goal_result = await db.execute(
        select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id).with_for_update()
    )
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")

    if goal.saved_paise <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No savings available to withdraw")

    if payload.amount is not None and payload.amount > 0:
        amount_paise = rupees_to_paise(payload.amount)
        if goal.saved_paise < amount_paise:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Withdrawal amount exceeds saved balance")
    else:
        amount_paise = goal.saved_paise

    goal.saved_paise -= amount_paise
    locked_account.current_balance_paise += amount_paise

    db.add(Transaction(
        txn_group_id=new_txn_group_id(),
        txn_ref=generate_txn_ref(),
        account_id=locked_account.id,
        counterparty_vpa="savings@vault",
        type=TxnType.CREDIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.OTHER,
        amount_paise=amount_paise,
        description=f"Savings Withdrawn: {goal.name}",
        trust_score=99,
    ))
    await db.commit()
    await db.refresh(goal)
    await db.refresh(locked_account)

    await ws_manager.push(locked_account.user_id, "balance_update", {
        "balance": paise_to_rupees(locked_account.current_balance_paise),
        "reason": "savings_withdrawal",
    })
    return SavingsGoalOut.from_model(goal)

