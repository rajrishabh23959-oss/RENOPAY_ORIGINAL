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
from app.schemas.features import ScratchCardOut, ScratchResultOut

router = APIRouter()


@router.get("/scratch-cards", response_model=list[ScratchCardOut])
async def list_cards(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScratchCard).where(ScratchCard.user_id == user.id).order_by(ScratchCard.created_at.desc())
    )
    return [ScratchCardOut.from_model(c) for c in result.scalars().all()]


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
    if card.reward_type == RewardType.CASHBACK:
        account.current_balance_paise += card.reward_amount_paise
    else:
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
