import pytest
from app.routers.auth import register, login
from app.schemas.auth import RegisterRequest, LoginRequest
from app.models.user import User
from app.models.account import Account
from sqlalchemy import select

@pytest.mark.asyncio
async def test_register_without_otp(db_session):
    phone = "9876543210"
    payload = RegisterRequest(
        full_name="Rishab Raj",
        phone_number=phone,
        email="test@example.com",
    )
    res = await register(payload, db=db_session)
    assert res.access_token is not None
    assert res.refresh_token is not None
    assert res.user_id is not None

    # Check user was created
    u_res = await db_session.execute(select(User).where(User.phone_number == phone))
    user = u_res.scalar_one_or_none()
    assert user is not None
    assert user.full_name == "Rishab Raj"

    # Check account was created
    acc_res = await db_session.execute(select(Account).where(Account.user_id == user.id))
    account = acc_res.scalar_one_or_none()
    assert account is not None
    assert account.vpa.startswith("rishabraj")

@pytest.mark.asyncio
async def test_register_existing_phone_logs_in(db_session):
    phone = "9876543211"
    payload = RegisterRequest(
        full_name="User One",
        phone_number=phone,
        email="user1@example.com",
    )
    res1 = await register(payload, db=db_session)
    res2 = await register(payload, db=db_session)
    assert res1.user_id == res2.user_id

@pytest.mark.asyncio
async def test_login_without_pin_or_otp(db_session):
    phone = "9876543212"
    payload = RegisterRequest(
        full_name="User Two",
        phone_number=phone,
    )
    reg_res = await register(payload, db=db_session)
    
    # Login with phone only
    login_payload = LoginRequest(phone_number=phone)
    login_res = await login(login_payload, db=db_session)
    assert login_res.user_id == reg_res.user_id
    assert login_res.access_token is not None

