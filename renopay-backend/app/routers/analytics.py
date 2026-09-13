from datetime import datetime, timedelta, timezone
from calendar import monthrange

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_account, get_current_user
from app.core.money import paise_to_rupees
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction, TxnType
from app.schemas.features import BudgetPredictionOut, ExpenseSummaryOut, ExpenseByCategory
from app.services.pdf_generator import generate_pdf, build_expense_report_data

router = APIRouter()


@router.get("/budget-prediction", response_model=BudgetPredictionOut)
async def budget_prediction(account: Account = Depends(get_current_account), db: AsyncSession = Depends(get_db)):
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(Transaction.amount_paise, Transaction.created_at)
        .where(Transaction.account_id == account.id, Transaction.type == TxnType.DEBIT,
               Transaction.created_at >= thirty_days_ago)
    )
    rows = result.all()
    if not rows:
        return BudgetPredictionOut(status="safe", level="Stable", message="No recent spending detected.",
                                     daily_burn_rate=0)

    total_spent = sum(r[0] for r in rows)
    oldest = min(r[1] for r in rows)
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=timezone.utc)
    days_elapsed = max(1, (datetime.now(timezone.utc) - oldest).days)
    daily_burn_paise = total_spent / days_elapsed

    now = datetime.now(timezone.utc)
    days_in_month = monthrange(now.year, now.month)[1]
    days_remaining_in_month = days_in_month - now.day
    days_remaining_in_funds = (account.current_balance_paise / daily_burn_paise) if daily_burn_paise else 999

    diff = days_remaining_in_funds - days_remaining_in_month
    burn_rupees = paise_to_rupees(round(daily_burn_paise))

    if diff < -2:
        return BudgetPredictionOut(
            status="critical", level="High",
            message=f"Warning: at your current burn rate, you'll run out of funds {abs(round(diff))} days before month end.",
            daily_burn_rate=burn_rupees,
        )
    elif diff < 5:
        return BudgetPredictionOut(
            status="caution", level="Mid",
            message="Careful: your spending rate is high. You might struggle by the last week.",
            daily_burn_rate=burn_rupees,
        )
    return BudgetPredictionOut(status="safe", level="Stable", message="Financial heartbeat stable — on track this month.",
                                 daily_burn_rate=burn_rupees)


@router.get("/expenses", response_model=ExpenseSummaryOut)
async def expense_summary(
    period: str = "month",  # week | month | all | custom
    start_date: str | None = None,
    end_date: str | None = None,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    base_filter = [Transaction.account_id == account.id]

    if period == "week":
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        base_filter.append(Transaction.created_at >= cutoff)
    elif period == "month":
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        base_filter.append(Transaction.created_at >= cutoff)
    elif period == "custom" or start_date or end_date:
        if start_date:
            try:
                s_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                base_filter.append(Transaction.created_at >= s_dt)
            except Exception:
                pass
        if end_date:
            try:
                e_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                base_filter.append(Transaction.created_at <= e_dt)
            except Exception:
                pass

    debit_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount_paise))
        .where(*base_filter, Transaction.type == TxnType.DEBIT)
        .group_by(Transaction.category)
    )
    by_category_rows = debit_result.all()
    total_spent_paise = sum(r[1] for r in by_category_rows)

    credit_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount_paise), 0))
        .where(*base_filter, Transaction.type == TxnType.CREDIT)
    )
    total_income_paise = credit_result.scalar_one()

    by_category = [
        ExpenseByCategory(
            category=cat.value if hasattr(cat, "value") else cat,
            amount=paise_to_rupees(amt),
            percent=round((amt / total_spent_paise) * 100, 1) if total_spent_paise else 0,
        )
        for cat, amt in sorted(by_category_rows, key=lambda r: -r[1])
    ]

    return ExpenseSummaryOut(
        total_spent=paise_to_rupees(total_spent_paise),
        total_income=paise_to_rupees(total_income_paise),
        net=paise_to_rupees(total_income_paise - total_spent_paise),
        budget=paise_to_rupees(account.monthly_budget_paise),
        budget_used_percent=round(min(100, (total_spent_paise / account.monthly_budget_paise) * 100), 1),
        by_category=by_category,
    )


@router.get("/expenses/pdf")
async def download_expense_pdf(
    period: str = "month",
    start_date: str | None = None,
    end_date: str | None = None,
    account: Account = Depends(get_current_account),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and return a certified 2-page visual PDF expense report."""
    base_filter = [Transaction.account_id == account.id]

    if period == "week":
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        base_filter.append(Transaction.created_at >= cutoff)
    elif period == "month":
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        base_filter.append(Transaction.created_at >= cutoff)
    elif period == "custom" or start_date or end_date:
        if start_date:
            try:
                s_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                base_filter.append(Transaction.created_at >= s_dt)
            except Exception:
                pass
        if end_date:
            try:
                e_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                base_filter.append(Transaction.created_at <= e_dt)
            except Exception:
                pass

    txns_res = await db.execute(
        select(Transaction)
        .where(*base_filter)
        .order_by(Transaction.created_at.desc())
    )
    transactions = txns_res.scalars().all()

    report_context = build_expense_report_data(account, user, transactions, period, start_date, end_date)
    pdf_stream = await generate_pdf("expense_report", report_context)
    filename = f"renopay-expense-statement-{period}.pdf"

    return StreamingResponse(
        pdf_stream,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Cache-Control": "no-cache",
        },
    )
