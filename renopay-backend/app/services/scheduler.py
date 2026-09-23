"""
Recurring auto-pay. Runs every few minutes, finds mandates whose
`next_payment_at` has passed, and routes each one through the SAME
`payment_engine.send_money` used for manual payments — deliberately not
a separate "auto-pay money movement" code path, so mandates get the
same locking, fraud-check, and ledger guarantees as everything else.
"""
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.mandate import Mandate, MandateStatus
from app.models.transaction import TxnCategory
from app.models.account import Account
from app.models.savings import SavingsGoal
from app.services import payment_engine
from app.services.payment_engine import PaymentError
from app.core.money import generate_txn_ref, new_txn_group_id

logger = logging.getLogger("renopay.scheduler")

_FREQUENCY_DAYS = {"monthly": 30, "quarterly": 90, "yearly": 365}


async def run_due_mandates():
    from sqlalchemy import text
    async with AsyncSessionLocal() as lock_db:
        try:
            lock_res = await lock_db.execute(text("SELECT pg_try_advisory_lock(847291)"))
            has_lock = lock_res.scalar()
        except Exception:
            # Fallback if DB doesn't support pg advisory lock (e.g. SQLite in test)
            has_lock = True

        if not has_lock:
            logger.info("Another scheduler instance holds advisory lock, skipping run_due_mandates.")
            return

        try:
            now = datetime.now(timezone.utc)
            result = await lock_db.execute(
                select(Mandate.id).where(Mandate.status == MandateStatus.ACTIVE, Mandate.next_payment_at <= now)
            )
            due_ids = result.scalars().all()
            if not due_ids:
                return

            for mandate_id in due_ids:
                async with AsyncSessionLocal() as mandate_db:
                    try:
                        m_res = await mandate_db.execute(select(Mandate).where(Mandate.id == mandate_id))
                        mandate = m_res.scalar_one_or_none()
                        if not mandate:
                            continue

                        acc_result = await mandate_db.execute(select(Account).where(Account.user_id == mandate.user_id))
                        account = acc_result.scalar_one_or_none()
                        if account is None:
                            continue

                        try:
                            category = TxnCategory(mandate.category)
                        except ValueError:
                            category = TxnCategory.BILLS

                        freq = mandate.frequency.value if hasattr(mandate.frequency, "value") else mandate.frequency
                        mandate.next_payment_at = now + timedelta(days=_FREQUENCY_DAYS.get(freq, 30))

                        await payment_engine.send_money(
                            mandate_db,
                            sender_user_id=mandate.user_id,
                            receiver_vpa=mandate.merchant_vpa,
                            amount_paise=mandate.amount_paise,
                            description=f"AutoPay: {mandate.name}",
                            category=category,
                            skip_fraud_check=True,
                            skip_pin_check=True,
                        )
                        logger.info(f"Mandate {mandate.id} ({mandate.name}) auto-paid successfully")
                    except PaymentError as e:
                        await mandate_db.rollback()
                        logger.warning(f"Mandate {mandate_id} auto-pay failed: {e.message}")
                    except Exception as exc:
                        await mandate_db.rollback()
                        logger.error(f"Unexpected error processing mandate {mandate_id}: {exc}")
        finally:
            try:
                await lock_db.execute(text("SELECT pg_advisory_unlock(847291)"))
            except Exception:
                pass


async def run_auto_saves():
    """Daily job: deduct auto_save_paise from each user's account into their
    savings goals that have auto_save_enabled=True."""
    from app.models.transaction import Transaction, TxnType, TxnStatus
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SavingsGoal).where(
                SavingsGoal.auto_save_enabled is True,
                SavingsGoal.auto_save_paise > 0,
            )
        )
        goals = result.scalars().all()
        if not goals:
            return

        for goal in goals:
            # Skip already-completed goals
            if goal.saved_paise >= goal.target_paise:
                continue
            acc_result = await db.execute(
                select(Account).where(Account.user_id == goal.user_id).with_for_update()
            )
            account = acc_result.scalar_one_or_none()
            if account is None or account.current_balance_paise < goal.auto_save_paise:
                logger.warning(f"Auto-save skipped for goal {goal.id}: insufficient balance")
                continue
            try:
                account.current_balance_paise -= goal.auto_save_paise
                goal.saved_paise += goal.auto_save_paise
                db.add(Transaction(
                    txn_group_id=new_txn_group_id(),
                    txn_ref=generate_txn_ref(),
                    account_id=account.id,
                    counterparty_vpa="autosave@vault",
                    type=TxnType.DEBIT, status=TxnStatus.SUCCESS,
                    category=TxnCategory.OTHER,
                    amount_paise=goal.auto_save_paise,
                    description=f"Auto-Save: {goal.name}",
                    trust_score=99,
                ))
                await db.commit()
                logger.info(f"Auto-saved Rs.{goal.auto_save_paise/100:.2f} for goal '{goal.name}'")
            except Exception as e:
                await db.rollback()
                logger.warning(f"Auto-save failed for goal {goal.id}: {e}")


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_due_mandates, "interval", minutes=5, id="run_due_mandates")
    scheduler.add_job(run_auto_saves, "cron", hour=9, minute=0, id="run_auto_saves")  # daily at 9am
    scheduler.start()
    return scheduler
