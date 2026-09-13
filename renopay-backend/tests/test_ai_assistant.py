"""
Unit tests for AI Assistant services, RAG retrieval, and rate limiter.
"""
import pytest
from app.services.ai.rag_engine import retrieve_relevant_docs, format_rag_context
from app.services.ai.prompts import build_system_prompt, LANGUAGE_METADATA
from app.services.ai.rate_limiter import check_and_increment_rate_limit, get_user_rate_limit_status
from app.services.ai.providers import (
    create_provider_instance,
    GroqProvider,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    FallbackLocalProvider,
)
from fastapi import HTTPException


def test_rag_retrieval_split_bill():
    docs = retrieve_relevant_docs("how do I split bill with my friends", current_screen="split")
    assert len(docs) > 0
    assert any("split" in d["id"].lower() or "split" in d["title"].lower() for d in docs)
    formatted = format_rag_context(docs)
    assert "Split Bill" in formatted


def test_rag_retrieval_screen_boost():
    docs = retrieve_relevant_docs("how does this work", current_screen="vaults")
    assert len(docs) > 0
    assert docs[0]["screen"] == "vaults"


def test_system_prompt_builder():
    prompt_hi = build_system_prompt(language="hi", current_screen="split", user_name="Rishab")
    assert "Hindi" in prompt_hi
    assert "Rishab" in prompt_hi
    assert "Split Bill" in prompt_hi
    assert "Accounting & Bookkeeping" in prompt_hi
    assert "Stock Market & Capital Markets" in prompt_hi
    assert "Money Markets & Fixed Income" in prompt_hi
    assert "photosynthesis" in prompt_hi  # explicitly mentioned in refusal guardrail

    prompt_ta = build_system_prompt(language="ta", current_screen="gold", user_name="Alex")
    assert "Tamil" in prompt_ta
    assert "Digital Gold" in prompt_ta
    assert "STRICT OUT-OF-SCOPE REFUSAL POLICY" in prompt_ta
    assert "Stock Market" in prompt_ta


def test_provider_instantiation():
    groq = create_provider_instance("groq", "gsk_dummykey", "openai/gpt-oss-120b")
    assert isinstance(groq, GroqProvider)
    assert groq.model == "openai/gpt-oss-120b"

    openai = create_provider_instance("openai", "sk-dummykey", "gpt-4o-mini")
    assert isinstance(openai, OpenAIProvider)

    anthropic = create_provider_instance("anthropic", "ant-dummykey", "claude-3-5-sonnet-20241022")
    assert isinstance(anthropic, AnthropicProvider)

    gemini = create_provider_instance("gemini", "gem-dummykey", "gemini-1.5-flash")
    assert isinstance(gemini, GeminiProvider)


@pytest.mark.asyncio
async def test_fallback_local_provider_financial():
    fallback = FallbackLocalProvider()
    response = await fallback.generate([{"role": "user", "content": "How do I split a bill?"}], "System prompt")
    assert "Saathi" in response
    assert "Split Bill" in response
    assert "Accounting" in response
    assert "Stock & Money Markets" in response


@pytest.mark.asyncio
async def test_fallback_local_provider_non_financial_refusal():
    fallback = FallbackLocalProvider()
    response = await fallback.generate([{"role": "user", "content": "Tell me what is photosynthesis?"}], "System prompt")
    assert "Saathi Financial Assistant" in response
    assert "cannot answer questions on non-financial topics" in response
    assert "Stock Market" in response


def test_rate_limiter():
    test_user_id = "test-user-rate-limit-999"
    # User can do up to 3 queries if limit is 3
    remaining1 = check_and_increment_rate_limit(test_user_id, limit=3)
    assert remaining1 == 2
    remaining2 = check_and_increment_rate_limit(test_user_id, limit=3)
    assert remaining2 == 1
    remaining3 = check_and_increment_rate_limit(test_user_id, limit=3)
    assert remaining3 == 0

    # 4th query must raise HTTP 429
    with pytest.raises(HTTPException) as exc_info:
        check_and_increment_rate_limit(test_user_id, limit=3)
    assert exc_info.value.status_code == 429
    assert "Hourly free AI limit reached" in str(exc_info.value.detail)

    status = get_user_rate_limit_status(test_user_id, limit=3)
    assert status["used"] == 3
    assert status["remaining"] == 0
