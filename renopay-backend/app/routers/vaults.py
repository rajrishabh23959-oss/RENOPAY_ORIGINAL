import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.money import rupees_to_paise, paise_to_rupees, generate_txn_ref
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.savings import SharedVault, SharedVaultMember, SharedVaultLog
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.schemas.features import CreateVaultRequest, ContributeVaultRequest, SharedVaultOut, VaultLogOut
from app.services.payment_engine import new_txn_group_id
from app.services.pin_auth import verify_user_pin, PinError
from app.ws.manager import manager as ws_manager

router = APIRouter()


async def _serialize_vault(db: AsyncSession, vault: SharedVault) -> SharedVaultOut:
    logs_result = await db.execute(
        select(SharedVaultLog, User.full_name)
        .join(User, SharedVaultLog.user_id == User.id)
        .where(SharedVaultLog.vault_id == vault.id)
        .order_by(SharedVaultLog.created_at.desc())
    )
    logs = [
        VaultLogOut(user_name=name, amount=paise_to_rupees(log.amount_paise),
                    log_type=log.log_type, created_at=log.created_at)
        for log, name in logs_result.all()
    ]
    return SharedVaultOut(
        id=vault.id, name=vault.name, icon=vault.icon,
        target=paise_to_rupees(vault.target_paise), balance=paise_to_rupees(vault.balance_paise),
        logs=logs,
    )


@router.get("/", response_model=list[SharedVaultOut])
async def list_my_vaults(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SharedVault)
        .join(SharedVaultMember, SharedVaultMember.vault_id == SharedVault.id)
        .where(SharedVaultMember.user_id == user.id)
    )
    vaults = result.scalars().all()
    return [await _serialize_vault(db, v) for v in vaults]


@router.post("/", response_model=SharedVaultOut)
async def create_vault(
    payload: CreateVaultRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    vault = SharedVault(
        name=payload.name, icon=payload.icon, target_paise=rupees_to_paise(payload.target), creator_id=user.id,
    )
    db.add(vault)
    await db.flush()
    db.add(SharedVaultMember(vault_id=vault.id, user_id=user.id))

    if payload.member_phone_numbers:
        members_result = await db.execute(select(User).where(User.phone_number.in_(payload.member_phone_numbers)))
        for member_user in members_result.scalars().all():
            db.add(SharedVaultMember(vault_id=vault.id, user_id=member_user.id))

    await db.commit()
    await db.refresh(vault)
    return await _serialize_vault(db, vault)


@router.post("/{vault_id}/contribute", response_model=SharedVaultOut)
async def contribute(
    vault_id: uuid.UUID, payload: ContributeVaultRequest,
    user: User = Depends(get_current_user), account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    member_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if member_check.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this vault")

    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    acc_result = await db.execute(select(Account).where(Account.id == account.id).with_for_update())
    locked_account = acc_result.scalar_one()

    vault_result = await db.execute(select(SharedVault).where(SharedVault.id == vault_id).with_for_update())
    vault = vault_result.scalar_one_or_none()
    if vault is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vault not found")

    amount_paise = rupees_to_paise(payload.amount)
    if locked_account.current_balance_paise < amount_paise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Insufficient balance")

    locked_account.current_balance_paise -= amount_paise
    vault.balance_paise += amount_paise
    db.add(SharedVaultLog(vault_id=vault.id, user_id=user.id, amount_paise=amount_paise, log_type="contribution"))
    db.add(Transaction(
        txn_group_id=new_txn_group_id(), txn_ref=generate_txn_ref(), account_id=locked_account.id,
        counterparty_vpa=f"vault@{vault.name.lower().replace(' ', '')}", type=TxnType.DEBIT,
        status=TxnStatus.SUCCESS, category=TxnCategory.OTHER, amount_paise=amount_paise,
        description=f"Vault: {vault.name}", trust_score=99,
    ))
    await db.commit()
    await db.refresh(vault)
    await db.refresh(locked_account)

    await ws_manager.push(user.id, "balance_update", {
        "balance": paise_to_rupees(locked_account.current_balance_paise), "reason": "vault_contribution",
    })
    return await _serialize_vault(db, vault)
