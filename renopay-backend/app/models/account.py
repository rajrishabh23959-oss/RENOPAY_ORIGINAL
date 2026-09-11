import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, ForeignKey, Boolean, BigInteger, CheckConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Account(Base, UUIDPKMixin, TimestampMixin):
    """
    One account per user. ALL money fields are BigInteger paise
    (₹1 = 100 paise) — never float. This avoids the classic
    0.1 + 0.2 != 0.3 floating point bug in a payments system.

    current_balance can never go negative — enforced by CheckConstraint
    AND by row-level locking in the payment engine (belt + suspenders).
    """
    __tablename__ = "accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    virtual_acc_no: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(11), default="RAZR0000001")
    vpa: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    linked_bank_name: Mapped[str] = mapped_column(String(120), default="RenoPay Virtual Bank")

    current_balance_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    upi_lite_balance_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    digital_gold_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    round_up_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # User-configurable budget for the analytics/prediction module.
    # Defaults to ₹15,000 to match the original hardcoded constant, but
    # is now a per-account setting instead of a global.
    monthly_budget_paise: Mapped[int] = mapped_column(BigInteger, default=1_500_000, nullable=False)

    dev_mode_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Physical cash/note breakdown tracking
    cash_denominations: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        CheckConstraint("current_balance_paise >= 0", name="ck_balance_non_negative"),
        CheckConstraint("upi_lite_balance_paise >= 0", name="ck_lite_balance_non_negative"),
        CheckConstraint("digital_gold_paise >= 0", name="ck_gold_non_negative"),
        CheckConstraint("monthly_budget_paise > 0", name="ck_budget_positive"),
    )

    user: Mapped["User"] = relationship(back_populates="account")
