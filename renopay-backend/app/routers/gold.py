"""
Digital Gold endpoints.

GET  /gold/summary   — returns pot balance, progress, ledger history
POST /gold/toggle-roundup — enable/disable the round-up feature
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.services.gold_service import get_gold_summary

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
