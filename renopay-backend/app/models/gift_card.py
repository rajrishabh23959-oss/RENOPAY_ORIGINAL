import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import String, ForeignKey, BigInteger, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.account import Account


class GiftCard(Base, UUIDPKMixin, TimestampMixin):
    """
    RenoPay Digital Gift Card.
    Funded upon creation by deducting the creator's account balance.
    Can be claimed by any user using the unique `card_code`,
    which credits the amount directly into the claimant's account balance.
    """
    __tablename__ = "gift_cards"

    card_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    
    creator_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    creator_account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )

    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    theme: Mapped[str] = mapped_column(String(40), default="gold", nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)


    status: Mapped[str] = mapped_column(String(20), default="active", index=True, nullable=False)  # active | claimed | expired

    claimed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    claimed_by_account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    creation_txn_ref: Mapped[str] = mapped_column(String(40), nullable=False)
    claim_txn_ref: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Relationships
    creator_user: Mapped["User"] = relationship("User", foreign_keys=[creator_user_id])
    claimed_by_user: Mapped["User | None"] = relationship("User", foreign_keys=[claimed_by_user_id])
