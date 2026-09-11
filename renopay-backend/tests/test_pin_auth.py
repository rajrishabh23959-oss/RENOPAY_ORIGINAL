"""
Tests for the shared PIN helper (app/services/pin_auth.py) in isolation
from the payment engine — this is what goals.py, vaults.py, lite.py,
and mandates.py all call directly for their own PIN gates.
"""
import pytest

from app.services.pin_auth import verify_user_pin, PinError
from tests.conftest import make_user_with_account

pytestmark = pytest.mark.asyncio


async def test_correct_pin_passes_and_resets_attempts(db_session):
    user, _ = await make_user_with_account(
        db_session, name="Pin Tester", phone="9100000001", pin="654321", balance_paise=0
    )
    user.pin_failed_attempts = 3  # simulate some prior failures
    await verify_user_pin(db_session, user, "654321")
    assert user.pin_failed_attempts == 0
    assert user.pin_locked_until is None


async def test_wrong_pin_raises_and_increments_attempts(db_session):
    user, _ = await make_user_with_account(
        db_session, name="Pin Tester Two", phone="9100000002", pin="654321", balance_paise=0
    )
    with pytest.raises(PinError) as exc_info:
        await verify_user_pin(db_session, user, "000000")
    assert exc_info.value.code == "invalid_pin"
    assert user.pin_failed_attempts == 1


async def test_lockout_after_max_attempts_blocks_even_correct_pin(db_session):
    user, _ = await make_user_with_account(
        db_session, name="Pin Tester Three", phone="9100000003", pin="654321", balance_paise=0
    )
    for _ in range(5):
        with pytest.raises(PinError):
            await verify_user_pin(db_session, user, "000000")

    with pytest.raises(PinError) as exc_info:
        await verify_user_pin(db_session, user, "654321")  # correct PIN, but locked
    assert exc_info.value.code == "pin_locked"


async def test_missing_pin_is_treated_as_invalid(db_session):
    user, _ = await make_user_with_account(
        db_session, name="Pin Tester Four", phone="9100000004", pin="654321", balance_paise=0
    )
    with pytest.raises(PinError) as exc_info:
        await verify_user_pin(db_session, user, None)
    assert exc_info.value.code == "invalid_pin"


async def test_pin_not_set_raises_specific_error(db_session):
    user, _ = await make_user_with_account(
        db_session, name="No Pin User", phone="9100000005", pin="654321", balance_paise=0
    )
    user.pin_hash = None  # simulate new optional-pin flow
    with pytest.raises(PinError) as exc_info:
        await verify_user_pin(db_session, user, "123456")
    assert exc_info.value.code == "pin_not_set"
