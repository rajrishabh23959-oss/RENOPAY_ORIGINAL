"""
Single canonical PIN-verification routine, with lockout. Used by the
payment engine AND by every other endpoint that debits a real balance
or authorizes a recurring debit — savings goals, shared vaults, UPI
Lite top-up, and mandate creation all route through this instead of
duplicating the lockout bookkeeping four separate times.
"""
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import verify_pin
from app.models.user import User


class PinError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


async def verify_user_pin(db, user: User, pin: str | None) -> None:
    """Raises PinError on failure; on success, resets the failed-attempt
    counter. Caller is responsible for committing — this only mutates
    the in-memory `user` object's lockout fields, consistent with how
    the payment engine already handles this (one commit at the end of
    the surrounding operation, not one per check)."""
    if user.pin_locked_until and user.pin_locked_until > datetime.now(timezone.utc):
        raise PinError("pin_locked", "Too many incorrect PIN attempts — try again later")

    if not user.pin_hash:
        raise PinError("pin_not_set", "You must set a PIN before making payments.")

    if not pin or not verify_pin(pin, user.pin_hash):
        user.pin_failed_attempts += 1
        if user.pin_failed_attempts >= settings.MAX_PIN_ATTEMPTS:
            user.pin_locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.PIN_LOCKOUT_MINUTES)
        await db.commit()
        raise PinError("invalid_pin", "Incorrect UPI PIN")

    user.pin_failed_attempts = 0
    user.pin_locked_until = None
