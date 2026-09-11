import enum
import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, BigInteger, Enum, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPKMixin, TimestampMixin


class RewardType(str, enum.Enum):
    CASHBACK = "cashback"
    GOLD = "gold"


class ScratchCard(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "scratch_cards"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scratched: Mapped[bool] = mapped_column(Boolean, default=False)
    reward_type: Mapped[RewardType] = mapped_column(Enum(RewardType, name="reward_type"))
    reward_amount_paise: Mapped[int] = mapped_column(BigInteger)
    label: Mapped[str] = mapped_column(String(60))
    # Which transaction earned this card — for audit/analytics
    source_txn_group_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
