import uuid

from sqlalchemy import String, ForeignKey, BigInteger, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin


class SavingsGoal(Base, UUIDPKMixin, TimestampMixin):
    """Individual goal — the 'Treasure Map' feature."""
    __tablename__ = "savings_goals"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(10), default="🎯")
    target_paise: Mapped[int] = mapped_column(BigInteger)
    saved_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    milestones_paise: Mapped[list[int]] = mapped_column(JSON, default=list)
    auto_save_enabled: Mapped[bool] = mapped_column(default=False)
    auto_save_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    last_celebrated_pct: Mapped[int] = mapped_column(default=0)  # track last milestone celebrated


class SharedVault(Base, UUIDPKMixin, TimestampMixin):
    """Group savings pot — multiple users contribute towards one target."""
    __tablename__ = "shared_vaults"

    name: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(10), default="🏖️")
    target_paise: Mapped[int] = mapped_column(BigInteger)
    balance_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    members: Mapped[list["SharedVaultMember"]] = relationship(back_populates="vault", cascade="all, delete-orphan")
    logs: Mapped[list["SharedVaultLog"]] = relationship(back_populates="vault", cascade="all, delete-orphan")
    withdrawal_requests: Mapped[list["SharedVaultWithdrawalRequest"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )


class SharedVaultMember(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "shared_vault_members"

    vault_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shared_vaults.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    vault: Mapped["SharedVault"] = relationship(back_populates="members")


class SharedVaultLog(Base, UUIDPKMixin, TimestampMixin):
    """Append-only contribution history, shown in the vault's activity feed."""
    __tablename__ = "shared_vault_logs"

    vault_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shared_vaults.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    log_type: Mapped[str] = mapped_column(String(20), default="contribution")  # contribution | withdrawal | refund

    vault: Mapped["SharedVault"] = relationship(back_populates="logs")


class SharedVaultWithdrawalRequest(Base, UUIDPKMixin, TimestampMixin):
    """Multi-party consensus withdrawal request. Requires all vault members to approve with UPI PIN."""
    __tablename__ = "shared_vault_withdrawal_requests"

    vault_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shared_vaults.id", ondelete="CASCADE"), index=True)
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | completed | rejected | cancelled
    approvals: Mapped[list[str]] = mapped_column(JSON, default=list)  # list of user_id UUID strings

    vault: Mapped["SharedVault"] = relationship(back_populates="withdrawal_requests")
