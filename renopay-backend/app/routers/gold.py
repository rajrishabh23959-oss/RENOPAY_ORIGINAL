"""
Digital Gold endpoints.

GET  /gold/summary   — returns pot balance, progress, ledger history
POST /gold/toggle-roundup — enable/disable the round-up feature
POST /gold/withdraw — withdraw gold vault back to account balance
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.money import paise_to_rupees, rupees_to_paise, generate_txn_ref
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.gold import UserGoldPot
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.services.gold_service import get_gold_summary
from app.services.payment_engine import new_txn_group_id
from app.services.pin_auth import verify_user_pin, PinError
from app.ws.manager import manager as ws_manager

router = APIRouter()


@router.get("/summary")
async def gold_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_gold_summary(db, user.id)


@router.patch("/toggle-roundup")
async def toggle_roundup(
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    account.round_up_enabled = not account.round_up_enabled
    await db.commit()
    await db.refresh(account)
    return {"round_up_enabled": account.round_up_enabled}


class WithdrawGoldRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=6)
    amount: float | None = None


@router.post("/withdraw")
async def withdraw_gold(
    payload: WithdrawGoldRequest,
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

    if locked_account.digital_gold_paise <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No digital gold vault balance to withdraw")

    if payload.amount is not None and payload.amount > 0:
        amount_paise = rupees_to_paise(payload.amount)
        if locked_account.digital_gold_paise < amount_paise:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Withdrawal amount exceeds gold vault balance")
    else:
        amount_paise = locked_account.digital_gold_paise

    locked_account.digital_gold_paise -= amount_paise
    locked_account.current_balance_paise += amount_paise

    # Also reset pot balance if present
    pot_result = await db.execute(select(UserGoldPot).where(UserGoldPot.user_id == user.id))
    pot = pot_result.scalar_one_or_none()
    if pot:
        pot.balance_paise = max(0, pot.balance_paise - amount_paise)

    db.add(Transaction(
        txn_group_id=new_txn_group_id(),
        txn_ref=generate_txn_ref(),
        account_id=locked_account.id,
        counterparty_vpa="gold@vault",
        type=TxnType.CREDIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.OTHER,
        amount_paise=amount_paise,
        description="Digital Gold Vault Withdrawn",
        trust_score=99,
    ))
    await db.commit()
    await db.refresh(locked_account)

    await ws_manager.push(locked_account.user_id, "balance_update", {
        "balance": paise_to_rupees(locked_account.current_balance_paise),
        "reason": "gold_withdrawal",
    })
    return {
        "success": True,
        "withdrawn_amount": paise_to_rupees(amount_paise),
        "new_balance": paise_to_rupees(locked_account.current_balance_paise),
        "new_digital_gold": paise_to_rupees(locked_account.digital_gold_paise),
    }

