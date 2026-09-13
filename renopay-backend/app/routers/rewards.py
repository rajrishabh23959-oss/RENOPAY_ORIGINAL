import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.money import paise_to_rupees
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.reward import ScratchCard, RewardType
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.schemas.features import (
    ScratchCardOut,
    ScratchResultOut,
    RewardSummaryOut,
    WithdrawRewardRequest,
    WithdrawRewardOut,
)
from app.services.pin_auth import verify_user_pin, PinError
from app.services.payment_engine import _lock_account, new_txn_group_id
from app.core.money import generate_txn_ref
from app.services.denomination_service import add_denominations
from app.services import accounting_engine
from app.ws.manager import manager as ws_manager

router = APIRouter()


@router.get("/scratch-cards", response_model=list[ScratchCardOut])
async def list_cards(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScratchCard).where(ScratchCard.user_id == user.id).order_by(ScratchCard.created_at.desc())
    )
    return [ScratchCardOut.from_model(c) for c in result.scalars().all()]


@router.get("/summary", response_model=RewardSummaryOut)
async def get_reward_summary(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScratchCard).where(ScratchCard.user_id == user.id).order_by(ScratchCard.created_at.desc())
    )
    cards = result.scalars().all()

    total_received_paise = sum(c.reward_amount_paise for c in cards if c.scratched)
    available_balance_paise = sum(
        c.reward_amount_paise
        for c in cards
        if c.scratched and not getattr(c, "is_withdrawn", False) and c.reward_type == RewardType.CASHBACK
    )
    withdrawn_total_paise = sum(
        c.reward_amount_paise
        for c in cards
        if c.scratched and getattr(c, "is_withdrawn", False) and c.reward_type == RewardType.CASHBACK
    )
    unscratched_count = sum(1 for c in cards if not c.scratched)

    return RewardSummaryOut(
        total_received=paise_to_rupees(total_received_paise),
        available_balance=paise_to_rupees(available_balance_paise),
        withdrawn_total=paise_to_rupees(withdrawn_total_paise),
        unscratched_count=unscratched_count,
        cards=[ScratchCardOut.from_model(c) for c in cards],
    )


@router.post("/scratch-cards/{card_id}/scratch", response_model=ScratchResultOut)
async def scratch_card(
    card_id: uuid.UUID,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScratchCard).where(ScratchCard.id == card_id, ScratchCard.user_id == user.id).with_for_update()
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scratch card not found")
    if card.scratched:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Card already scratched")
    if card.expires_at:
        expires_at = card.expires_at.replace(tzinfo=timezone.utc) if card.expires_at.tzinfo is None else card.expires_at
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Scratch card has expired")

    card.scratched = True
    card.is_withdrawn = False

    # Note: Cashback rewards are unlocked into Available Rewards,
    # and can be withdrawn directly to the user's main bank balance via PIN at any time.
    # Digital Gold rewards are credited directly to digital gold holdings.
    if card.reward_type == RewardType.GOLD:
        account.digital_gold_paise += card.reward_amount_paise

    await db.commit()
    await db.refresh(account)

    return ScratchResultOut(
        success=True,
        reward_type=card.reward_type.value if hasattr(card.reward_type, "value") else card.reward_type,
        reward_amount=paise_to_rupees(card.reward_amount_paise),
        new_balance=paise_to_rupees(account.current_balance_paise),
        new_digital_gold=paise_to_rupees(account.digital_gold_paise),
    )


@router.post("/withdraw", response_model=WithdrawRewardOut)
async def withdraw_rewards(
    payload: WithdrawRewardRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify user's UPI PIN
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, e.message)

    # 2. Lock user's account for update
    locked_account = await _lock_account(db, account.id)

    # 3. Find all scratched, unwithdrawn cashback cards
    result = await db.execute(
        select(ScratchCard)
        .where(
            ScratchCard.user_id == user.id,
            ScratchCard.scratched == True,
            ScratchCard.is_withdrawn == False,
            ScratchCard.reward_type == RewardType.CASHBACK,
        )
        .with_for_update()
    )
    cards_to_withdraw = result.scalars().all()
    if not cards_to_withdraw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No reward balance available to withdraw")

    withdraw_paise = sum(c.reward_amount_paise for c in cards_to_withdraw)
    if withdraw_paise <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No reward funds to withdraw")

    # 4. Mark all cards as withdrawn
    for card in cards_to_withdraw:
        card.is_withdrawn = True

    # 5. Add funds to user's main bank balance and cash denominations
    orig_bal = locked_account.current_balance_paise
    locked_account.current_balance_paise += withdraw_paise
    locked_account.cash_denominations = add_denominations(
        locked_account.cash_denominations, int(paise_to_rupees(withdraw_paise)), orig_bal
    )

    # 6. Record transaction
    txn_group_id = new_txn_group_id()
    txn_ref = generate_txn_ref()
    txn = Transaction(
        txn_group_id=txn_group_id,
        txn_ref=txn_ref,
        account_id=locked_account.id,
        counterparty_vpa="rewards@renopay",
        type=TxnType.CREDIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.INCOME,
        amount_paise=withdraw_paise,
        description=f"Reward Cashback Withdrawal to Main Balance ({len(cards_to_withdraw)} cards)",
        trust_score=99,
    )
    db.add(txn)
    await db.flush()

    # Post to accounting journal
    await accounting_engine.post_transaction_to_journal(db, txn)
    await db.commit()
    await db.refresh(locked_account)

    # 7. Push websocket real-time balance update
    await ws_manager.push(
        locked_account.user_id,
        "balance_update",
        {
            "balance": paise_to_rupees(locked_account.current_balance_paise),
            "denominations": locked_account.cash_denominations,
            "digital_gold": paise_to_rupees(locked_account.digital_gold_paise),
            "reason": "reward_withdrawal",
            "txn_ref": txn_ref,
        },
    )

    return WithdrawRewardOut(
        success=True,
        withdrawn_amount=paise_to_rupees(withdraw_paise),
        new_balance=paise_to_rupees(locked_account.current_balance_paise),
        message=f"₹{paise_to_rupees(withdraw_paise):.2f} successfully withdrawn to your main bank balance!",
    )
