import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, ForeignKey, BigInteger, Enum, Integer, Float, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.account import Account


class TxnStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"


class TxnType(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class TxnCategory(str, enum.Enum):
    FOOD = "Food"
    SHOPPING = "Shopping"
    TRANSPORT = "Transport"
    ENTERTAINMENT = "Entertainment"
    BILLS = "Bills"
    HEALTH = "Health"
    EDUCATION = "Education"
    INCOME = "Income"
    OTHER = "Other"


class Transaction(Base, UUIDPKMixin, TimestampMixin):
    """
    APPEND-ONLY LEDGER. Rows are never updated or deleted once written
    (aside from `status` transitioning pending -> success/failed for
    async flows like Add Money). This is what makes Dev Mode's
    double-entry T-account view possible: one real-world payment
    produces TWO rows here — a debit row for the sender's account and
    a credit row for the receiver's — linked by `txn_group_id`.
    """
    __tablename__ = "transactions"

    txn_group_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True)
    txn_ref: Mapped[str] = mapped_column(String(40), unique=True, index=True)  # human-readable e.g. RENO-TXN-XXXX

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)
    counterparty_vpa: Mapped[str] = mapped_column(String(80))
    counterparty_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    type: Mapped[TxnType] = mapped_column(Enum(TxnType, name="txn_type"), nullable=False)
    status: Mapped[TxnStatus] = mapped_column(Enum(TxnStatus, name="txn_status"), default=TxnStatus.SUCCESS)
    category: Mapped[TxnCategory] = mapped_column(Enum(TxnCategory, name="txn_category"), default=TxnCategory.OTHER)

    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    round_up_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    trust_score: Mapped[int] = mapped_column(Integer, default=95)
    is_upi_lite: Mapped[bool] = mapped_column(default=False)

    # snapshot of location at time of txn — used for future geo-velocity checks
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)

    account: Mapped["Account"] = relationship()


class FraudEvent(Base, UUIDPKMixin, TimestampMixin):
    """
    Every SentinAI decision gets logged here — including for ALLOWED
    transactions, not just blocked ones. This audit trail is what lets
    you explain *why* a txn was flagged (to a user, or to a hackathon
    judge asking 'how does your fraud detection actually work').
    """
    __tablename__ = "fraud_events"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    txn_group_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)

    risk_level: Mapped[str] = mapped_column(String(10))  # low | medium | high
    risk_flags: Mapped[str] = mapped_column(String(500))  # comma-joined: "odd_hours,new_device"
    explanations: Mapped[str] = mapped_column(String(1000))
    trust_score: Mapped[int] = mapped_column(Integer)
    blocked: Mapped[bool] = mapped_column(default=False)
    amount_paise: Mapped[int] = mapped_column(BigInteger)

class IdempotencyKey(Base, TimestampMixin):
    """
    Tracks idempotency keys to prevent double-spends on retries.
    """
    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    txn_group_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True)
