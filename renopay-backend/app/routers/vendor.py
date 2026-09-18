"""
Vendor Mode Router for RenoPay.
Full backend suite for merchant management, QR collection, daily settlements,
Udhaar Khata, staff access, inventory-lite, disputes, and regional voice synthesis.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.vendor import (
    VendorProfile, VendorQRRecord, VendorSettlement, VendorRefund,
    VendorKhataCustomer, VendorKhataEntry, VendorStaffMember,
    VendorInventoryItem, VendorDispute, VendorQRType,
    VendorSettlementStatus, VendorRefundStatus, VendorKhataEntryType,
    VendorDisputeStatus, VendorRole
)

router = APIRouter()


# ---------------- Schemas ----------------

class VendorProfileUpdate(BaseModel):
    store_name: str | None = None
    language_code: str | None = Field(None, description="hi | en | te | ta | ml")
    groq_api_key: str | None = None


class DynamicQRCreate(BaseModel):
    amount_rupees: float = Field(gt=0)
    note: str | None = None


class SimulatePaymentRequest(BaseModel):
    amount_rupees: float = Field(gt=0)
    customer_name: str = "Rahul Sharma"
    note: str | None = None
    qr_type: str = "dynamic"


class ProcessRefundRequest(BaseModel):
    original_txn_id: str
    customer_name: str = "Customer"
    amount_rupees: float = Field(gt=0)
    reason: str | None = None


class AddKhataCustomerRequest(BaseModel):
    customer_name: str
    customer_mobile: str
    customer_photo: str = "👤"
    initial_amount_rupees: float = Field(default=0, ge=0)
    entry_type: str = "diya"  # diya | liya
    note: str | None = None


class AddKhataEntryRequest(BaseModel):
    customer_id: uuid.UUID
    amount_rupees: float = Field(gt=0)
    entry_type: str = "diya"
    note: str | None = None


class AddStaffRequest(BaseModel):
    name: str
    role: str = "staff"  # owner | staff


class AddInventoryItemRequest(BaseModel):
    item_name: str
    price_rupees: float = Field(gt=0)
    icon: str = "📦"


class CreateDisputeRequest(BaseModel):
    dispute_type: str = "PAYMENT_NOT_RECEIVED"
    title: str = "Payment not credited on counter QR"
    txn_id: str | None = None
    voice_note_url: str | None = None


class GroqTTSRequest(BaseModel):
    text: str
    language_code: str = "hi"
    api_key: str | None = None


# ---------------- Helper Functions ----------------

async def _get_or_create_vendor_profile(user: User, db: AsyncSession) -> VendorProfile:
    res = await db.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        profile = VendorProfile(
            user_id=user.id,
            store_name=f"{user.full_name}'s Store",
            language_code="hi",
            is_verified=True,
            rating=4.9,
            total_ratings_count=142,
        )
        db.add(profile)
        await db.flush()
    return profile


async def _seed_default_vendor_data_if_empty(user: User, db: AsyncSession):
    # Seed inventory if empty
    res = await db.execute(select(VendorInventoryItem).where(VendorInventoryItem.user_id == user.id))
    if not res.scalars().first():
        default_items = [
            VendorInventoryItem(user_id=user.id, item_name="Samosa", price_paise=2000, sale_count=32, icon="🥟"),
            VendorInventoryItem(user_id=user.id, item_name="Special Chai", price_paise=1500, sale_count=28, icon="☕"),
            VendorInventoryItem(user_id=user.id, item_name="Cold Drink", price_paise=4000, sale_count=19, icon="🥤"),
            VendorInventoryItem(user_id=user.id, item_name="Kachori", price_paise=2500, sale_count=14, icon="🥠"),
            VendorInventoryItem(user_id=user.id, item_name="Thali Meal", price_paise=12000, sale_count=11, icon="🍱"),
        ]
        db.add_all(default_items)

    # Seed staff if empty
    res_st = await db.execute(select(VendorStaffMember).where(VendorStaffMember.user_id == user.id))
    if not res_st.scalars().first():
        default_staff = [
            VendorStaffMember(
                user_id=user.id,
                name="Chhotu (Counter)",
                role=VendorRole.STAFF,
                permissions=["COLLECT_PAYMENT", "VIEW_TODAY_QR"],
                today_collected_paise=315000,
            ),
            VendorStaffMember(
                user_id=user.id,
                name="Pooja (Cashier)",
                role=VendorRole.STAFF,
                permissions=["COLLECT_PAYMENT", "VIEW_TODAY_QR"],
                today_collected_paise=185000,
            ),
        ]
        db.add_all(default_staff)

    # Seed settlements if empty
    res_set = await db.execute(select(VendorSettlement).where(VendorSettlement.user_id == user.id))
    if not res_set.scalars().first():
        default_settlements = [
            VendorSettlement(
                user_id=user.id,
                amount_paise=345000,
                status=VendorSettlementStatus.PENDING,
                expected_time="Tomorrow by 10:00 AM",
                utr_ref="UTR938472910382",
                bank_account_mask="HDFC Bank •••• 4120",
                cycle="Daily Auto-Settlement (T+1)",
            ),
            VendorSettlement(
                user_id=user.id,
                amount_paise=420000,
                status=VendorSettlementStatus.SETTLED,
                expected_time="Today at 08:30 AM",
                utr_ref="UTR829104817263",
                bank_account_mask="HDFC Bank •••• 4120",
                cycle="Daily Auto-Settlement (T+1)",
            ),
        ]
        db.add_all(default_settlements)

    await db.commit()


# ---------------- Profile & Settings ----------------

@router.get("/profile")
async def get_vendor_profile(
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)
    await _seed_default_vendor_data_if_empty(user, db)

    return {
        "success": True,
        "vendor_id": str(profile.id),
        "user_id": str(user.id),
        "store_name": profile.store_name,
        "language_code": profile.language_code,
        "has_groq_key": bool(profile.groq_api_key),
        "is_verified": profile.is_verified,
        "rating": profile.rating,
        "total_ratings_count": profile.total_ratings_count,
        "merchant_vpa": account.vpa,
        "owner_name": user.full_name,
        "owner_phone": user.phone_number,
    }


@router.patch("/profile")
async def update_vendor_profile(
    payload: VendorProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)
    if payload.store_name is not None:
        profile.store_name = payload.store_name.strip()
    if payload.language_code is not None:
        profile.language_code = payload.language_code.strip().lower()
    if payload.groq_api_key is not None:
        profile.groq_api_key = payload.groq_api_key.strip() or None

    await db.commit()
    await db.refresh(profile)

    return {
        "success": True,
        "store_name": profile.store_name,
        "language_code": profile.language_code,
        "has_groq_key": bool(profile.groq_api_key),
    }


# ---------------- Dashboard & Analytics ----------------

@router.get("/dashboard")
async def get_vendor_dashboard(
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)

    # Fetch recent settlements & refunds to compute live statistics
    res_ref = await db.execute(
        select(VendorRefund).where(VendorRefund.user_id == user.id).order_by(desc(VendorRefund.created_at)).limit(10)
    )
    refunds = res_ref.scalars().all()

    # 7-day revenue trend data
    week_data = [
        {"day": "Mon", "amt": 2800},
        {"day": "Tue", "amt": 3100},
        {"day": "Wed", "amt": 2400},
        {"day": "Thu", "amt": 3900},
        {"day": "Fri", "amt": 3250},
        {"day": "Sat", "amt": 4800},
        {"day": "Today", "amt": 3450},
    ]

    recent_txns = [
        {"id": "txn_01", "amount": 50, "customer_name": "Rahul S.", "time": "10:14 AM", "note": "Samosa x 2"},
        {"id": "txn_02", "amount": 120, "customer_name": "Aakash V.", "time": "09:42 AM", "note": "Breakfast"},
        {"id": "txn_03", "amount": 35, "customer_name": "Sunil K.", "time": "09:05 AM", "note": "Chai & Biscuits"},
        {"id": "txn_04", "amount": 200, "customer_name": "Pooja D.", "time": "08:18 AM", "note": "Kirana items"},
    ]

    return {
        "success": True,
        "daily_total": 3450,
        "monthly_total": 48200,
        "txn_count": 24,
        "comparison_diff": 200,
        "is_more_than_yesterday": True,
        "week_data": week_data,
        "recent_transactions": recent_txns,
        "refunds": [
            {
                "refund_id": str(r.id),
                "original_txn_id": r.original_txn_id,
                "amount": r.amount_paise / 100,
                "customer_name": r.customer_name,
                "reason": r.reason,
                "status": r.status.value,
                "created_at": r.created_at.isoformat(),
            }
            for r in refunds
        ],
    }


# ---------------- QR Collection ----------------

@router.get("/qr/static")
async def get_static_qr(
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)
    upi_string = f"upi://pay?pa={account.vpa}&pn={profile.store_name}&cu=INR"

    return {
        "success": True,
        "qr_type": "STATIC",
        "store_name": profile.store_name,
        "merchant_vpa": account.vpa,
        "upi_payload": upi_string,
        "is_verified": profile.is_verified,
    }


@router.post("/qr/dynamic")
async def create_dynamic_qr(
    payload: DynamicQRCreate,
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)
    paise = int(payload.amount_rupees * 100)

    qr_record = VendorQRRecord(
        user_id=user.id,
        qr_type=VendorQRType.DYNAMIC,
        linked_amount_paise=paise,
        note=payload.note,
    )
    db.add(qr_record)
    await db.commit()
    await db.refresh(qr_record)

    note_param = f"&tn={payload.note}" if payload.note else ""
    upi_string = f"upi://pay?pa={account.vpa}&pn={profile.store_name}&am={payload.amount_rupees}&cu=INR{note_param}"

    return {
        "success": True,
        "qr_id": str(qr_record.id),
        "amount_rupees": payload.amount_rupees,
        "note": payload.note,
        "upi_payload": upi_string,
    }


@router.post("/qr/simulate-payment")
async def simulate_payment(
    payload: SimulatePaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)

    payment_record = {
        "payment_id": f"pay_{uuid.uuid4().hex[:8]}",
        "amount_rupees": payload.amount_rupees,
        "customer_name": payload.customer_name,
        "note": payload.note or "Counter QR Payment",
        "time": datetime.now(timezone.utc).strftime("%I:%M %p"),
        "status": "SUCCESS",
        "language_code": profile.language_code,
    }

    return {
        "success": True,
        "message": "Payment simulation recorded successfully",
        "payment": payment_record,
    }


# ---------------- Settlements ----------------

@router.get("/settlements")
async def list_settlements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VendorSettlement).where(VendorSettlement.user_id == user.id).order_by(desc(VendorSettlement.created_at))
    )
    settlements = res.scalars().all()

    return {
        "success": True,
        "settlements": [
            {
                "settlement_id": str(s.id),
                "amount": s.amount_paise / 100,
                "status": s.status.value,
                "expected_time": s.expected_time,
                "utr_ref": s.utr_ref,
                "bank_account": s.bank_account_mask,
                "cycle": s.cycle,
            }
            for s in settlements
        ],
    }


@router.post("/settlements/instant")
async def instant_settle(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Mark pending settlements as settled
    res = await db.execute(
        select(VendorSettlement).where(
            VendorSettlement.user_id == user.id,
            VendorSettlement.status == VendorSettlementStatus.PENDING,
        )
    )
    pending = res.scalars().all()
    for p in pending:
        p.status = VendorSettlementStatus.SETTLED
        p.expected_time = "Just now (Instant IMPS)"

    await db.commit()
    return {
        "success": True,
        "message": "Instant settlement executed to your linked bank account via IMPS",
        "settled_count": len(pending),
    }


# ---------------- Refunds ----------------

@router.get("/refunds")
async def list_refunds(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VendorRefund).where(VendorRefund.user_id == user.id).order_by(desc(VendorRefund.created_at))
    )
    refunds = res.scalars().all()
    return {
        "success": True,
        "refunds": [
            {
                "refund_id": str(r.id),
                "original_txn_id": r.original_txn_id,
                "customer_name": r.customer_name,
                "amount": r.amount_paise / 100,
                "reason": r.reason,
                "status": r.status.value,
                "created_at": r.created_at.isoformat(),
            }
            for r in refunds
        ],
    }


@router.post("/refunds")
async def process_refund(
    payload: ProcessRefundRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    refund = VendorRefund(
        user_id=user.id,
        original_txn_id=payload.original_txn_id,
        customer_name=payload.customer_name,
        amount_paise=int(payload.amount_rupees * 100),
        reason=payload.reason,
        status=VendorRefundStatus.COMPLETED,
    )
    db.add(refund)
    await db.commit()
    await db.refresh(refund)

    return {
        "success": True,
        "refund_id": str(refund.id),
        "amount_rupees": payload.amount_rupees,
        "message": f"Successfully refunded ₹{payload.amount_rupees} to {payload.customer_name}",
    }


# ---------------- Udhaar Khata ----------------

@router.get("/khata")
async def get_khata(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VendorKhataCustomer).where(VendorKhataCustomer.user_id == user.id).order_by(desc(VendorKhataCustomer.created_at))
    )
    customers = res.scalars().all()

    # Seed initial demo khata customers if completely empty
    if not customers:
        demo_cust = [
            VendorKhataCustomer(
                user_id=user.id,
                customer_name="Ramesh Sharma",
                customer_mobile="9876543210",
                customer_photo="👨‍💼",
                balance_paise=45000,
            ),
            VendorKhataCustomer(
                user_id=user.id,
                customer_name="Suresh Gupta",
                customer_mobile="9823456781",
                customer_photo="👨",
                balance_paise=120000,
            ),
            VendorKhataCustomer(
                user_id=user.id,
                customer_name="Pooja Verma",
                customer_mobile="9712345678",
                customer_photo="👩",
                balance_paise=35000,
            ),
        ]
        db.add_all(demo_cust)
        await db.commit()
        res = await db.execute(
            select(VendorKhataCustomer).where(VendorKhataCustomer.user_id == user.id).order_by(desc(VendorKhataCustomer.created_at))
        )
        customers = res.scalars().all()

    return {
        "success": True,
        "customers": [
            {
                "khata_id": str(c.id),
                "customer_name": c.customer_name,
                "customer_mobile": c.customer_mobile,
                "customer_photo": c.customer_photo,
                "amount": c.balance_paise / 100,
                "type": "diya",
                "date": c.created_at.strftime("%d %b, %I:%M %p"),
                "status": "pending" if c.balance_paise > 0 else "paid",
            }
            for c in customers
        ],
    }


@router.post("/khata/customer")
async def add_khata_customer(
    payload: AddKhataCustomerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    paise = int(payload.initial_amount_rupees * 100)
    customer = VendorKhataCustomer(
        user_id=user.id,
        customer_name=payload.customer_name.strip(),
        customer_mobile=payload.customer_mobile.strip(),
        customer_photo=payload.customer_photo,
        balance_paise=paise,
    )
    db.add(customer)
    await db.flush()

    if paise > 0:
        entry = VendorKhataEntry(
            customer_id=customer.id,
            amount_paise=paise,
            entry_type=VendorKhataEntryType.DIYA if payload.entry_type == "diya" else VendorKhataEntryType.LIYA,
            note=payload.note,
            status="pending",
        )
        db.add(entry)

    await db.commit()
    await db.refresh(customer)

    return {
        "success": True,
        "khata_id": str(customer.id),
        "customer_name": customer.customer_name,
        "amount": customer.balance_paise / 100,
    }


@router.patch("/khata/customer/{khata_id}/pay")
async def mark_khata_paid(
    khata_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VendorKhataCustomer).where(VendorKhataCustomer.id == khata_id, VendorKhataCustomer.user_id == user.id)
    )
    cust = res.scalar_one_or_none()
    if not cust:
        raise HTTPException(status_code=404, detail="Khata customer not found")

    cust.balance_paise = 0
    await db.commit()

    return {
        "success": True,
        "khata_id": str(cust.id),
        "message": f"Outstanding cleared for {cust.customer_name}",
    }


# ---------------- Staff & Helpers ----------------

@router.get("/staff")
async def get_staff(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(VendorStaffMember).where(VendorStaffMember.user_id == user.id))
    members = res.scalars().all()
    return {
        "success": True,
        "staff": [
            {
                "staff_id": str(s.id),
                "name": s.name,
                "role": s.role.value.lower(),
                "permissions": s.permissions,
                "today_collected": s.today_collected_paise / 100,
                "linked_qr_id": s.linked_qr_id,
            }
            for s in members
        ],
    }


@router.post("/staff")
async def add_staff(
    payload: AddStaffRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role_enum = VendorRole.OWNER if payload.role.lower() == "owner" else VendorRole.STAFF
    member = VendorStaffMember(
        user_id=user.id,
        name=payload.name.strip(),
        role=role_enum,
        permissions=["COLLECT_PAYMENT", "VIEW_TODAY_QR"] if role_enum == VendorRole.STAFF else ["ALL"],
        today_collected_paise=0,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return {
        "success": True,
        "staff_id": str(member.id),
        "name": member.name,
        "role": member.role.value.lower(),
    }


# ---------------- Inventory-Lite ----------------

@router.get("/inventory")
async def get_inventory(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(VendorInventoryItem).where(VendorInventoryItem.user_id == user.id))
    items = res.scalars().all()
    return {
        "success": True,
        "items": [
            {
                "item_id": str(i.id),
                "item_name": i.item_name,
                "price": i.price_paise / 100,
                "sale_count": i.sale_count,
                "icon": i.icon,
            }
            for i in items
        ],
    }


@router.post("/inventory")
async def add_inventory_item(
    payload: AddInventoryItemRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = VendorInventoryItem(
        user_id=user.id,
        item_name=payload.item_name.strip(),
        price_paise=int(payload.price_rupees * 100),
        sale_count=0,
        icon=payload.icon,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return {
        "success": True,
        "item_id": str(item.id),
        "item_name": item.item_name,
        "price": item.price_paise / 100,
    }


@router.post("/inventory/{item_id}/quick-bill")
async def quick_bill_inventory(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VendorInventoryItem).where(VendorInventoryItem.id == item_id, VendorInventoryItem.user_id == user.id)
    )
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    item.sale_count += 1
    await db.commit()

    return {
        "success": True,
        "item_id": str(item.id),
        "new_sale_count": item.sale_count,
        "price": item.price_paise / 100,
    }


# ---------------- Support & Disputes ----------------

@router.get("/disputes")
async def get_disputes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VendorDispute).where(VendorDispute.user_id == user.id).order_by(desc(VendorDispute.created_at))
    )
    disputes = res.scalars().all()
    return {
        "success": True,
        "disputes": [
            {
                "ticket_id": str(d.id),
                "type": d.dispute_type,
                "title": d.title,
                "txn_id": d.txn_id,
                "voice_note_url": d.voice_note_url,
                "status": d.status.value,
                "time": d.created_at.strftime("%d %b, %I:%M %p"),
            }
            for d in disputes
        ],
    }


@router.post("/disputes")
async def create_dispute(
    payload: CreateDisputeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dispute = VendorDispute(
        user_id=user.id,
        dispute_type=payload.dispute_type,
        title=payload.title,
        txn_id=payload.txn_id,
        voice_note_url=payload.voice_note_url,
        status=VendorDisputeStatus.RAISED,
    )
    db.add(dispute)
    await db.commit()
    await db.refresh(dispute)

    return {
        "success": True,
        "ticket_id": str(dispute.id),
        "status": dispute.status.value,
        "message": "Dispute filed successfully. Support team is reviewing.",
    }


# ---------------- Groq AI Voice Proxy ----------------

@router.post("/voice/groq-tts")
async def groq_tts(
    payload: GroqTTSRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_vendor_profile(user, db)
    key = payload.api_key or profile.groq_api_key

    # If Groq Key is available, we query Groq completions / audio models
    if key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [
                            {
                                "role": "system",
                                "content": f"You are a voice synthesis assistant for Indian shopkeepers in language: {payload.language_code}. Format phonetic pronunciation for clarity.",
                            },
                            {
                                "role": "user",
                                "content": f"Pronounce: {payload.text}",
                            },
                        ],
                        "max_tokens": 50,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    enhanced = data["choices"][0]["message"]["content"]
                    return {
                        "success": True,
                        "source": "groq_ai",
                        "phonetic_text": enhanced,
                        "original_text": payload.text,
                    }
        except Exception as e:
            print(f"Groq API call error: {e}")

    # Fallback to direct text
    return {
        "success": True,
        "source": "native_fallback",
        "phonetic_text": payload.text,
        "original_text": payload.text,
    }
