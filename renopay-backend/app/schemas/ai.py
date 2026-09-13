import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class AIQueryRequest(BaseModel):
    query_text: str = Field(..., min_length=1, max_length=2000)
    screen_context: str | None = None
    language: str | None = Field(default=None, description="Optional override: en, hi, ta, te, ml")
    session_id: uuid.UUID | None = None


class AIQueryResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    response_text: str
    session_id: uuid.UUID
    provider: str
    model: str
    is_byo: bool
    language: str
    screen_context: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AIConfigOut(BaseModel):
    model_config = {"protected_namespaces": ()}
    provider_name: str
    model_name: str
    masked_key: str | None = None
    is_byo: bool
    is_active: bool
    hourly_rate_limit: dict | None = None


class AIConfigSaveRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    provider_name: str = Field(..., pattern="^(groq|openai|anthropic|gemini)$")
    api_key: str = Field(..., min_length=5, max_length=512)
    model_name: str | None = None


class AIKeyTestRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    provider_name: str = Field(..., pattern="^(groq|openai|anthropic|gemini)$")
    api_key: str = Field(..., min_length=5, max_length=512)
    model_name: str | None = None


class AIMessageOut(BaseModel):
    model_config = {"protected_namespaces": ()}
    id: uuid.UUID
    role: str
    content: str
    provider_used: str | None = None
    model_used: str | None = None
    screen_context: str | None = None
    language: str | None = None
    created_at: datetime


class AISessionOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
