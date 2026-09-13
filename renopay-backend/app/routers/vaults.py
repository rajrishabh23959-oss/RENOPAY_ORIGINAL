import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.money import rupees_to_paise, paise_to_rupees, generate_txn_ref
from app.db.session import get_db
from app.models.user import User
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
        clean_phones = [p.strip() for p in payload.member_phone_numbers if p.strip()]
        if clean_phones:
            res_phones = await db.execute(select(User).where(User.phone_number.in_(clean_phones)))
            for u in res_phones.scalars().all():
                member_user_ids.add(u.id)

    # Add by UPI IDs
    if payload.member_vpas:
        clean_vpas = [v.strip().lower() for v in payload.member_vpas if v.strip()]
        if clean_vpas:
            res_vpas = await db.execute(select(Account).where(Account.vpa.in_(clean_vpas)))
            for acc in res_vpas.scalars().all():
                member_user_ids.add(acc.user_id)

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

    identifier = payload.identifier.strip()
    target_user = None

    if "@" in identifier:
        # Search by UPI ID
        clean_vpa = identifier.lower()
        acc_res = await db.execute(select(Account).where(Account.vpa == clean_vpa))
        acc = acc_res.scalar_one_or_none()
        if acc:
            target_user = await db.get(User, acc.user_id)
    else:
        # Search by phone number
        user_res = await db.execute(select(User).where(User.phone_number == identifier))
        target_user = user_res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No RenoPay user found matching '{identifier}'"
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
    """Conflict resolution / Individual exit: Allows any member to withdraw their exact net contribution back to their bank balance."""
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
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You have no contributed balance in this vault to withdraw")

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

    await db.commit()
    await db.refresh(vault)
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

    return await _serialize_vault(db, vault, user.id)


@router.post("/{vault_id}/request-withdrawal", response_model=SharedVaultOut)
async def request_vault_withdrawal(
    vault_id: uuid.UUID,
    payload: InitiateVaultWithdrawalRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """Initiates a multi-party consensus withdrawal request for full or partial vault balance."""
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

    withdraw_paise = rupees_to_paise(payload.amount) if payload.amount and payload.amount > 0 else vault.balance_paise
    if withdraw_paise > vault.balance_paise:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Requested amount exceeds vault balance")

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

    # If only 1 member in vault (creator), auto-complete immediately!
    if members_count == 1:
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

    await db.commit()
    await db.refresh(vault)

    # Broadcast notification
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
    """Allows a member to approve a pending vault withdrawal with their UPI PIN."""
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

        vault.balance_paise = max(0, vault.balance_paise - req.amount_paise)
        orig_bal = requester_acc.current_balance_paise
        requester_acc.current_balance_paise += req.amount_paise
        requester_acc.cash_denominations = add_denominations(
            requester_acc.cash_denominations, int(paise_to_rupees(req.amount_paise)), orig_bal
        )

        db.add(
            SharedVaultLog(
                vault_id=vault.id, user_id=req.requester_id, amount_paise=req.amount_paise, log_type="withdrawal"
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
            amount_paise=req.amount_paise,
            description=f"Vault Payout: {vault.name} (Approved by all members)",
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

    await db.commit()
    await db.refresh(vault)

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
