"""
Tests for the payment engine. The concurrency test at the bottom is
the most important one in this file: it's the actual proof that the
row-locking in payment_engine.send_money prevents double-spending,
rather than just trusting that the code "looks correct."
"""
import asyncio

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.services import payment_engine
from app.services.payment_engine import PaymentError
from app.models.account import Account
from tests.conftest import make_user_with_account

pytestmark = pytest.mark.asyncio


async def test_successful_payment_moves_balance_correctly(db_session):
    sender, sender_acc = await make_user_with_account(
        db_session, name="Alice Sender", phone="9000000001", pin="111111", balance_paise=100_000
    )
    _, receiver_acc = await make_user_with_account(
        db_session, name="Bob Receiver", phone="9000000002", pin="222222", balance_paise=0
    )

    result = await payment_engine.send_money(
        db_session, sender_user_id=sender.id, receiver_vpa=receiver_acc.vpa,
        amount_paise=25_000, pin="111111",
    )

    assert result.amount_paise == 25_000
    assert result.sender_new_balance_paise == 75_000

    await db_session.refresh(sender_acc)
    await db_session.refresh(receiver_acc)
    assert sender_acc.current_balance_paise == 75_000
    assert receiver_acc.current_balance_paise == 25_000


async def test_insufficient_balance_raises_and_does_not_move_money(db_session):
    sender, sender_acc = await make_user_with_account(
        db_session, name="Poor Alice", phone="9000000003", pin="111111", balance_paise=1_000
    )
    _, receiver_acc = await make_user_with_account(
        db_session, name="Rich Bob", phone="9000000004", pin="222222", balance_paise=0
    )

    with pytest.raises(PaymentError) as exc_info:
        await payment_engine.send_money(
            db_session, sender_user_id=sender.id, receiver_vpa=receiver_acc.vpa,
            amount_paise=50_000, pin="111111",
        )
    assert exc_info.value.code == "insufficient_balance"

    await db_session.refresh(sender_acc)
    assert sender_acc.current_balance_paise == 1_000  # unchanged


async def test_wrong_pin_is_rejected_and_locks_after_max_attempts(db_session):
    sender, _ = await make_user_with_account(
        db_session, name="Careless Carl", phone="9000000005", pin="111111", balance_paise=100_000
    )
    _, receiver_acc = await make_user_with_account(
        db_session, name="Dana", phone="9000000006", pin="222222", balance_paise=0
    )

    for _ in range(5):
        with pytest.raises(PaymentError) as exc_info:
            await payment_engine.send_money(
                db_session, sender_user_id=sender.id, receiver_vpa=receiver_acc.vpa,
                amount_paise=1_000, pin="000000",
            )
        assert exc_info.value.code == "invalid_pin"

    # 6th attempt (even with the CORRECT pin) should now be locked out
    with pytest.raises(PaymentError) as exc_info:
        await payment_engine.send_money(
            db_session, sender_user_id=sender.id, receiver_vpa=receiver_acc.vpa,
            amount_paise=1_000, pin="111111",
        )
    assert exc_info.value.code == "pin_locked"


async def test_vpa_not_found_raises_clean_error(db_session):
    sender, _ = await make_user_with_account(
        db_session, name="Lonely Larry", phone="9000000007", pin="111111", balance_paise=100_000
    )
    with pytest.raises(PaymentError) as exc_info:
        await payment_engine.send_money(
            db_session, sender_user_id=sender.id, receiver_vpa="nobody@renopay",
            amount_paise=1_000, pin="111111",
        )
    assert exc_info.value.code == "vpa_not_found"


async def test_cannot_send_money_to_self(db_session):
    sender, sender_acc = await make_user_with_account(
        db_session, name="Self Sender", phone="9000000008", pin="111111", balance_paise=100_000
    )
    with pytest.raises(PaymentError) as exc_info:
        await payment_engine.send_money(
            db_session, sender_user_id=sender.id, receiver_vpa=sender_acc.vpa,
            amount_paise=1_000, pin="111111",
        )
    assert exc_info.value.code == "self_transfer"


async def test_round_up_credits_digital_gold_when_enabled(db_session):
    sender, sender_acc = await make_user_with_account(
        db_session, name="Rounder Rita", phone="9000000009", pin="111111", balance_paise=100_000
    )
    sender_acc.round_up_enabled = True
    await db_session.commit()
    _, receiver_acc = await make_user_with_account(
        db_session, name="Flat Fred", phone="9000000010", pin="222222", balance_paise=0
    )

    # ₹1.85 (185 paise) -> rounds up to ₹10.00, so 815 paise goes to gold
    result = await payment_engine.send_money(
        db_session, sender_user_id=sender.id, receiver_vpa=receiver_acc.vpa,
        amount_paise=185, pin="111111",
    )
    assert result.round_up_paise == 815

    await db_session.refresh(sender_acc)
    assert sender_acc.digital_gold_paise == 815
    assert sender_acc.current_balance_paise == 100_000 - 185 - 815


# ══════════════════════════════════════════════════════════════════
#  THE CONCURRENCY TEST — proves double-spend prevention actually works
# ══════════════════════════════════════════════════════════════════
async def test_concurrent_payments_cannot_double_spend(engine):
    if engine.dialect.name == "sqlite":
        pytest.skip("SQLite does not support row-level locking (SELECT ... FOR UPDATE)")
    """
    Sets up a sender with exactly ₹150 and fires TWO simultaneous ₹100
    payments at them (total ₹200 requested against ₹150 available).
    Without correct row-locking, both could read balance=150, both see
    "sufficient," and both succeed — leaving the account at -50.

    With `SELECT ... FOR UPDATE`, the second transaction must wait for
    the first to commit before it can even read the balance, so it
    correctly sees the post-first-payment balance and fails.

    This test uses two INDEPENDENT connections (not the shared
    savepoint-based db_session fixture) because real concurrency
    requires two real connections — a single asyncpg connection can't
    run two overlapping queries at once.
    """
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    setup_session = session_factory()
    sender, sender_acc = await make_user_with_account(
        setup_session, name="Race Condition Rick", phone="9000000099", pin="111111", balance_paise=15_000
    )
    _, receiver_acc = await make_user_with_account(
        setup_session, name="Race Receiver", phone="9000000098", pin="222222", balance_paise=0
    )
    sender_id = sender.id
    receiver_vpa = receiver_acc.vpa
    await setup_session.close()

    async def attempt_payment():
        session = session_factory()
        try:
            result = await payment_engine.send_money(
                session, sender_user_id=sender_id, receiver_vpa=receiver_vpa,
                amount_paise=10_000, pin="111111",
            )
            return ("success", result)
        except PaymentError as e:
            return ("failed", e.code)
        finally:
            await session.close()

    results = await asyncio.gather(attempt_payment(), attempt_payment())

    outcomes = [r[0] for r in results]
    assert outcomes.count("success") == 1, "Exactly one of the two concurrent payments must succeed"
    assert outcomes.count("failed") == 1, "Exactly one must fail (insufficient balance on the retry)"

    failed_reason = next(r[1] for r in results if r[0] == "failed")
    assert failed_reason == "insufficient_balance"

    # Verify final DB state directly — balance must never have gone
    # negative, and must reflect exactly one successful debit.
    verify_session = session_factory()
    final_acc = (await verify_session.execute(
        select(Account).where(Account.id == sender_acc.id)
    )).scalar_one()
    assert final_acc.current_balance_paise == 5_000  # 15000 - 10000, exactly once
    assert final_acc.current_balance_paise >= 0
    await verify_session.close()
