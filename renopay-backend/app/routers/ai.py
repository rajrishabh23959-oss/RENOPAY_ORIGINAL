"""
AI Assistant Router.
Provides conversational AI, RAG app guidance, BYO API Key configuration,
and session management with multilingual support.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import encrypt_field
from app.db.session import get_db
from app.models.user import User
from app.models.ai import AIConfig, AIChatSession, AIChatMessage
from app.schemas.ai import (
    AIQueryRequest,
    AIQueryResponse,
    AIConfigOut,
    AIConfigSaveRequest,
    AIKeyTestRequest,
    AIMessageOut,
    AISessionOut,
)
from app.services.ai.providers import (
    get_llm_provider_for_user,
    create_provider_instance,
)
from app.services.ai.rate_limiter import get_user_rate_limit_status
from app.services.ai.rag_engine import retrieve_relevant_docs, format_rag_context
from app.services.ai.prompts import build_system_prompt

router = APIRouter()

DEFAULT_MODELS = {
    "groq": "llama-3.3-70b-versatile",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-20241022",
    "gemini": "gemini-1.5-flash",
}


def mask_key(key: str) -> str:
    """Masks an API key for safe UI display (e.g. gsk_...1234)."""
    if not key or len(key) < 8:
        return "••••••••"
    return f"{key[:4]}••••••••{key[-4:]}"


# ---------------------------------------------------------------------------
# 1. Main Query Endpoint
# ---------------------------------------------------------------------------
@router.post("/query", response_model=AIQueryResponse)
async def query_ai_assistant(
    payload: AIQueryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Primary endpoint for text/voice queries to RenoAI.
    Combines RAG documentation retrieval, multilingual prompting,
    BYO or default Groq LLM inference, and session logging.
    """
    # 1. Determine language preference
    lang = (payload.language or getattr(user, "language_code", "en") or "en").lower().strip()

    # 2. Retrieve relevant app documentation
    docs = retrieve_relevant_docs(payload.query_text, payload.screen_context)
    rag_context = format_rag_context(docs)

    # 3. Build system prompt with context & language
    system_prompt = build_system_prompt(
        language=lang,
        current_screen=payload.screen_context,
        rag_context=rag_context,
        user_name=user.full_name,
    )

    # 4. Resolve or create chat session
    session = None
    if payload.session_id:
        result = await db.execute(
            select(AIChatSession)
            .options(selectinload(AIChatSession.messages))
            .where(AIChatSession.id == payload.session_id, AIChatSession.user_id == user.id)
        )
        session = result.scalar_one_or_none()

    if not session:
        session = AIChatSession(
            user_id=user.id,
            title=payload.query_text[:60].strip() or "Chat",
        )
        db.add(session)
        await db.flush()
        recent_messages = []
    else:
        # Load up to last 6 messages for conversation memory
        recent_messages = [
            {"role": m.role, "content": m.content}
            for m in (session.messages or [])[-6:]
        ]

    # 5. Append current user query
    messages_for_llm = recent_messages + [{"role": "user", "content": payload.query_text}]

    # 6. Resolve LLM provider (BYO or default Groq with rate limiter)
    provider, provider_name, model_name, is_byo = await get_llm_provider_for_user(db, user.id)

    # 7. Generate response
    try:
        response_text = await provider.generate(messages_for_llm, system_prompt)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Provider error: {str(e)}",
        )

    # 8. Record user and assistant messages in session
    user_msg = AIChatMessage(
        session_id=session.id,
        role="user",
        content=payload.query_text,
        screen_context=payload.screen_context,
        language=lang,
    )
    bot_msg = AIChatMessage(
        session_id=session.id,
        role="assistant",
        content=response_text,
        provider_used=provider_name,
        model_used=model_name,
        screen_context=payload.screen_context,
        language=lang,
    )
    db.add(user_msg)
    db.add(bot_msg)
    await db.commit()

    return AIQueryResponse(
        response_text=response_text,
        session_id=session.id,
        provider=provider_name,
        model=model_name,
        is_byo=is_byo,
        language=lang,
        screen_context=payload.screen_context,
    )


# ---------------------------------------------------------------------------
# 2. AI Config (BYO API Key Management)
# ---------------------------------------------------------------------------
@router.get("/config", response_model=AIConfigOut)
async def get_ai_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the user's active AI configuration, or default Groq info.
    """
    result = await db.execute(
        select(AIConfig).where(AIConfig.user_id == user.id, AIConfig.is_active == True)
    )
    config = result.scalar_one_or_none()

    if config and config.api_key_encrypted:
        from app.core.security import decrypt_field
        try:
            raw_key = decrypt_field(config.api_key_encrypted)
            masked = mask_key(raw_key)
        except Exception:
            masked = "••••••••"

        return AIConfigOut(
            provider_name=config.provider_name,
            model_name=config.model_name,
            masked_key=masked,
            is_byo=True,
            is_active=True,
        )

    # Default platform config
    rate_info = get_user_rate_limit_status(str(user.id))
    return AIConfigOut(
        provider_name="groq",
        model_name=settings.DEFAULT_AI_MODEL,
        masked_key=None,
        is_byo=False,
        is_active=True,
        hourly_rate_limit=rate_info,
    )


@router.post("/config", response_model=AIConfigOut)
async def save_byo_ai_config(
    payload: AIConfigSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves or updates a user's personal BYO API key with AES-256 encryption.
    Validates connection before saving.
    """
    p_name = payload.provider_name.lower().strip()
    model = payload.model_name or DEFAULT_MODELS.get(p_name, "default")
    raw_key = payload.api_key.strip()

    # 1. Validate the API key against the provider
    try:
        provider_instance = create_provider_instance(p_name, raw_key, model)
        is_valid = await provider_instance.test_connection()
        if not is_valid:
            raise ValueError("Provider connection test returned false.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not validate {p_name.capitalize()} API key: {str(e)}",
        )

    # 2. Encrypt API key with AES-256 (Fernet)
    encrypted_key = encrypt_field(raw_key)

    # 3. Save or update DB record
    result = await db.execute(
        select(AIConfig).where(AIConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if config:
        config.provider_name = p_name
        config.model_name = model
        config.api_key_encrypted = encrypted_key
        config.is_active = True
    else:
        config = AIConfig(
            user_id=user.id,
            provider_name=p_name,
            model_name=model,
            api_key_encrypted=encrypted_key,
            is_active=True,
            is_default=False,
        )
        db.add(config)

    await db.commit()

    return AIConfigOut(
        provider_name=p_name,
        model_name=model,
        masked_key=mask_key(raw_key),
        is_byo=True,
        is_active=True,
    )


@router.delete("/config", response_model=AIConfigOut)
async def reset_ai_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Reverts user back to platform default free Groq model.
    """
    result = await db.execute(
        select(AIConfig).where(AIConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()
    if config:
        await db.delete(config)
        await db.commit()

    rate_info = get_user_rate_limit_status(str(user.id))
    return AIConfigOut(
        provider_name="groq",
        model_name=settings.DEFAULT_AI_MODEL,
        masked_key=None,
        is_byo=False,
        is_active=True,
        hourly_rate_limit=rate_info,
    )


@router.post("/config/test")
async def test_byo_ai_key(payload: AIKeyTestRequest):
    """
    Tests an API key without persisting it to the database.
    """
    p_name = payload.provider_name.lower().strip()
    model = payload.model_name or DEFAULT_MODELS.get(p_name, "default")
    raw_key = payload.api_key.strip()

    try:
        provider_instance = create_provider_instance(p_name, raw_key, model)
        is_valid = await provider_instance.test_connection()
        return {
            "success": is_valid,
            "message": "Key is valid and active!" if is_valid else "Could not connect to provider with this key.",
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Validation failed: {str(e)}",
        }


# ---------------------------------------------------------------------------
# 3. Chat Sessions & History
# ---------------------------------------------------------------------------
@router.get("/sessions", response_model=list[AISessionOut])
async def list_chat_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIChatSession)
        .options(selectinload(AIChatSession.messages))
        .where(AIChatSession.user_id == user.id)
        .order_by(desc(AIChatSession.updated_at))
        .limit(20)
    )
    sessions = result.scalars().all()
    return [
        AISessionOut(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=len(s.messages or []),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages", response_model=list[AIMessageOut])
async def get_session_messages(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIChatSession)
        .options(selectinload(AIChatSession.messages))
        .where(AIChatSession.id == session_id, AIChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return [
        AIMessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            provider_used=m.provider_used,
            model_used=m.model_used,
            screen_context=m.screen_context,
            language=m.language,
            created_at=m.created_at,
        )
        for m in (session.messages or [])
    ]


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.commit()
    return {"success": True}
