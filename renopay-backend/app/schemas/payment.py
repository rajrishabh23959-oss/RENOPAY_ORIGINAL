from datetime import datetime
from pydantic import BaseModel, Field

from app.core.money import paise_to_rupees


class ResolveVPAResponse(BaseModel):
    vpa: str
    name: str


class SendMoneyRequest(BaseModel):
    to_vpa: str
    amount: float = Field(gt=0)
    pin: str | None = Field(default=None, min_length=6, max_length=6)
    description: str | None = "UPI Transfer"
    category: str = "Other"
    device_fingerprint: str | None = None
    current_lat: float | None = None
    current_lng: float | None = None
    note_slide_ms: int | None = None
    note_count: int = 0
    device_tilt_deg: float | None = None
    use_upi_lite: bool = False
    idempotency_key: str | None = Field(default=None, max_length=100)


class SendMoneyResponse(BaseModel):
    success: bool
    txn_ref: str
    amount: float
    round_up: float
    new_balance: float
    trust_score: int
    risk_level: str


class TransactionOut(BaseModel):
    txn_ref: str
    type: str
    status: str
    category: str
    amount: float
    round_up: float
    description: str | None
    counterparty_vpa: str
    counterparty_name: str | None
    trust_score: int
    created_at: datetime

    @classmethod
    def from_model(cls, t) -> "TransactionOut":
        return cls(
            txn_ref=t.txn_ref, type=t.type.value if hasattr(t.type, "value") else t.type,
            status=t.status.value if hasattr(t.status, "value") else t.status,
            category=t.category.value if hasattr(t.category, "value") else t.category,
            amount=paise_to_rupees(t.amount_paise),
            round_up=paise_to_rupees(t.round_up_paise or 0),
            description=t.description,
            counterparty_vpa=t.counterparty_vpa,
            counterparty_name=t.counterparty_name,
            trust_score=t.trust_score,
            created_at=t.created_at,
        )


class AddMoneyRequest(BaseModel):
    amount: float = Field(gt=0)
    bank_name: str
