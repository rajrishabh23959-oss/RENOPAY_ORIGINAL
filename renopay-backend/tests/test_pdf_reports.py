import pytest
from app.routers.ledger import generate_report
from app.models.transaction import Transaction, TxnType, TxnStatus, TxnCategory
from app.core.money import generate_txn_ref, new_txn_group_id
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_generate_pdf_receipt(db_session, test_account):
    txn_ref = generate_txn_ref()
    txn = Transaction(
        txn_group_id=new_txn_group_id(),
        txn_ref=txn_ref,
        account_id=test_account.id,
        counterparty_vpa="alex@renopay",
        type=TxnType.DEBIT,
        status=TxnStatus.SUCCESS,
        category=TxnCategory.OTHER,
        amount_paise=25000,
        round_up_paise=0,
        description="Dinner",
        trust_score=90,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(txn)
    await db_session.commit()

    from app.models.user import User
    from sqlalchemy import select
    user_res = await db_session.execute(select(User).where(User.id == test_account.user_id))
    user = user_res.scalar_one()

    response = await generate_report(
        type="transaction_receipt",
        txn_ref=txn_ref,
        user=user,
        account=test_account,
        db=db_session,
    )
    assert response.media_type == "application/pdf"
    assert f"receipt_{txn_ref}.pdf" in response.headers["Content-Disposition"]
    
    # Read the streamed bytes
    body = response.body_iterator
    content = b"".join([chunk async for chunk in body]) if hasattr(body, "__aiter__") else body.read()
    assert content.startswith(b"%PDF")

@pytest.mark.asyncio
async def test_generate_full_accounting_pack_pdf(db_session, test_account):
    from app.models.user import User
    from sqlalchemy import select
    user_res = await db_session.execute(select(User).where(User.id == test_account.user_id))
    user = user_res.scalar_one()

    response = await generate_report(
        type="full_accounting_pack",
        user=user,
        account=test_account,
        db=db_session,
    )
    assert response.media_type == "application/pdf"
    assert "accounting_pack_" in response.headers["Content-Disposition"]

    body = response.body_iterator
    content = b"".join([chunk async for chunk in body]) if hasattr(body, "__aiter__") else body.read()
    assert content.startswith(b"%PDF")
