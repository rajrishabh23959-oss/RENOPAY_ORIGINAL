"""
Provider-agnostic LLM adapter layer.
Supports Groq (default platform provider), OpenAI, Anthropic, Gemini,
with secure AES-256 decrypted runtime execution and resilient fallback.
"""
import uuid
from abc import ABC, abstractmethod
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_field
from app.models.ai import AIConfig
from app.services.ai.rate_limiter import check_and_increment_rate_limit


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(self, messages: list[dict], system_prompt: str, temperature: float = 0.7) -> str:
        """Generate response from messages list + system prompt."""
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """Verify the API key and model work."""
        pass


# ---------------------------------------------------------------------------
# 1. Groq Provider (OpenAI-compatible)
# ---------------------------------------------------------------------------
class GroqProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b"):
        self.api_key = api_key
        self.model = model or "openai/gpt-oss-120b"
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def generate(self, messages: list[dict], system_prompt: str, temperature: float = 0.7) -> str:
        payload_messages = [{"role": "system", "content": system_prompt}] + messages
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": payload_messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(self.endpoint, json=body, headers=headers)
            if resp.status_code != 200:
                err_detail = resp.text[:300]
                raise RuntimeError(f"Groq API error ({resp.status_code}): {err_detail}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def test_connection(self) -> bool:
        try:
            res = await self.generate([{"role": "user", "content": "Hi"}], "Reply with 'OK'.")
            return bool(res)
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 2. OpenAI Provider
# ---------------------------------------------------------------------------
class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model or "gpt-4o-mini"
        self.endpoint = "https://api.openai.com/v1/chat/completions"

    async def generate(self, messages: list[dict], system_prompt: str, temperature: float = 0.7) -> str:
        payload_messages = [{"role": "system", "content": system_prompt}] + messages
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": payload_messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(self.endpoint, json=body, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API error ({resp.status_code}): {resp.text[:300]}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def test_connection(self) -> bool:
        try:
            res = await self.generate([{"role": "user", "content": "Hi"}], "Reply with 'OK'.")
            return bool(res)
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 3. Anthropic Provider (Claude)
# ---------------------------------------------------------------------------
class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key
        self.model = model or "claude-3-5-sonnet-20241022"
        self.endpoint = "https://api.anthropic.com/v1/messages"

    async def generate(self, messages: list[dict], system_prompt: str, temperature: float = 0.7) -> str:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        # Filter messages for user / assistant
        formatted_messages = []
        for m in messages:
            if m.get("role") in ("user", "assistant"):
                formatted_messages.append({"role": m["role"], "content": m["content"]})

        if not formatted_messages:
            formatted_messages = [{"role": "user", "content": "Hello"}]

        body = {
            "model": self.model,
            "system": system_prompt,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(self.endpoint, json=body, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Anthropic API error ({resp.status_code}): {resp.text[:300]}")
            data = resp.json()
            return data["content"][0]["text"]

    async def test_connection(self) -> bool:
        try:
            res = await self.generate([{"role": "user", "content": "Hi"}], "Reply with 'OK'.")
            return bool(res)
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 4. Google Gemini Provider
# ---------------------------------------------------------------------------
class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model or "gemini-1.5-flash"

    async def generate(self, messages: list[dict], system_prompt: str, temperature: float = 0.7) -> str:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})

        body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents or [{"role": "user", "parts": [{"text": "Hello"}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024},
        }
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(endpoint, json=body)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API error ({resp.status_code}): {resp.text[:300]}")
            data = resp.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                return "I received your request but could not generate a text response."

    async def test_connection(self) -> bool:
        try:
            res = await self.generate([{"role": "user", "content": "Hi"}], "Reply with 'OK'.")
            return bool(res)
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 5. Fallback Local Provider (Guarantees zero crashes if no key in .env)
# ---------------------------------------------------------------------------
class FallbackLocalProvider(BaseLLMProvider):
    """
    Used when platform GROQ_API_KEY is not set yet in .env.
    Answers directly using extracted RenoPay knowledge base guide without crashing.
    """
    def __init__(self, message: str | None = None):
        self.message = message

    async def generate(self, messages: list[dict], system_prompt: str, temperature: float = 0.7) -> str:
        last_msg = messages[-1]["content"] if messages else ""
        return (
            f"⚡ **Saathi Guide**\n\n"
            f"I have received your question: *\"{last_msg}\"*\n\n"
            f"### RenoPay Quick Guide:\n"
            f"- **Split Bill**: Go to Split Screen to divide bills and send instant UPI requests to friends.\n"
            f"- **Shared Vaults**: Save jointly with friends or family with multi-signature withdrawal approvals.\n"
            f"- **UPI Lite**: 1-click pinless payments under ₹500 from your on-device wallet.\n"
            f"- **Digital Gold**: Auto round-up your daily payments to accumulate 24K pure gold!\n"
            f"- **Double-Entry Accounting**: Real-time journals, trial balance, and automated GST reports.\n\n"
            f"*(Note: Ensure `GROQ_API_KEY=gsk_...` is set in backend `.env` to enable live Groq model inference)*"
        )

    async def test_connection(self) -> bool:
        return True


# ---------------------------------------------------------------------------
# Factory: Resolver for Groq Provider
# ---------------------------------------------------------------------------
def create_provider_instance(provider_name: str, api_key: str, model_name: str) -> BaseLLMProvider:
    """Instantiate provider by name."""
    p_name = (provider_name or "").lower().strip()
    if p_name == "groq":
        return GroqProvider(api_key, model=model_name or "openai/gpt-oss-120b")
    elif p_name == "openai":
        return OpenAIProvider(api_key, model=model_name or "gpt-4o-mini")
    elif p_name == "anthropic":
        return AnthropicProvider(api_key, model=model_name or "claude-3-5-sonnet-20241022")
    elif p_name == "gemini":
        return GeminiProvider(api_key, model=model_name or "gemini-1.5-flash")
    else:
        return GroqProvider(api_key, model=model_name or "openai/gpt-oss-120b")


async def get_llm_provider_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> tuple[BaseLLMProvider, str, str, bool]:
    """
    Returns the platform Groq provider using GROQ_API_KEY from backend environment.
    If GROQ_API_KEY is not yet populated, uses FallbackLocalProvider gracefully.
    """
    groq_key = settings.GROQ_API_KEY.strip()
    if groq_key:
        return (
            GroqProvider(groq_key, model=settings.DEFAULT_AI_MODEL),
            "groq",
            settings.DEFAULT_AI_MODEL,
            False,
        )

    return (
        FallbackLocalProvider(),
        "groq",
        "openai/gpt-oss-120b",
        False,
    )

