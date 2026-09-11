import uuid
from sqlalchemy import ForeignKey, BigInteger, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDPKMixin, TimestampMixin


class UserGoldPot(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "user_gold_pots"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    balance_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    total_accumulated_paise: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    ledger_entries: Mapped[list["GoldLedger"]] = relationship(back_populates="pot")


class GoldLedger(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "gold_ledger"

    pot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_gold_pots.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    grams_equivalent: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="round_up")

    pot: Mapped["UserGoldPot"] = relationship(back_populates="ledger_entries")