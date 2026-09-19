import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class CreateGiftCardRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in Rupees e.g. 500.00")
    pin: str = Field(..., min_length=4, max_length=6, description="UPI PIN")
    payment_mode: str = Field("normal", description="Payment mode: normal or advance")
    recipient_name: str | None = Field(None, max_length=100)
    message: str | None = Field(None, max_length=255)
    theme: str = Field("gold", max_length=40)


class ClaimGiftCardRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32, description="Unique Gift Card code e.g. RENO-GIFT-ABCD-1234")


class GiftCardOut(BaseModel):
    id: uuid.UUID
    card_code: str
    amount: float
    theme: str
    payment_mode: str = "normal"
    recipient_name: str | None = None
    message: str | None = None
    status: str
    created_at: datetime
    expiry_at: datetime
    claimed_at: datetime | None = None
    creator_name: str | None = None
    claimed_by_name: str | None = None
    creation_txn_ref: str
    claim_txn_ref: str | None = None


    class Config:
        from_attributes = True


class GiftCardClaimResult(BaseModel):
    success: bool
    amount: float
    card_code: str
    message: str
    new_balance: float
    claimed_at: datetime
