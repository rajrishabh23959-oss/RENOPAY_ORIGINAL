import uuid
from typing import TYPE_CHECKING
from sqlalchemy import String, ForeignKey, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class AIConfig(Base, UUIDPKMixin, TimestampMixin):
    """
    User-specific or platform-level AI Assistant configuration.
    API keys are encrypted with AES-256 / Fernet using FIELD_ENCRYPTION_KEY.
    """
    __tablename__ = "ai_configs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    provider_name: Mapped[str] = mapped_column(String(50), nullable=False)  # groq | openai | anthropic | gemini
    api_key_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User | None"] = relationship("User")


class AIChatSession(Base, UUIDPKMixin, TimestampMixin):
    """
    Chat session for conversation continuity.
    """
    __tablename__ = "ai_chat_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), default="New Chat")

    messages: Mapped[list["AIChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="AIChatMessage.created_at"
    )


class AIChatMessage(Base, UUIDPKMixin, TimestampMixin):
    """
    Individual chat messages in an AI session.
    """
    __tablename__ = "ai_chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    provider_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    screen_context: Mapped[str | None] = mapped_column(String(50), nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)

    session: Mapped["AIChatSession"] = relationship(back_populates="messages")
