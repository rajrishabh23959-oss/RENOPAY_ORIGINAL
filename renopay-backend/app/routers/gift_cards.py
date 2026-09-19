import secrets
import string
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.core.security import verify_pin
from app.core.money import rupees_to_paise, paise_to_rupees, generate_txn_ref
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.models.gift_card import GiftCard
from app.schemas.gift_card import (
    CreateGiftCardRequest,
    ClaimGiftCardRequest,
    GiftCardOut,
    GiftCardClaimResult,
)
from app.services.pdf_generator import generate_pdf, build_gift_card_data

router = APIRouter()


def _generate_card_code() -> str:
    """Generate human-readable unique gift code e.g. RENO-GIFT-A8F2-7K9M."""
    chars = string.ascii_uppercase + string.digits
    # Avoid ambiguous characters 0/O, 1/I
    clean_chars = "".join(c for c in chars if c not in "0O1I")
    p1 = "".join(secrets.choice(clean_chars) for _ in range(4))
    p2 = "".join(secrets.choice(clean_chars) for _ in range(4))
    return f"RENO-GIFT-{p1}-{p2}"


@router.post("/create", response_model=GiftCardOut, status_code=status.HTTP_201_CREATED)
async def create_gift_card(
    payload: CreateGiftCardRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new RenoPay Digital Gift Card.
    Deducts the pre-funded amount from the creator's wallet balance
    after verifying their 6-digit UPI PIN.
    """
    # 1. Verify UPI PIN
    if not user.pin_hash or not verify_pin(payload.pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_pin", "message": "Incorrect UPI PIN. Please try again."},
        )

    # 2. Check sufficient account balance
    amount_paise = rupees_to_paise(payload.amount)
    if amount_paise <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gift card amount must be greater than zero.",
        )

    if account.current_balance_paise < amount_paise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient wallet balance to create this gift card.",
        )

    # 3. Generate unique code
    card_code = _generate_card_code()
    # Ensure uniqueness
    for _ in range(5):
        existing = await db.execute(select(GiftCard).where(GiftCard.card_code == card_code))
        if not existing.scalar_one_or_none():
            break
        card_code = _generate_card_code()

    # 4. Deduct balance from creator
    account.current_balance_paise -= amount_paise

    # 5. Record debit transaction
    creation_txn_ref = generate_txn_ref()
    txn_group_id = uuid.uuid4()
    debit_txn = Transaction(
        txn_group_id=txn_group_id,
        txn_ref=creation_txn_ref,
        account_id=account.id,
        counterparty_vpa="giftcard@renopay",
        counterparty_name="RenoPay Gift Card Vault",
        type=TxnType.DEBIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.OTHER,
        amount_paise=amount_paise,
        description=f"Gift Card Created: {card_code}" + (f" for {payload.recipient_name}" if payload.recipient_name else ""),
    )
    db.add(debit_txn)

    # 6. Create GiftCard record (Valid for 1 year)
    now = datetime.now(timezone.utc)
    expiry_at = now + timedelta(days=365)
    gift_card = GiftCard(
        card_code=card_code,
        creator_user_id=user.id,
        creator_account_id=account.id,
        amount_paise=amount_paise,
        theme=payload.theme or "gold",
        recipient_name=payload.recipient_name.strip() if payload.recipient_name else None,
        message=payload.message.strip() if payload.message else None,
        status="active",
        expiry_at=expiry_at,
        creation_txn_ref=creation_txn_ref,
    )
    db.add(gift_card)
    await db.commit()
    await db.refresh(gift_card)

    return GiftCardOut(
        id=gift_card.id,
        card_code=gift_card.card_code,
        amount=paise_to_rupees(gift_card.amount_paise),
        theme=gift_card.theme,
        recipient_name=gift_card.recipient_name,
        message=gift_card.message,
        status=gift_card.status,
        created_at=gift_card.created_at,
        expiry_at=gift_card.expiry_at,
        claimed_at=gift_card.claimed_at,
        creator_name=user.full_name,
        claimed_by_name=None,
        creation_txn_ref=gift_card.creation_txn_ref,
        claim_txn_ref=None,
    )


@router.post("/claim", response_model=GiftCardClaimResult)
async def claim_gift_card(
    payload: ClaimGiftCardRequest,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """
    Claim a RenoPay Digital Gift Card using its unique code.
    Validates card status and credits the full voucher amount directly
    into the claiming user's account balance.
    """
    clean_code = payload.code.strip().upper().replace(" ", "")
    if not clean_code.startswith("RENO-GIFT-"):
        # Allow user to type just the suffix e.g. A8F2-7K9M or RENO-GIFT-A8F2-7K9M
        if "-" in clean_code and len(clean_code) == 9:
            clean_code = f"RENO-GIFT-{clean_code}"
        elif len(clean_code) == 8:
            clean_code = f"RENO-GIFT-{clean_code[:4]}-{clean_code[4:]}"

    res = await db.execute(select(GiftCard).where(GiftCard.card_code == clean_code))
    gift_card = res.scalar_one_or_none()

    if not gift_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid Gift Card code. Please check the code and try again.",
        )

    if gift_card.status == "claimed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This Gift Card has already been claimed and redeemed.",
        )

    now = datetime.now(timezone.utc)
    expiry = gift_card.expiry_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if now > expiry or gift_card.status == "expired":
        gift_card.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This Gift Card has expired and can no longer be redeemed.",
        )

    # 1. Credit claiming user's account balance
    account.current_balance_paise += gift_card.amount_paise

    # 2. Record credit transaction
    claim_txn_ref = generate_txn_ref()
    credit_txn = Transaction(
        txn_group_id=uuid.uuid4(),
        txn_ref=claim_txn_ref,
        account_id=account.id,
        counterparty_vpa="giftcard@renopay",
        counterparty_name=f"RenoPay Gift Card ({gift_card.card_code})",
        type=TxnType.CREDIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.INCOME,
        amount_paise=gift_card.amount_paise,
        description=f"Gift Card Claimed: {gift_card.card_code}" + (f" from {gift_card.recipient_name}" if gift_card.recipient_name else ""),
    )
    db.add(credit_txn)

    # 3. Update Gift Card status
    gift_card.status = "claimed"
    gift_card.claimed_by_user_id = user.id
    gift_card.claimed_by_account_id = account.id
    gift_card.claimed_at = now
    gift_card.claim_txn_ref = claim_txn_ref

    await db.commit()
    await db.refresh(account)

    amount_rupees = paise_to_rupees(gift_card.amount_paise)
    new_bal_rupees = paise_to_rupees(account.current_balance_paise)

    return GiftCardClaimResult(
        success=True,
        amount=amount_rupees,
        card_code=gift_card.card_code,
        message=f"₹{amount_rupees:,.2f} successfully credited to your RenoPay wallet balance!",
        new_balance=new_bal_rupees,
        claimed_at=now,
    )


@router.get("/my-cards", response_model=dict[str, list[GiftCardOut]])
async def get_my_gift_cards(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns lists of gift cards created by this user and claimed by this user.
    """
    # 1. Cards created by user
    created_res = await db.execute(
        select(GiftCard)
        .where(GiftCard.creator_user_id == user.id)
        .order_by(desc(GiftCard.created_at))
    )
    created_cards = created_res.scalars().all()

    # 2. Cards claimed by user
    claimed_res = await db.execute(
        select(GiftCard)
        .where(GiftCard.claimed_by_user_id == user.id)
        .order_by(desc(GiftCard.claimed_at))
    )
    claimed_cards = claimed_res.scalars().all()

    def to_out(c: GiftCard) -> GiftCardOut:
        return GiftCardOut(
            id=c.id,
            card_code=c.card_code,
            amount=paise_to_rupees(c.amount_paise),
            theme=c.theme,
            recipient_name=c.recipient_name,
            message=c.message,
            status=c.status,
            created_at=c.created_at,
            expiry_at=c.expiry_at,
            claimed_at=c.claimed_at,
            creator_name=user.full_name if c.creator_user_id == user.id else "Sender",
            claimed_by_name=user.full_name if c.claimed_by_user_id == user.id else None,
            creation_txn_ref=c.creation_txn_ref,
            claim_txn_ref=c.claim_txn_ref,
        )

    return {
        "created": [to_out(c) for c in created_cards],
        "claimed": [to_out(c) for c in claimed_cards],
    }


@router.get("/{card_id}/pdf")
async def get_gift_card_pdf(
    card_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and stream the high-resolution branded PDF Gift Voucher.
    Accessible by the card creator or claimant.
    """
    res = await db.execute(
        select(GiftCard)
        .where(
            GiftCard.id == card_id,
            or_(
                GiftCard.creator_user_id == user.id,
                GiftCard.claimed_by_user_id == user.id,
            ),
        )
    )
    card = res.scalar_one_or_none()
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift Card not found or unauthorized.",
        )

    creator_user = None
    if card.creator_user_id:
        u_res = await db.execute(select(User).where(User.id == card.creator_user_id))
        creator_user = u_res.scalar_one_or_none()

    context = build_gift_card_data(card, creator_user)
    pdf_stream = await generate_pdf("gift_card", context)
    filename = f"RenoPay_GiftCard_{card.card_code}.pdf"

    return StreamingResponse(
        pdf_stream,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Cache-Control": "no-cache",
        },
    )
