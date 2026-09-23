import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.money import rupees_to_paise
from app.db.session import get_db
from app.models.user import User
from app.models.mandate import Mandate, MandateFrequency, MandateStatus
from app.models.transaction import TxnCategory
from app.schemas.features import CreateMandateRequest, MandateOut
from app.services.pin_auth import verify_user_pin, PinError
from app.services import payment_engine
from app.services.payment_engine import PaymentError

router = APIRouter()

_FREQUENCY_DAYS = {"monthly": 30, "quarterly": 90, "yearly": 365}


@router.get("/", response_model=list[MandateOut])
async def list_mandates(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mandate).where(Mandate.user_id == user.id).order_by(Mandate.next_payment_at))
    return [MandateOut.from_model(m) for m in result.scalars().all()]


@router.post("/", response_model=MandateOut)
async def create_mandate(
    payload: CreateMandateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    # 1. Verify UPI PIN first
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    # 2. Strict exact plan amount (paise)
    amount_paise = rupees_to_paise(payload.amount)

    # 2b. Deduplication Guard: If an identical mandate for this merchant & amount was created in the last 20 seconds,
    # return the existing one immediately to completely prevent double debiting!
    recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=20)
    existing_mandate_res = await db.execute(
        select(Mandate).where(
            Mandate.user_id == user.id,
            Mandate.merchant_vpa == payload.merchant_vpa,
            Mandate.amount_paise == amount_paise,
            Mandate.created_at >= recent_cutoff,
        )
    )
    existing_mandate = existing_mandate_res.scalar_one_or_none()
    if existing_mandate:
        return MandateOut.from_model(existing_mandate)

    # 3. Process the exact payment for the selected subscription plan immediately

    # Debits ONLY the exact plan amount (skip_round_up=True ensures zero extra deductions)
    try:
        await payment_engine.send_money(
            db,
            sender_user_id=user.id,
            receiver_vpa=payload.merchant_vpa,
            amount_paise=amount_paise,
            pin=payload.pin,
            description=f"Subscription: {payload.name}",
            category=TxnCategory.BILLS,
            skip_fraud_check=True,
            skip_round_up=True,
            receiver_name=payload.name,
        )
    except PaymentError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    days = _FREQUENCY_DAYS.get(payload.frequency, 30)

    # 4. Save mandate with exact plan amount (max_limit strictly locked to plan amount)
    mandate = Mandate(
        user_id=user.id,
        name=payload.name,
        icon=payload.icon,
        merchant_vpa=payload.merchant_vpa,
        amount_paise=amount_paise,
        max_limit_paise=amount_paise,  # Strictly equal to plan amount! Never more!
        frequency=MandateFrequency(payload.frequency),
        next_payment_at=datetime.now(timezone.utc) + timedelta(days=days),
        category=payload.category,
    )
    db.add(mandate)
    await db.commit()
    await db.refresh(mandate)
    return MandateOut.from_model(mandate)


@router.post("/{mandate_id}/toggle", response_model=MandateOut)
async def toggle_mandate(mandate_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mandate).where(Mandate.id == mandate_id, Mandate.user_id == user.id))
    mandate = result.scalar_one_or_none()
    if mandate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandate not found")
    mandate.status = MandateStatus.PAUSED if mandate.status == MandateStatus.ACTIVE else MandateStatus.ACTIVE
    await db.commit()
    await db.refresh(mandate)
    return MandateOut.from_model(mandate)


@router.delete("/{mandate_id}")
async def cancel_mandate(mandate_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mandate).where(Mandate.id == mandate_id, Mandate.user_id == user.id))
    mandate = result.scalar_one_or_none()
    if mandate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandate not found")
    mandate.status = MandateStatus.CANCELLED
    await db.commit()
    return {"success": True}
