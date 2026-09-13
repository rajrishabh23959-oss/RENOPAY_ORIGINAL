import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user, get_current_account
from app.core.money import rupees_to_paise, paise_to_rupees, generate_txn_ref
from app.db.session import get_db
from app.models.user import User, KYCStatus
from app.models.account import Account
from app.models.savings import SharedVault, SharedVaultMember, SharedVaultLog, SharedVaultWithdrawalRequest
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.schemas.features import (
    CreateVaultRequest,
    AddVaultMemberRequest,
    ContributeVaultRequest,
    InitiateVaultWithdrawalRequest,
    ApproveVaultWithdrawalRequest,
    WithdrawMyContributionRequest,
    SharedVaultOut,
    VaultLogOut,
    VaultMemberOut,
    VaultWithdrawalRequestOut,
)
from app.services.payment_engine import new_txn_group_id, _lock_account
from app.services.pin_auth import verify_user_pin, PinError
from app.services.denomination_service import add_denominations
from app.services import accounting_engine
from app.ws.manager import manager as ws_manager

router = APIRouter()


async def _resolve_or_create_user(db: AsyncSession, identifier: str) -> User | None:
    ident = identifier.strip()
    if not ident:
        return None

    # 1. Check if UPI ID / VPA
    if "@" in ident:
        clean_vpa = ident.lower()
        acc_res = await db.execute(select(Account).where(Account.vpa == clean_vpa))
        acc = acc_res.scalar_one_or_none()
        if acc:
            return await db.get(User, acc.user_id)
        # External VPA: auto-create virtual user & account
        from app.services.upi_directory import get_or_create_external_account

        ext_acc = await get_or_create_external_account(db, clean_vpa)
        return await db.get(User, ext_acc.user_id)

    # 2. Check if Phone number
    digits = re.sub(r"[^\d]", "", ident)
    digits_10 = digits[-10:] if len(digits) >= 10 else digits
    if len(digits_10) == 10:
        u_res = await db.execute(
            select(User).where(
                (User.phone_number == digits_10)
                | (User.phone_number == f"+91{digits_10}")
                | (User.phone_number == ident)
            )
        )
        u = u_res.scalar_one_or_none()
        if u:
            return u

        # Auto-provision RenoPay user account so they can participate immediately
        from app.core.security import hash_pin
        from app.core.money import generate_virtual_acc_no

        new_user = User(
            full_name=f"User {digits_10[-4:]}",
            phone_number=digits_10,
            pin_hash=hash_pin("123456"),
            kyc_status=KYCStatus.VERIFIED,
        )
        db.add(new_user)
        await db.flush()

        new_acc = Account(
            user_id=new_user.id,
            virtual_acc_no=generate_virtual_acc_no(),
            vpa=f"{digits_10}@renopay",
            current_balance_paise=100000,
        )
        db.add(new_acc)
        await db.flush()
        return new_user

    return None


async def _serialize_vault(db: AsyncSession, vault: SharedVault, current_user_id: uuid.UUID) -> SharedVaultOut:
    # 1. Fetch logs with user names
    logs_result = await db.execute(
        select(SharedVaultLog, User.full_name)
        .join(User, SharedVaultLog.user_id == User.id)
        .where(SharedVaultLog.vault_id == vault.id)
        .order_by(SharedVaultLog.created_at.desc())
    )
    raw_logs = logs_result.all()
    logs = [
        VaultLogOut(
            user_name=name,
            amount=paise_to_rupees(log.amount_paise),
            log_type=log.log_type,
            created_at=log.created_at,
        )
        for log, name in raw_logs
    ]

    # 2. Fetch all members with their User and Account info
    members_result = await db.execute(
        select(SharedVaultMember, User, Account)
        .join(User, SharedVaultMember.user_id == User.id)
        .join(Account, Account.user_id == User.id)
        .where(SharedVaultMember.vault_id == vault.id)
    )
    members_rows = members_result.all()

    # Calculate contribution per member: contributions minus refunds/member_withdrawals
    member_outs = []
    for member_rel, m_user, m_account in members_rows:
        contributed_paise = sum(
            log.amount_paise for log, _ in raw_logs if log.user_id == m_user.id and log.log_type == "contribution"
        )
        refunded_paise = sum(
            log.amount_paise
            for log, _ in raw_logs
            if log.user_id == m_user.id and log.log_type in ("refund", "member_withdrawal")
        )
        net_paise = max(0, contributed_paise - refunded_paise)

        member_outs.append(
            VaultMemberOut(
                user_id=m_user.id,
                name=m_user.full_name,
                vpa=m_account.vpa,
                phone_number=m_user.phone_number,
                contributed_amount=paise_to_rupees(net_paise),
                is_creator=(m_user.id == vault.creator_id),
                is_current_user=(m_user.id == current_user_id),
            )
        )

    # 3. Check for any active pending withdrawal request
    active_withdrawal = None
    req_result = await db.execute(
        select(SharedVaultWithdrawalRequest, User.full_name)
        .join(User, SharedVaultWithdrawalRequest.requester_id == User.id)
        .where(
            SharedVaultWithdrawalRequest.vault_id == vault.id,
            SharedVaultWithdrawalRequest.status == "pending",
        )
        .order_by(SharedVaultWithdrawalRequest.created_at.desc())
    )
    active_row = req_result.first()
    if active_row:
        req, req_name = active_row
        approvals = req.approvals or []
        active_withdrawal = VaultWithdrawalRequestOut(
            id=req.id,
            requester_id=req.requester_id,
            requester_name=req_name,
            amount=paise_to_rupees(req.amount_paise),
            status=req.status,
            approvals=approvals,
            total_members=len(member_outs),
            has_approved=str(current_user_id) in approvals,
            created_at=req.created_at,
        )

    return SharedVaultOut(
        id=vault.id,
        name=vault.name,
        icon=vault.icon,
        target=paise_to_rupees(vault.target_paise),
        balance=paise_to_rupees(vault.balance_paise),
        creator_id=vault.creator_id,
        is_creator=(vault.creator_id == current_user_id),
        members=member_outs,
        active_withdrawal=active_withdrawal,
        logs=logs,
    )


@router.get("/", response_model=list[SharedVaultOut])
async def list_my_vaults(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SharedVault)
        .join(SharedVaultMember, SharedVaultMember.vault_id == SharedVault.id)
        .where(SharedVaultMember.user_id == user.id)
        .distinct()
    )
    vaults = result.scalars().all()
    return [await _serialize_vault(db, v, user.id) for v in vaults]


@router.post("/", response_model=SharedVaultOut)
async def create_vault(
    payload: CreateVaultRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    vault = SharedVault(
        name=payload.name,
        icon=payload.icon,
        target_paise=rupees_to_paise(payload.target),
        creator_id=user.id,
    )
    db.add(vault)
    await db.flush()

    member_user_ids = {user.id}

    # Add by phone numbers
    if payload.member_phone_numbers:
        for p in payload.member_phone_numbers:
            u = await _resolve_or_create_user(db, p)
            if u:
                member_user_ids.add(u.id)

    # Add by UPI IDs
    if payload.member_vpas:
        for v in payload.member_vpas:
            u = await _resolve_or_create_user(db, v)
            if u:
                member_user_ids.add(u.id)

    for uid in member_user_ids:
        db.add(SharedVaultMember(vault_id=vault.id, user_id=uid))

    await db.commit()
    await db.refresh(vault)
    return await _serialize_vault(db, vault, user.id)


@router.post("/{vault_id}/members", response_model=SharedVaultOut)
async def add_vault_member(
    vault_id: uuid.UUID,
    payload: AddVaultMemberRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vault = await db.get(SharedVault, vault_id)
    if not vault:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vault not found")

    # Check caller is a member
    caller_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if not caller_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only vault members can add other members")

    target_user = await _resolve_or_create_user(db, payload.identifier)
    if not target_user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"Could not find or add user for '{payload.identifier}'"
        )

    # Check if already a member
    exist_check = await db.execute(
        select(SharedVaultMember).where(
            SharedVaultMember.vault_id == vault_id,
            SharedVaultMember.user_id == target_user.id,
        )
    )
    if exist_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{target_user.full_name} is already a member of this vault")

    db.add(SharedVaultMember(vault_id=vault.id, user_id=target_user.id))
    await db.commit()
    await db.refresh(vault)

    # Notify added user
    await ws_manager.push(
        target_user.id,
        "vault_invite",
        {"vault_id": str(vault.id), "vault_name": vault.name, "inviter": user.full_name},
    )

    return await _serialize_vault(db, vault, user.id)


@router.post("/{vault_id}/contribute", response_model=SharedVaultOut)
async def contribute(
    vault_id: uuid.UUID,
    payload: ContributeVaultRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    member_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if member_check.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this vault")

    vault_result = await db.execute(select(SharedVault).where(SharedVault.id == vault_id).with_for_update())
    vault = vault_result.scalar_one_or_none()
    if vault is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vault not found")

    # RULE: Once vault is 100% full, no more money can be added!
    if vault.balance_paise >= vault.target_paise:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Vault is 100% full! The target has already been achieved, no more money can be added.",
        )

    amount_paise = rupees_to_paise(payload.amount)
    if vault.balance_paise + amount_paise > vault.target_paise:
        max_allowed = paise_to_rupees(vault.target_paise - vault.balance_paise)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Contribution exceeds 100% target! Maximum you can add to complete the vault is ₹{max_allowed:.2f}.",
        )

    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    acc_result = await db.execute(select(Account).where(Account.id == account.id).with_for_update())
    locked_account = acc_result.scalar_one()

    if locked_account.current_balance_paise < amount_paise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Insufficient balance")

    locked_account.current_balance_paise -= amount_paise
    vault.balance_paise += amount_paise

    db.add(SharedVaultLog(vault_id=vault.id, user_id=user.id, amount_paise=amount_paise, log_type="contribution"))

    txn = Transaction(
        txn_group_id=new_txn_group_id(),
        txn_ref=generate_txn_ref(),
        account_id=locked_account.id,
        counterparty_vpa=f"vault@{vault.name.lower().replace(' ', '')}",
        type=TxnType.DEBIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.OTHER,
        amount_paise=amount_paise,
        description=f"Vault Contribution: {vault.name}",
        trust_score=99,
    )
    db.add(txn)
    await db.flush()
    await accounting_engine.post_transaction_to_journal(db, txn)

    await db.commit()
    await db.refresh(vault)
    await db.refresh(locked_account)

    await ws_manager.push(
        user.id,
        "balance_update",
        {
            "balance": paise_to_rupees(locked_account.current_balance_paise),
            "denominations": locked_account.cash_denominations,
            "reason": "vault_contribution",
        },
    )
    return await _serialize_vault(db, vault, user.id)


@router.post("/{vault_id}/withdraw-my-contribution", response_model=SharedVaultOut)
async def withdraw_my_contribution(
    vault_id: uuid.UUID,
    payload: WithdrawMyContributionRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """Personal stake refund: A member can withdraw their personally contributed money anytime with their own UPI PIN without requiring anyone else's approval."""
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    # Check member
    member_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this vault")

    # Lock vault & account
    vault = (
        await db.execute(select(SharedVault).where(SharedVault.id == vault_id).with_for_update())
    ).scalar_one_or_none()
    if not vault:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vault not found")

    locked_account = await _lock_account(db, account.id)

    # Compute net contribution
    logs_res = await db.execute(select(SharedVaultLog).where(SharedVaultLog.vault_id == vault_id))
    all_logs = logs_res.scalars().all()

    contributed_paise = sum(l.amount_paise for l in all_logs if l.user_id == user.id and l.log_type == "contribution")
    refunded_paise = sum(
        l.amount_paise for l in all_logs if l.user_id == user.id and l.log_type in ("refund", "member_withdrawal")
    )
    net_paise = contributed_paise - refunded_paise

    if net_paise <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You have no personal contribution in this vault to withdraw")

    if vault.balance_paise < net_paise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vault does not have sufficient balance to refund contribution")

    # Deduct from vault and credit user
    vault.balance_paise -= net_paise
    orig_bal = locked_account.current_balance_paise
    locked_account.current_balance_paise += net_paise
    locked_account.cash_denominations = add_denominations(
        locked_account.cash_denominations, int(paise_to_rupees(net_paise)), orig_bal
    )

    db.add(SharedVaultLog(vault_id=vault.id, user_id=user.id, amount_paise=net_paise, log_type="refund"))

    txn = Transaction(
        txn_group_id=new_txn_group_id(),
        txn_ref=generate_txn_ref(),
        account_id=locked_account.id,
        counterparty_vpa=f"vault@{vault.name.lower().replace(' ', '')}",
        type=TxnType.CREDIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.INCOME,
        amount_paise=net_paise,
        description=f"Refund Contribution: {vault.name}",
        trust_score=99,
    )
    db.add(txn)
    await db.flush()
    await accounting_engine.post_transaction_to_journal(db, txn)

    # Remove user as a member from this vault since they withdrew their entire share
    await db.execute(
        delete(SharedVaultMember).where(
            SharedVaultMember.vault_id == vault_id,
            SharedVaultMember.user_id == user.id,
        )
    )

    remaining_members = await db.scalar(
        select(func.count()).select_from(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id)
    )

    # If no members remain or vault balance is exhausted, automatically delete the vault
    if (remaining_members is None or remaining_members <= 0) or vault.balance_paise <= 0:
        await db.execute(delete(SharedVaultWithdrawalRequest).where(SharedVaultWithdrawalRequest.vault_id == vault_id))
        await db.execute(delete(SharedVaultLog).where(SharedVaultLog.vault_id == vault_id))
        await db.execute(delete(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id))
        await db.delete(vault)

    await db.commit()
    await db.refresh(locked_account)

    await ws_manager.push(
        user.id,
        "balance_update",
        {
            "balance": paise_to_rupees(locked_account.current_balance_paise),
            "denominations": locked_account.cash_denominations,
            "reason": "vault_refund",
        },
    )

    # Notify remaining members if vault still exists
    if remaining_members and remaining_members > 0 and vault.balance_paise > 0:
        other_members = (
            await db.execute(select(SharedVaultMember.user_id).where(SharedVaultMember.vault_id == vault_id))
        ).scalars().all()
        for mid in other_members:
            await ws_manager.push(
                mid,
                "vault_updated",
                {"vault_id": str(vault_id), "vault_name": vault.name},
            )

    return SharedVaultOut(
        id=vault_id,
        name=vault.name,
        icon=vault.icon,
        target=0,
        balance=0,
        creator_id=vault.creator_id,
        is_creator=False,
        members=[],
        active_withdrawal=None,
        logs=[],
    )


@router.post("/{vault_id}/request-withdrawal", response_model=SharedVaultOut)
async def request_vault_withdrawal(
    vault_id: uuid.UUID,
    payload: InitiateVaultWithdrawalRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """
    Withdrawing the FULL vault amount requires all other vault members to accept and approve with their UPI PIN.
    """
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    # Check caller is member
    member_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this vault")

    vault = (await db.execute(select(SharedVault).where(SharedVault.id == vault_id))).scalar_one_or_none()
    if not vault:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vault not found")

    if vault.balance_paise <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vault has zero balance to withdraw")

    # Check for existing pending request
    existing_req = await db.execute(
        select(SharedVaultWithdrawalRequest).where(
            SharedVaultWithdrawalRequest.vault_id == vault_id,
            SharedVaultWithdrawalRequest.status == "pending",
        )
    )
    if existing_req.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A withdrawal request is already pending for this vault")

    # Withdrawing full vault balance
    withdraw_paise = vault.balance_paise

    # Get total member count
    members_count = await db.scalar(
        select(func.count()).select_from(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id)
    )

    req = SharedVaultWithdrawalRequest(
        vault_id=vault.id,
        requester_id=user.id,
        amount_paise=withdraw_paise,
        status="pending",
        approvals=[str(user.id)],
    )
    db.add(req)
    await db.flush()

    # If vault only has 1 member (creator alone), auto-complete immediately
    if members_count <= 1:
        locked_vault = (
            await db.execute(select(SharedVault).where(SharedVault.id == vault_id).with_for_update())
        ).scalar_one()
        locked_account = await _lock_account(db, account.id)

        locked_vault.balance_paise -= withdraw_paise
        orig_bal = locked_account.current_balance_paise
        locked_account.current_balance_paise += withdraw_paise
        locked_account.cash_denominations = add_denominations(
            locked_account.cash_denominations, int(paise_to_rupees(withdraw_paise)), orig_bal
        )

        db.add(
            SharedVaultLog(
                vault_id=vault.id, user_id=user.id, amount_paise=withdraw_paise, log_type="withdrawal"
            )
        )
        req.status = "completed"

        txn = Transaction(
            txn_group_id=new_txn_group_id(),
            txn_ref=generate_txn_ref(),
            account_id=locked_account.id,
            counterparty_vpa=f"vault@{vault.name.lower().replace(' ', '')}",
            type=TxnType.CREDIT,
            status=TxnStatus.SUCCESS,
            category=TxnCategory.INCOME,
            amount_paise=withdraw_paise,
            description=f"Vault Payout: {vault.name}",
            trust_score=99,
        )
        db.add(txn)
        await db.flush()
        await accounting_engine.post_transaction_to_journal(db, txn)

        # Full payout completed -> Auto-delete vault!
        await db.execute(delete(SharedVaultWithdrawalRequest).where(SharedVaultWithdrawalRequest.vault_id == vault_id))
        await db.execute(delete(SharedVaultLog).where(SharedVaultLog.vault_id == vault_id))
        await db.execute(delete(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id))
        await db.delete(locked_vault)

        await db.commit()
        await db.refresh(locked_account)

        return SharedVaultOut(
            id=vault.id,
            name=vault.name,
            icon=vault.icon,
            target=0,
            balance=0,
            creator_id=vault.creator_id,
            is_creator=True,
            members=[],
            active_withdrawal=None,
            logs=[],
        )

    await db.commit()
    await db.refresh(vault)

    # Broadcast notification to all other members so it appears in their vaults immediately!
    all_members = (
        await db.execute(select(SharedVaultMember.user_id).where(SharedVaultMember.vault_id == vault_id))
    ).scalars().all()
    for mid in all_members:
        if mid != user.id:
            await ws_manager.push(
                mid,
                "vault_withdrawal_request",
                {
                    "vault_id": str(vault.id),
                    "vault_name": vault.name,
                    "requester": user.full_name,
                    "amount": paise_to_rupees(withdraw_paise),
                },
            )

    return await _serialize_vault(db, vault, user.id)


@router.post("/{vault_id}/approve-withdrawal", response_model=SharedVaultOut)
async def approve_vault_withdrawal(
    vault_id: uuid.UUID,
    payload: ApproveVaultWithdrawalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allows a member to accept & approve a pending full vault withdrawal with their UPI PIN."""
    try:
        await verify_user_pin(db, user, payload.pin)
    except PinError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})

    # Check caller is a member
    member_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this vault")

    # Find pending request
    req_res = await db.execute(
        select(SharedVaultWithdrawalRequest)
        .where(
            SharedVaultWithdrawalRequest.vault_id == vault_id,
            SharedVaultWithdrawalRequest.status == "pending",
        )
        .with_for_update()
    )
    req = req_res.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active withdrawal request pending for this vault")

    approvals = list(req.approvals or [])
    if str(user.id) not in approvals:
        approvals.append(str(user.id))
        req.approvals = approvals
        flag_modified(req, "approvals")

    # Check total members
    members_count = await db.scalar(
        select(func.count()).select_from(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id)
    )

    vault = (
        await db.execute(select(SharedVault).where(SharedVault.id == vault_id).with_for_update())
    ).scalar_one()

    # If ALL members have approved, execute payout to the requester!
    if len(set(approvals)) >= members_count:
        requester_acc = (
            await db.execute(select(Account).where(Account.user_id == req.requester_id).with_for_update())
        ).scalar_one()

        payout_amount = req.amount_paise
        vault.balance_paise = max(0, vault.balance_paise - payout_amount)
        orig_bal = requester_acc.current_balance_paise
        requester_acc.current_balance_paise += payout_amount
        requester_acc.cash_denominations = add_denominations(
            requester_acc.cash_denominations, int(paise_to_rupees(payout_amount)), orig_bal
        )

        db.add(
            SharedVaultLog(
                vault_id=vault.id, user_id=req.requester_id, amount_paise=payout_amount, log_type="withdrawal"
            )
        )
        req.status = "completed"

        txn = Transaction(
            txn_group_id=new_txn_group_id(),
            txn_ref=generate_txn_ref(),
            account_id=requester_acc.id,
            counterparty_vpa=f"vault@{vault.name.lower().replace(' ', '')}",
            type=TxnType.CREDIT,
            status=TxnStatus.SUCCESS,
            category=TxnCategory.INCOME,
            amount_paise=payout_amount,
            description=f"Full Vault Payout: {vault.name} (Approved by all members)",
            trust_score=99,
        )
        db.add(txn)
        await db.flush()
        await accounting_engine.post_transaction_to_journal(db, txn)

        # Notify requester
        await ws_manager.push(
            req.requester_id,
            "balance_update",
            {
                "balance": paise_to_rupees(requester_acc.current_balance_paise),
                "denominations": requester_acc.cash_denominations,
                "reason": "vault_payout",
            },
        )

        # Fetch all members to push update before deleting
        all_members = (
            await db.execute(select(SharedVaultMember.user_id).where(SharedVaultMember.vault_id == vault_id))
        ).scalars().all()

        # Delete the vault and all related rows upon 100% full withdrawal payout
        await db.execute(delete(SharedVaultWithdrawalRequest).where(SharedVaultWithdrawalRequest.vault_id == vault_id))
        await db.execute(delete(SharedVaultLog).where(SharedVaultLog.vault_id == vault_id))
        await db.execute(delete(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id))
        await db.delete(vault)

        await db.commit()

        for mid in all_members:
            await ws_manager.push(
                mid,
                "vault_updated",
                {"vault_id": str(vault_id), "vault_name": vault.name},
            )

        return SharedVaultOut(
            id=vault_id,
            name=vault.name,
            icon=vault.icon,
            target=0,
            balance=0,
            creator_id=vault.creator_id,
            is_creator=(vault.creator_id == user.id),
            members=[],
            active_withdrawal=None,
            logs=[],
        )

    await db.commit()
    await db.refresh(vault)

    # Push real-time event to all members so their screens update immediately
    all_members = (
        await db.execute(select(SharedVaultMember.user_id).where(SharedVaultMember.vault_id == vault_id))
    ).scalars().all()
    for mid in all_members:
        await ws_manager.push(
            mid,
            "vault_updated",
            {"vault_id": str(vault.id), "vault_name": vault.name},
        )

    return await _serialize_vault(db, vault, user.id)


@router.post("/{vault_id}/reject-withdrawal", response_model=SharedVaultOut)
async def reject_vault_withdrawal(
    vault_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member_check = await db.execute(
        select(SharedVaultMember).where(SharedVaultMember.vault_id == vault_id, SharedVaultMember.user_id == user.id)
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this vault")

    req_res = await db.execute(
        select(SharedVaultWithdrawalRequest)
        .where(
            SharedVaultWithdrawalRequest.vault_id == vault_id,
            SharedVaultWithdrawalRequest.status == "pending",
        )
        .with_for_update()
    )
    req = req_res.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active withdrawal request pending for this vault")

    req.status = "rejected"
    await db.commit()

    vault = await db.get(SharedVault, vault_id)
    return await _serialize_vault(db, vault, user.id)
