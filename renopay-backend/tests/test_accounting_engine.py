import pytest
from sqlalchemy import select
from app.models.transaction import TxnType, TxnCategory, TxnStatus
from app.models.accounting import JournalLine, ChartOfAccount
from app.services import accounting_engine
import uuid

@pytest.mark.asyncio
async def test_ensure_chart_of_accounts(db_session, test_account):
    coas = await accounting_engine.ensure_chart_of_accounts(db_session, test_account.id)
    assert "1000" in coas
    assert "4100" in coas
    
    # Verify it doesn't duplicate on second run
    coas2 = await accounting_engine.ensure_chart_of_accounts(db_session, test_account.id)
    assert len(coas) == len(coas2)


@pytest.mark.asyncio
async def test_post_transaction_to_journal(db_session, test_account):
    from app.models.transaction import Transaction
    
    txn = Transaction(
        txn_group_id=uuid.uuid4(),
        txn_ref="TXN123",
        account_id=test_account.id,
        counterparty_vpa="food@upi",
        type=TxnType.DEBIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.FOOD,
        amount_paise=15000, # 150 rs
        description="Lunch"
    )
    db_session.add(txn)
    await db_session.flush()
    
    entry = await accounting_engine.post_transaction_to_journal(db_session, txn)
    await db_session.commit()
    
    assert entry is not None
    assert entry.account_id == test_account.id
    
    lines = await db_session.execute(select(JournalLine).where(JournalLine.journal_entry_id == entry.id))
    lines = lines.scalars().all()
    
    assert len(lines) == 2
    
    # Debit should be Food & Dining (5010)
    # Credit should be Cash (1000)
    food_coa = await db_session.execute(select(ChartOfAccount).where(ChartOfAccount.code.like("%-5010")))
    food_coa = food_coa.scalar_one()
    
    cash_coa = await db_session.execute(select(ChartOfAccount).where(ChartOfAccount.code.like("%-1000")))
    cash_coa = cash_coa.scalar_one()
    
    debit_line = next(line for line in lines if line.debit_paise > 0)
    credit_line = next(line for line in lines if line.credit_paise > 0)
    
    assert debit_line.chart_account_id == food_coa.id
    assert credit_line.chart_account_id == cash_coa.id
    assert debit_line.debit_paise == 15000
    assert credit_line.credit_paise == 15000


@pytest.mark.asyncio
async def test_trial_balance(db_session, test_account):
    # Setup some transactions
    from app.models.transaction import Transaction
    
    txn1 = Transaction(
        txn_group_id=uuid.uuid4(),
        txn_ref="TXN_INC",
        account_id=test_account.id,
        counterparty_vpa="boss@upi",
        type=TxnType.CREDIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.INCOME,
        amount_paise=100000,
        description="Salary"
    )
    db_session.add(txn1)
    await db_session.flush()
    await accounting_engine.post_transaction_to_journal(db_session, txn1)
    
    txn2 = Transaction(
        txn_group_id=uuid.uuid4(),
        txn_ref="TXN_EXP",
        account_id=test_account.id,
        counterparty_vpa="uber@upi",
        type=TxnType.DEBIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.TRANSPORT,
        amount_paise=20000,
        description="Cab"
    )
    db_session.add(txn2)
    await db_session.flush()
    await accounting_engine.post_transaction_to_journal(db_session, txn2)
    
    tb = await accounting_engine.get_trial_balance(db_session, test_account.id)
    assert tb["balanced"] is True
    
    # Net debit = 80k Cash + 20k Transport = 100k
    # Net credit = 100k Income = 100k
    assert tb["total_debit"] == 100000
    assert tb["total_credit"] == 100000

