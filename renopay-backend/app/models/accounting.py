import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import String, ForeignKey, BigInteger, Enum, Uuid, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    pass


class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class JournalSource(str, enum.Enum):
    AUTO_TXN = "AUTO_TXN"
    MANUAL = "MANUAL"
    ADJUSTMENT = "ADJUSTMENT"


class ChartOfAccount(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "chart_of_accounts"

    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType, name="account_type"), nullable=False)
    
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("chart_of_accounts.id"), nullable=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)

    hsn_sac_code: Mapped[str | None] = mapped_column(String(20), nullable=True)


class JournalEntry(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "journal_entries"

    entry_no: Mapped[str] = mapped_column(String(40), index=True)  # e.g. JE-000123
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)
    
    txn_group_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), index=True, nullable=True)
    
    narration: Mapped[str] = mapped_column(String(255))
    source: Mapped[JournalSource] = mapped_column(Enum(JournalSource, name="journal_source"), default=JournalSource.AUTO_TXN)
    
    lines: Mapped[list["JournalLine"]] = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan")


class JournalLine(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "journal_lines"

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journal_entries.id"), index=True)
    chart_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chart_of_accounts.id"), index=True)
    
    debit_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    credit_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    
    payee_vpa: Mapped[str | None] = mapped_column(String(80), nullable=True)
    payee_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    
    entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")

    __table_args__ = (
        CheckConstraint(
            "(debit_paise > 0 AND credit_paise = 0) OR (credit_paise > 0 AND debit_paise = 0) OR (debit_paise = 0 AND credit_paise = 0)",
            name="ck_journal_line_debit_credit"
        ),
    )


class LedgerAuditLog(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ledger_audit_logs"

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(20), default="created") # never edited/deleted
    actor: Mapped[str] = mapped_column(String(50)) # system or user_id
    diff: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class InvoiceStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class Invoice(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "invoices"
    
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    invoice_no: Mapped[str] = mapped_column(String(40), index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus, name="invoice_status"), default=InvoiceStatus.PENDING)
    
    # Track the associated journal entries
    creation_journal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("journal_entries.id"), nullable=True)
    payment_journal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("journal_entries.id"), nullable=True)
