import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.money import paise_to_rupees


# ---------- Money requests / bill split ----------
class CreateRequestRequest(BaseModel):
    to_vpa: str
    amount: float = Field(gt=0)
    note: str | None = None


class SplitPersonInput(BaseModel):
    name: str
    vpa: str


class CreateSplitRequest(BaseModel):
    total_bill: float = Field(gt=0)
    description: str | None = None
    people: list[SplitPersonInput]


class MoneyRequestOut(BaseModel):
    id: uuid.UUID
    from_vpa: str
    to_vpa: str
    amount: float
    note: str | None
    status: str
    created_at: datetime

    @classmethod
    def from_model(cls, r) -> "MoneyRequestOut":
        return cls(
            id=r.id, from_vpa=r.from_vpa, to_vpa=r.to_vpa,
            amount=paise_to_rupees(r.amount_paise), note=r.note,
            status=r.status.value if hasattr(r.status, "value") else r.status,
            created_at=r.created_at,
        )


# ---------- Mandates ----------
class CreateMandateRequest(BaseModel):
    name: str
    icon: str = "📦"
    merchant_vpa: str
    amount: float = Field(gt=0)
    max_limit: float = Field(gt=0)
    frequency: str  # monthly | quarterly | yearly
    category: str = "Bills"
    pin: str = Field(min_length=6, max_length=6)


class MandateOut(BaseModel):
    id: uuid.UUID
    name: str
    icon: str
    merchant_vpa: str
    amount: float
    max_limit: float
    frequency: str
    status: str
    next_payment_at: datetime
    category: str

    @classmethod
    def from_model(cls, m) -> "MandateOut":
        return cls(
            id=m.id, name=m.name, icon=m.icon, merchant_vpa=m.merchant_vpa,
            amount=paise_to_rupees(m.amount_paise), max_limit=paise_to_rupees(m.max_limit_paise),
            frequency=m.frequency.value if hasattr(m.frequency, "value") else m.frequency,
            status=m.status.value if hasattr(m.status, "value") else m.status,
            next_payment_at=m.next_payment_at, category=m.category,
        )


# ---------- Scratch cards / rewards ----------
class ScratchCardOut(BaseModel):
    id: uuid.UUID
    scratched: bool
    is_withdrawn: bool = False
    reward_type: str
    reward_amount: float
    label: str
    expires_at: datetime
    created_at: datetime | None = None

    @classmethod
    def from_model(cls, c) -> "ScratchCardOut":
        return cls(
            id=c.id,
            scratched=c.scratched,
            is_withdrawn=getattr(c, "is_withdrawn", False),
            reward_type=c.reward_type.value if hasattr(c.reward_type, "value") else c.reward_type,
            reward_amount=paise_to_rupees(c.reward_amount_paise),
            label=c.label,
            expires_at=c.expires_at,
            created_at=getattr(c, "created_at", None),
        )


class ScratchResultOut(BaseModel):
    success: bool
    reward_type: str | None = None
    reward_amount: float | None = None
    new_balance: float | None = None
    new_digital_gold: float | None = None


class RewardSummaryOut(BaseModel):
    total_received: float
    available_balance: float
    withdrawn_total: float
    unscratched_count: int
    cards: list[ScratchCardOut]


class WithdrawRewardRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6)


class WithdrawRewardOut(BaseModel):
    success: bool
    withdrawn_amount: float
    new_balance: float
    message: str


# ---------- Savings goals ----------
class CreateGoalRequest(BaseModel):
    name: str
    icon: str = "🎯"
    target: float = Field(gt=0)


class AddSavingsRequest(BaseModel):
    amount: float = Field(gt=0)
    pin: str = Field(min_length=6, max_length=6)


class SavingsGoalOut(BaseModel):
    id: uuid.UUID
    name: str
    icon: str
    target: float
    saved: float
    milestones: list[float]
    auto_save_enabled: bool = False
    auto_save_amount: float = 0

    @classmethod
    def from_model(cls, g) -> "SavingsGoalOut":
        return cls(
            id=g.id, name=g.name, icon=g.icon,
            target=paise_to_rupees(g.target_paise), saved=paise_to_rupees(g.saved_paise),
            milestones=[paise_to_rupees(m) for m in (g.milestones_paise or [])],
            auto_save_enabled=g.auto_save_enabled,
            auto_save_amount=paise_to_rupees(g.auto_save_paise),
        )


# ---------- Shared vaults ----------
class CreateVaultRequest(BaseModel):
    name: str
    icon: str = "🏖️"
    target: float = Field(gt=0)
    member_phone_numbers: list[str] = []


class ContributeVaultRequest(BaseModel):
    amount: float = Field(gt=0)
    pin: str = Field(min_length=6, max_length=6)


class VaultLogOut(BaseModel):
    user_name: str
    amount: float
    log_type: str
    created_at: datetime


class SharedVaultOut(BaseModel):
    id: uuid.UUID
    name: str
    icon: str
    target: float
    balance: float
    logs: list[VaultLogOut] = []


# ---------- UPI Lite ----------
class LiteTopUpRequest(BaseModel):
    amount: float = Field(gt=0)
    pin: str = Field(min_length=6, max_length=6)


class LitePayRequest(BaseModel):
    to_vpa: str
    amount: float = Field(gt=0)


# ---------- Analytics ----------
class BudgetPredictionOut(BaseModel):
    status: str  # safe | caution | critical
    level: str
    message: str
    daily_burn_rate: float


class ExpenseByCategory(BaseModel):
    category: str
    amount: float
    percent: float


class ExpenseSummaryOut(BaseModel):
    total_spent: float
    total_income: float
    net: float
    budget: float
    budget_used_percent: float
    by_category: list[ExpenseByCategory]
