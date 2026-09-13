import uuid
from pydantic import BaseModel, Field

from app.core.money import paise_to_rupees
from app.services.denomination_service import ensure_denominations


class AccountOut(BaseModel):
    vpa: str
    virtual_acc_no: str
    ifsc_code: str
    linked_bank_name: str
    balance: float
    upi_lite_balance: float
    digital_gold: float
    round_up_enabled: bool
    monthly_budget: float
    cash_denominations: dict[str, int] = Field(default_factory=dict)

    @classmethod
    def from_model(cls, acc) -> "AccountOut":
        denoms = ensure_denominations(getattr(acc, "cash_denominations", None), acc.current_balance_paise)
        return cls(
            vpa=acc.vpa,
            virtual_acc_no=acc.virtual_acc_no,
            ifsc_code=acc.ifsc_code,
            linked_bank_name=acc.linked_bank_name,
            balance=paise_to_rupees(acc.current_balance_paise),
            upi_lite_balance=paise_to_rupees(acc.upi_lite_balance_paise),
            digital_gold=paise_to_rupees(acc.digital_gold_paise),
            round_up_enabled=acc.round_up_enabled,
            monthly_budget=paise_to_rupees(acc.monthly_budget_paise),
            cash_denominations=denoms,
        )


class ProfileOut(BaseModel):
    id: uuid.UUID
    full_name: str
    phone_number: str
    kyc_status: str
    avatar_url: str | None
    account: AccountOut
    has_upi_pin: bool
    is_trusted_device: bool = False
    language_code: str = "en"


class ToggleRoundUpRequest(BaseModel):
    enabled: bool


class UpdateBudgetRequest(BaseModel):
    monthly_budget: float = Field(gt=0)


class UserPreferencesUpdate(BaseModel):
    language_code: str = Field(..., pattern="^(en|hi|ta|te|ml)$", description="Supported: en, hi, ta, te, ml")

