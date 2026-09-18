import enum
import uuid
from typing import Any
from sqlalchemy import String, ForeignKey, BigInteger, Enum, Boolean, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin


class VendorRole(str, enum.Enum):
    OWNER = "OWNER"
    STAFF = "STAFF"


class VendorQRType(str, enum.Enum):
    STATIC = "STATIC"
    DYNAMIC = "DYNAMIC"


class VendorSettlementStatus(str, enum.Enum):
    SETTLED = "SETTLED"
    PENDING = "PENDING"


class VendorRefundStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class VendorKhataEntryType(str, enum.Enum):
    DIYA = "DIYA"   # Credit given to customer (receivable)
    LIYA = "LIYA"   # Advance taken from customer (payable)


class VendorDisputeStatus(str, enum.Enum):
    RAISED = "RAISED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class VendorProfile(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    store_name: Mapped[str] = mapped_column(String(120), default="RenoPay Kirana Store")
    language_code: Mapped[str] = mapped_column(String(10), default="hi")  # hi | en | te | ta | ml
    groq_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    rating: Mapped[float] = mapped_column(Float, default=4.9)
    total_ratings_count: Mapped[int] = mapped_column(BigInteger, default=142)


class VendorQRRecord(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_qr_records"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    qr_type: Mapped[VendorQRType] = mapped_column(Enum(VendorQRType, name="vendor_qr_type"), default=VendorQRType.STATIC)
    linked_amount_paise: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)


class VendorSettlement(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_settlements"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[VendorSettlementStatus] = mapped_column(
        Enum(VendorSettlementStatus, name="vendor_settlement_status"), default=VendorSettlementStatus.PENDING
    )
    expected_time: Mapped[str] = mapped_column(String(100), default="Tomorrow by 10:00 AM")
    utr_ref: Mapped[str] = mapped_column(String(60), index=True)
    bank_account_mask: Mapped[str] = mapped_column(String(40), default="HDFC Bank •••• 4120")
    cycle: Mapped[str] = mapped_column(String(50), default="Daily Auto-Settlement (T+1)")


class VendorRefund(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_refunds"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    original_txn_id: Mapped[str] = mapped_column(String(100), index=True)
    customer_name: Mapped[str] = mapped_column(String(100), default="Customer")
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[VendorRefundStatus] = mapped_column(
        Enum(VendorRefundStatus, name="vendor_refund_status"), default=VendorRefundStatus.COMPLETED
    )


class VendorKhataCustomer(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_khata_customers"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_photo: Mapped[str] = mapped_column(String(50), default="👤")
    balance_paise: Mapped[int] = mapped_column(BigInteger, default=0)

    entries: Mapped[list["VendorKhataEntry"]] = relationship("VendorKhataEntry", back_populates="customer", cascade="all, delete-orphan")


class VendorKhataEntry(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_khata_entries"

    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendor_khata_customers.id", ondelete="CASCADE"), index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    entry_type: Mapped[VendorKhataEntryType] = mapped_column(Enum(VendorKhataEntryType, name="vendor_khata_entry_type"))
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | paid

    customer: Mapped["VendorKhataCustomer"] = relationship("VendorKhataCustomer", back_populates="entries")


class VendorStaffMember(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_staff_members"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[VendorRole] = mapped_column(Enum(VendorRole, name="vendor_role"), default=VendorRole.STAFF)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)
    today_collected_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    linked_qr_id: Mapped[str | None] = mapped_column(String(80), nullable=True)


class VendorInventoryItem(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_inventory_items"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sale_count: Mapped[int] = mapped_column(BigInteger, default=0)
    icon: Mapped[str] = mapped_column(String(20), default="📦")


class VendorDispute(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "vendor_disputes"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    txn_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dispute_type: Mapped[str] = mapped_column(String(60), default="PAYMENT_NOT_RECEIVED")
    title: Mapped[str] = mapped_column(String(255))
    voice_note_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[VendorDisputeStatus] = mapped_column(
        Enum(VendorDisputeStatus, name="vendor_dispute_status"), default=VendorDisputeStatus.RAISED
    )
