"""
Voice UPI endpoint.

POST /payments/voice-parse

The AUDIO never reaches the backend - only the JSON entity object
extracted by the browser's Web Speech API + on-device NLP parser.

This endpoint:
  1. Validates the extracted entities (amount range, VPA resolution).
  2. Calculates a server-side confidence score.
  3. Returns the resolved recipient name (if VPA found) + confirmation.

The frontend then pre-fills the payment form with the validated data.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account

router = APIRouter()


class VoiceParseRequest(BaseModel):
    amount: float = Field(gt=0, description="Extracted payment amount in rupees")
    recipient: str = Field(min_length=1, description="Raw recipient name/VPA extracted from speech")
    note: str | None = None
    transcript: str | None = None
    confidence: float = Field(ge=0, le=1, default=0.8, description="Browser NLP confidence 0-1")
    language: str = "en"  # en | hi | ta


class VoiceParseResponse(BaseModel):
    success: bool
    resolved_vpa: str | None = None
    resolved_name: str | None = None
    amount: float
    note: str | None
    confidence: float
    message: str
    needs_confirmation: bool


def _resolve_vpa_from_name(recipient: str) -> str:
    """
    Attempt to build a VPA from a spoken name.
    E.g. "Praveen" -> "praveen@renopay"
    In production, this would query your contacts/phonebook API.
    """
    clean = re.sub(r"[^a-zA-Z0-9]", "", recipient).lower()
    return f"{clean}@renopay"


@router.post("/voice-parse", response_model=VoiceParseResponse)
async def voice_parse(
    payload: VoiceParseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate amount bounds
    if payload.amount > 100000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Voice payment amount exceeds limit")

    # Try to resolve recipient to a VPA
    candidate_vpa = payload.recipient if "@" in payload.recipient else _resolve_vpa_from_name(payload.recipient)

    result = await db.execute(
        select(Account).where(Account.vpa == candidate_vpa)
    )
    account = result.scalar_one_or_none()

    # Compute server-side confidence boost if VPA resolved
    server_confidence = payload.confidence
    if account:
        server_confidence = min(1.0, server_confidence + 0.1)

    needs_confirmation = server_confidence < 0.90

    return VoiceParseResponse(
        success=True,
        resolved_vpa=candidate_vpa if account else None,
        resolved_name=None,  # will be fetched by /payments/resolve/{vpa} on frontend
        amount=payload.amount,
        note=payload.note,
        confidence=round(server_confidence, 3),
        needs_confirmation=needs_confirmation,
        message=(
            "Ready to pay — please confirm." if not needs_confirmation
            else "Low confidence — please verify the details before paying."
        ),
    )
