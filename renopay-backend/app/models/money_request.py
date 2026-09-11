import enum
import uuid

from sqlalchemy import String, BigInteger, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPKMixin, TimestampMixin


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    DECLINED = "declined"


class MoneyRequest(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "money_requests"

    from_vpa: Mapped[str] = mapped_column(String(80), index=True)   # requester (wants to receive)
    to_vpa: Mapped[str] = mapped_column(String(80), index=True)     # payer (owes money)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status"), default=RequestStatus.PENDING
    )
    # Bill-splits are just a batch of MoneyRequests sharing this group id
    split_group_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
