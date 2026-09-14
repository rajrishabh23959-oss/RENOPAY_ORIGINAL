import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, ForeignKey, BigInteger, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.account import Account


class Loan(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "loans"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)

    loan_code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    loan_type: Mapped[str] = mapped_column(String(60), default="Personal Loan")
    lender: Mapped[str] = mapped_column(String(120), default="HDFC Bank & RenoPay Credit")

    principal_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    remaining_amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    monthly_emi_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tenure_months: Mapped[int] = mapped_column(Integer, default=12)
    emis_paid: Mapped[int] = mapped_column(Integer, default=0)
    interest_rate: Mapped[float] = mapped_column(Float, default=11.5)

    next_due_date: Mapped[str] = mapped_column(String(30))
    disbursed_at: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    disbursal_txn_ref: Mapped[str | None] = mapped_column(String(60), nullable=True)

    user: Mapped["User"] = relationship()
    account: Mapped["Account"] = relationship()


class Investment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "investments"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)

    investment_code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    investment_type: Mapped[str] = mapped_column(String(30))  # "sip", "daily_sip", "daily_rd"
    fund_name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), default="Equity Growth")

    monthly_amount_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    invested_amount_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    current_value_paise: Mapped[int] = mapped_column(BigInteger, default=0)

    next_debit_date: Mapped[str] = mapped_column(String(40), default="5th of month")
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    txn_ref: Mapped[str | None] = mapped_column(String(60), nullable=True)

    user: Mapped["User"] = relationship()
    account: Mapped["Account"] = relationship()


class BillPayment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "bill_payments"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)

    bill_type: Mapped[str] = mapped_column(String(40))  # "mobile_recharge", "electricity_bill", "tuition_fee", "utility"
    operator: Mapped[str] = mapped_column(String(120))
    consumer_number: Mapped[str] = mapped_column(String(60))
    recipient_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    plan_details: Mapped[str | None] = mapped_column(String(255), nullable=True)

    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    txn_ref: Mapped[str] = mapped_column(String(60), index=True)
    status: Mapped[str] = mapped_column(String(20), default="SUCCESS")

    user: Mapped["User"] = relationship()
    account: Mapped["Account"] = relationship()
