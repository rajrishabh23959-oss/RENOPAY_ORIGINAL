import pytest
from app.routers.mandates import create_mandate, list_mandates, toggle_mandate, cancel_mandate
from app.schemas.features import CreateMandateRequest
from tests.conftest import make_user_with_account

pytestmark = pytest.mark.asyncio


async def test_mandate_lifecycle(db_session):
    user, account = await make_user_with_account(db_session, name="Mandate User", phone="9999999999", pin="123456")
    
    # 1. Create
    req = CreateMandateRequest(
        name="Netflix",
        icon="netflix",
        merchant_vpa="netflix@razorpay",
        amount=199.0,
        max_limit=500.0,
        frequency="monthly",
        category="Entertainment",
        pin="123456"
    )
    mandate = await create_mandate(payload=req, user=user, db=db_session)
    assert mandate.name == "Netflix"
    assert mandate.status == "active"
    
    # 2. List
    mandates = await list_mandates(user=user, db=db_session)
    assert len(mandates) == 1
    assert mandates[0].id == mandate.id
    
    # 3. Toggle
    toggled = await toggle_mandate(mandate_id=mandate.id, user=user, db=db_session)
    assert toggled.status == "paused"
    
    toggled_again = await toggle_mandate(mandate_id=mandate.id, user=user, db=db_session)
    assert toggled_again.status == "active"
    
    # 4. Cancel
    await cancel_mandate(mandate_id=mandate.id, user=user, db=db_session)
    mandates_after_cancel = await list_mandates(user=user, db=db_session)
    assert mandates_after_cancel[0].status == "cancelled"
