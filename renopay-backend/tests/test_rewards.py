import pytest
from datetime import datetime, timedelta, timezone

from app.models.reward import ScratchCard, RewardType
from app.routers.rewards import list_cards, scratch_card
from tests.conftest import make_user_with_account

pytestmark = pytest.mark.asyncio

async def test_list_and_scratch_cards(db_session):
    user, account = await make_user_with_account(db_session, name="Rew User", phone="8888888888", pin="123456")
    
    # Inject a scratch card manually
    card = ScratchCard(
        user_id=user.id,
        reward_type=RewardType.CASHBACK,
        reward_amount_paise=5000,
        label="₹50 Cashback",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db_session.add(card)
    await db_session.commit()
    await db_session.refresh(card)
    
    # List cards
    cards = await list_cards(user=user, db=db_session)
    assert len(cards) == 1
    assert cards[0].id == card.id
    
    # Scratch it
    result = await scratch_card(card_id=card.id, user=user, account=account, db=db_session)
    assert result.success is True
    assert result.reward_amount == 50.0
    
    # Fetch updated balance
    await db_session.refresh(account)
    assert account.current_balance_paise == 5000
