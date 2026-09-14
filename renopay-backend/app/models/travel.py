import enum
import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, ForeignKey, BigInteger, Enum, Float, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.account import Account


class TravelBookingType(str, enum.Enum):
    FLIGHT = "flight"
    TRAIN = "train"
    BUS = "bus"
    HOTEL = "hotel"


class TravelBookingStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class TravelBooking(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "travel_bookings"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)

    booking_type: Mapped[TravelBookingType] = mapped_column(
        Enum(TravelBookingType, name="travel_booking_type"),
        nullable=False,
        index=True,
    )
    pnr_or_ticket_no: Mapped[str] = mapped_column(String(60), unique=True, index=True)

    operator_name: Mapped[str] = mapped_column(String(120), nullable=False)
    service_number: Mapped[str | None] = mapped_column(String(60), nullable=True)

    from_location: Mapped[str] = mapped_column(String(120), nullable=False)
    to_location: Mapped[str] = mapped_column(String(120), nullable=False)

    departure_date: Mapped[str] = mapped_column(String(30), nullable=False)
    departure_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    arrival_date: Mapped[str | None] = mapped_column(String(30), nullable=True)
    arrival_time: Mapped[str | None] = mapped_column(String(30), nullable=True)

    distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    travel_class: Mapped[str] = mapped_column(String(60), nullable=False)

    passenger_name: Mapped[str] = mapped_column(String(120), nullable=False)
    passenger_details: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    seat_or_room_no: Mapped[str | None] = mapped_column(String(60), nullable=True)

    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    base_fare_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    tax_paise: Mapped[int] = mapped_column(BigInteger, default=0)

    txn_ref: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    status: Mapped[TravelBookingStatus] = mapped_column(
        Enum(TravelBookingStatus, name="travel_booking_status"),
        default=TravelBookingStatus.CONFIRMED,
        nullable=False,
    )

    user: Mapped["User"] = relationship()
    account: Mapped["Account"] = relationship()
