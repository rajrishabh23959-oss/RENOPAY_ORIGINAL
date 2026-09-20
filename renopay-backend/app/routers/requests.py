import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.money import rupees_to_paise
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.money_request import MoneyRequest, RequestStatus
from app.schemas.features import CreateRequestRequest, CreateSplitRequest, MoneyRequestOut
from app.services import payment_engine
from app.services.payment_engine import PaymentError

router = APIRouter()


@router.post("/", response_model=MoneyRequestOut)
async def create_request(
    payload: CreateRequestRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    target = await db.execute(select(Account).where(Account.vpa == payload.to_vpa))
    if target.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "VPA not found")
    req = MoneyRequest(
        from_vpa=account.vpa, to_vpa=payload.to_vpa,
        amount_paise=rupees_to_paise(payload.amount), note=payload.note,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return MoneyRequestOut.from_model(req)


@router.post("/split", response_model=list[MoneyRequestOut])
async def create_split(
    payload: CreateSplitRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    payers = [p for p in payload.people if p.vpa and p.vpa.strip()]
    if not payers:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one payer VPA required")
    share_paise = -(-rupees_to_paise(payload.total_bill) // len(payers))  # ceil division, matches mock

    split_group_id = uuid.uuid4()
    created = []
    for person in payers:
        clean_vpa = person.vpa.strip().lower()
        if "@" not in clean_vpa and clean_vpa.isdigit() and len(clean_vpa) == 10:
            clean_vpa = f"{clean_vpa}@renopay"
        req = MoneyRequest(
            id=uuid.uuid4(),
            from_vpa=account.vpa,
            to_vpa=clean_vpa,
            amount_paise=share_paise,
            note=f"{payload.description or 'Bill split'} - {person.name}'s share",
            split_group_id=split_group_id,
            status=RequestStatus.PENDING,
        )
        db.add(req)
        created.append(req)

    await db.commit()
    for r in created:
        await db.refresh(r)

    # Broadcast real-time push to all recipients (best effort, never fail request if WS fails)
    try:
        from app.ws.manager import manager as ws_manager
        for r in created:
            recipient_acc = (await db.execute(select(Account).where(Account.vpa == r.to_vpa))).scalar_one_or_none()
            if recipient_acc:
                await ws_manager.push(
                    recipient_acc.user_id,
                    "money_request_received",
                    {
                        "from_vpa": r.from_vpa,
                        "to_vpa": r.to_vpa,
                        "amount": paise_to_rupees(r.amount_paise),
                        "note": r.note,
                    },
                )
    except Exception:
        pass

    return [MoneyRequestOut.from_model(r) for r in created]


@router.get("/inbox", response_model=list[MoneyRequestOut])
async def inbox(account: Account = Depends(get_current_account), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MoneyRequest).where(MoneyRequest.to_vpa == account.vpa).order_by(MoneyRequest.created_at.desc())
    )
    return [MoneyRequestOut.from_model(r) for r in result.scalars().all()]


@router.get("/sent", response_model=list[MoneyRequestOut])
async def sent(account: Account = Depends(get_current_account), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MoneyRequest).where(MoneyRequest.from_vpa == account.vpa).order_by(MoneyRequest.created_at.desc())
    )
    return [MoneyRequestOut.from_model(r) for r in result.scalars().all()]


@router.post("/{request_id}/pay")
async def pay_request(
    request_id: uuid.UUID,
    pin: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MoneyRequest).where(MoneyRequest.id == request_id))
    req = result.scalar_one_or_none()
    if req is None or req.status != RequestStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Request not found or already resolved")
    if req.to_vpa != account.vpa:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to pay this request")

    # If paying user's own split share
    if req.from_vpa == req.to_vpa:
        from app.services.pin_auth import verify_user_pin, PinError
        try:
            await verify_user_pin(db, user, pin)
        except PinError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})
        req.status = RequestStatus.PAID
        await db.commit()
        return {"success": True, "txn_ref": "SELF-SETTLED"}

    try:
        pay_result = await payment_engine.send_money(
            db, sender_user_id=user.id, receiver_vpa=req.from_vpa, amount_paise=req.amount_paise,
            pin=pin, description=req.note or "Money Request",
        )
    except PaymentError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": e.code, "message": e.message})
    req.status = RequestStatus.PAID
    await db.commit()
    return {"success": True, "txn_ref": pay_result.txn_ref}


@router.post("/{request_id}/decline")
async def decline_request(
    request_id: uuid.UUID,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(MoneyRequest).where(MoneyRequest.id == request_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if req.to_vpa != account.vpa:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to decline this request")
    req.status = RequestStatus.DECLINED
    await db.commit()
    return {"success": True}
