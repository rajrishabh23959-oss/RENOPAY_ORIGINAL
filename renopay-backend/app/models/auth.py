import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPKMixin, TimestampMixin


class RefreshToken(Base, UUIDPKMixin, TimestampMixin):
    """
    Refresh tokens are stored HASHED (never plaintext) and rotated on
    every use — if a stolen token is replayed after rotation, we can
    detect reuse and revoke the whole token family.
    """
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    token_lookup_hash: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    device_fingerprint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class OTPChallenge(Base, UUIDPKMixin, TimestampMixin):
    """Short-lived OTP records. In production, prefer Redis (TTL-native)
    over a table — included here so the flow works even without Redis
    configured yet."""
    __tablename__ = "otp_challenges"

    phone_number: Mapped[str] = mapped_column(String(15), index=True)
    otp_hash: Mapped[str] = mapped_column(String(255))
    purpose: Mapped[str] = mapped_column(String(30))  # registration | login | reset_pin
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
