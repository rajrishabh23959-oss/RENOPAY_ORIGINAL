import pytest
from fastapi import HTTPException
from app.routers.voice import voice_parse, VoiceParseRequest
from tests.conftest import make_user_with_account

pytestmark = pytest.mark.asyncio


async def test_voice_parse(db_session):
    user, account = await make_user_with_account(db_session, name="Voice User", phone="7777777777", pin="123456")
    
    # Test successful parse
    req = VoiceParseRequest(
        amount=500.0,
        recipient="Voice User",
        confidence=0.85
    )
    res = await voice_parse(payload=req, user=user, db=db_session)
    assert res.success is True
    assert res.amount == 500.0
    assert res.confidence >= 0.85
    assert res.resolved_vpa == account.vpa

    # Test excessive amount
    req_excessive = VoiceParseRequest(
        amount=500000.0,
        recipient="Voice User",
        confidence=0.95
    )
    with pytest.raises(HTTPException) as excinfo:
        await voice_parse(payload=req_excessive, user=user, db=db_session)
    
    assert excinfo.value.status_code == 400
    assert "exceeds limit" in excinfo.value.detail
