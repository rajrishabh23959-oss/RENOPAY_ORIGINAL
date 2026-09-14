import uuid
import pytest
from app.routers.travel import book_travel, get_bookings, get_ticket_pdf, BookTravelRequest
from app.models.travel import TravelBookingType
from tests.conftest import make_user_with_account

pytestmark = pytest.mark.asyncio


async def test_travel_train_booking(db_session):
    user, account = await make_user_with_account(
        db_session, name="Traveler User", phone="9888877777", pin="123456", balance_rupees=5000.0
    )
    initial_balance = account.current_balance_paise

    # 500 km @ 3A (1.8 Rs/km) = 900 Rs
    distance_km = 500.0
    amount = 900.0

    req = BookTravelRequest(
        booking_type=TravelBookingType.TRAIN,
        operator_name="12004 Shatabdi Express",
        service_number="12004",
        from_location="New Delhi (NDLS)",
        to_location="Lucknow (LKO)",
        departure_date="2026-09-20",
        departure_time="06:10 AM",
        arrival_date="2026-09-20",
        arrival_time="11:45 AM",
        distance_km=distance_km,
        travel_class="3rd AC (3A)",
        passenger_name="Traveler User",
        passenger_age=28,
        passenger_gender="Male",
        seat_or_room_no="B2 - 34",
        amount=amount,
        pin="123456",
    )

    booking = await book_travel(payload=req, user=user, account=account, db=db_session)

    assert booking.booking_type == "train"
    assert booking.operator_name == "12004 Shatabdi Express"
    assert booking.amount == 900.0
    assert booking.distance_km == 500.0
    assert booking.travel_class == "3rd AC (3A)"
    assert booking.pnr_or_ticket_no.startswith("PNR-TRA-")
    assert booking.status == "confirmed"

    # Verify balance was debited by 900 Rs (90000 paise)
    await db_session.refresh(account)
    assert account.current_balance_paise == initial_balance - 90000

    # Verify listing
    bookings = await get_bookings(user=user, account=account, db=db_session)
    assert len(bookings) >= 1
    assert bookings[0].id == booking.id

    # Verify PDF generation
    response = await get_ticket_pdf(
        booking_id=uuid.UUID(booking.id),
        user=user,
        account=account,
        db=db_session,
    )
    assert response.media_type in ["application/pdf", "text/html"]
    body = response.body_iterator
    content = b"".join([chunk async for chunk in body]) if hasattr(body, "__aiter__") else body.read()
    assert len(content) > 0


async def test_travel_flight_and_hotel_booking(db_session):
    user, account = await make_user_with_account(
        db_session, name="Sky Traveler", phone="9777766666", pin="654321", balance_rupees=15000.0
    )

    # 1. Flight booking
    flight_req = BookTravelRequest(
        booking_type=TravelBookingType.FLIGHT,
        operator_name="IndiGo",
        service_number="6E-204",
        from_location="Delhi (DEL)",
        to_location="Mumbai (BOM)",
        departure_date="2026-09-25",
        departure_time="07:15 AM",
        arrival_date="2026-09-25",
        arrival_time="09:30 AM",
        distance_km=1150.0,
        travel_class="Economy",
        passenger_name="Sky Traveler",
        passenger_age=30,
        passenger_gender="Female",
        seat_or_room_no="14B",
        amount=4500.0,
        pin="654321",
    )
    flight_booking = await book_travel(payload=flight_req, user=user, account=account, db=db_session)
    assert flight_booking.booking_type == "flight"
    assert flight_booking.amount == 4500.0

    # 2. Hotel booking
    hotel_req = BookTravelRequest(
        booking_type=TravelBookingType.HOTEL,
        operator_name="The Grand Palace",
        from_location="Mumbai",
        to_location="Marine Drive",
        departure_date="2026-09-25",
        arrival_date="2026-09-27",
        distance_km=0.0,
        travel_class="Deluxe Sea View",
        passenger_name="Sky Traveler",
        seat_or_room_no="Room 402",
        amount=5000.0,
        pin="654321",
    )
    hotel_booking = await book_travel(payload=hotel_req, user=user, account=account, db=db_session)
    assert hotel_booking.booking_type == "hotel"
    assert hotel_booking.amount == 5000.0
