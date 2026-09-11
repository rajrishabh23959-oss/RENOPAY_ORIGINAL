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
from app.schemas.features import CreateMandateRequest, MandateOut
from app.services.pin_auth import verify_user_pin, PinError

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
    # Creating a mandate authorizes future recurring debits without the
    # user present for each one — exactly the kind of standing
    # authorization that should require PIN confirmation at setup time,
    # same as real UPI AutoPay registration does.
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    days = _FREQUENCY_DAYS.get(payload.frequency, 30)
    mandate = Mandate(
        user_id=user.id, name=payload.name, icon=payload.icon, merchant_vpa=payload.merchant_vpa,
        amount_paise=rupees_to_paise(payload.amount), max_limit_paise=rupees_to_paise(payload.max_limit),
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
