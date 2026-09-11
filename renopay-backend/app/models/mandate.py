import enum
import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, BigInteger, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPKMixin, TimestampMixin


class MandateFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class MandateStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class Mandate(Base, UUIDPKMixin, TimestampMixin):
    """
    Recurring auto-pay authorization (Netflix, AWS, etc). A scheduled
    job (see app/services/scheduler.py) scans `next_payment_at <= now()`
    for ACTIVE mandates and routes them through the SAME payment engine
    used for manual payments — no separate "auto-pay money movement"
    code path, which is important: one engine, one set of guarantees.
    """
    __tablename__ = "mandates"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(10), default="📦")
    merchant_vpa: Mapped[str] = mapped_column(String(80))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    max_limit_paise: Mapped[int] = mapped_column(BigInteger)
    frequency: Mapped[MandateFrequency] = mapped_column(Enum(MandateFrequency, name="mandate_frequency"))
    status: Mapped[MandateStatus] = mapped_column(
        Enum(MandateStatus, name="mandate_status"), default=MandateStatus.ACTIVE
    )
    next_payment_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    category: Mapped[str] = mapped_column(String(40), default="Bills")
