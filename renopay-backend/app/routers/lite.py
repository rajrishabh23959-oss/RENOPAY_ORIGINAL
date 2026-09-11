from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.config import settings
from app.core.money import rupees_to_paise, paise_to_rupees
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.schemas.features import LiteTopUpRequest
from app.services.pin_auth import verify_user_pin, PinError
from app.ws.manager import manager as ws_manager

router = APIRouter()


@router.post("/top-up")
async def top_up_lite(
    payload: LiteTopUpRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    # Top-up debits the real main balance (even though it stays within
    # the same account, moving into the ring-fenced Lite wallet), so it
    # gets the same PIN check as any other debit.
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    result = await db.execute(select(Account).where(Account.id == account.id).with_for_update())
    locked = result.scalar_one()

    amount_paise = rupees_to_paise(payload.amount)
    if locked.current_balance_paise < amount_paise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Insufficient main balance")
    if locked.upi_lite_balance_paise + amount_paise > settings.UPI_LITE_MAX_BALANCE_PAISE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "UPI Lite limit (₹2,000) exceeded")

    locked.current_balance_paise -= amount_paise
    locked.upi_lite_balance_paise += amount_paise
    await db.commit()
    await db.refresh(locked)

    await ws_manager.push(locked.user_id, "balance_update", {
        "balance": paise_to_rupees(locked.current_balance_paise),
        "upi_lite_balance": paise_to_rupees(locked.upi_lite_balance_paise),
        "reason": "lite_topup",
    })
    return {
        "success": True,
        "new_main_balance": paise_to_rupees(locked.current_balance_paise),
        "new_lite_balance": paise_to_rupees(locked.upi_lite_balance_paise),
    }
