"""
SMS delivery abstraction for OTPs. Swapping providers is a one-line
change in `get_sms_provider()` — nothing in app/routers/auth.py needs
to know which provider is active.

Two providers ship here:
- ConsoleSMSProvider: logs the OTP instead of sending it. This is what
  runs by default (SMS_PROVIDER=console) so the app works out of the
  box without any SMS account — exactly what auth.py's `debug_otp`
  response field was standing in for before this abstraction existed.
- TwilioSMSProvider: real implementation using the Twilio SDK. Needs
  TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER set, and
  the `twilio` package installed (not in requirements.txt by default,
  since most local/demo setups won't need it — add it when you flip
  SMS_PROVIDER=twilio for a real deployment).
"""
import asyncio
import logging
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger("renopay.sms")


class SMSProvider(ABC):
    @abstractmethod
    async def send_otp(self, phone_number: str, otp: str) -> None:
        ...


class ConsoleSMSProvider(SMSProvider):
    """Default provider. Logs the OTP server-side instead of sending a
    real SMS — fine for local dev and demos, NOT for anything touching
    real phone numbers in production."""
    async def send_otp(self, phone_number: str, otp: str) -> None:
        logger.info(f"[DEV SMS] OTP for {phone_number}: {otp}")


class TwilioSMSProvider(SMSProvider):
    def __init__(self):
        # Imported lazily so the `twilio` package is only required when
        # this provider is actually selected.
        from twilio.rest import Client
        self._client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    async def send_otp(self, phone_number: str, otp: str) -> None:
        await asyncio.to_thread(
            self._client.messages.create,
            body=f"Your RenoPay verification code is {otp}. Valid for {settings.OTP_EXPIRE_SECONDS // 60} minutes.",
            from_=settings.TWILIO_FROM_NUMBER,
            to=f"+91{phone_number}" if not phone_number.startswith("+") else phone_number,
        )


_provider_instance: SMSProvider | None = None


def get_sms_provider() -> SMSProvider:
    global _provider_instance
    if _provider_instance is None:
        if settings.SMS_PROVIDER == "twilio":
            _provider_instance = TwilioSMSProvider()
        else:
            _provider_instance = ConsoleSMSProvider()
    return _provider_instance
