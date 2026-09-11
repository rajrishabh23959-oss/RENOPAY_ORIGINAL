"""
Ledger / PDF Report endpoints.

GET /analytics/report?from=2026-01-01&to=2026-08-20&type=balance_sheet
  -> streams a PDF binary

GET /analytics/report?type=transaction_receipt&txn_ref=RENO-TXN-XXX
  -> streams a single-transaction receipt PDF
"""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_account
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.services.pdf_generator import (
    generate_pdf,
    build_balance_sheet_data,
    build_profit_loss_data,
    build_receipt_data,
    PDF_AVAILABLE,
)

router = APIRouter()


@router.get("/report")
async def generate_report(
    type: Literal["balance_sheet", "profit_loss", "transaction_receipt", "full_accounting_pack"] = Query("balance_sheet"),
    from_date: str = Query(None, alias="from", description="YYYY-MM-DD"),
    to_date: str = Query(None, alias="to", description="YYYY-MM-DD"),
    txn_ref: str | None = Query(None, description="Required when type=transaction_receipt"),
    user: User = Depends(get_current_user),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    content_type = "application/pdf" if PDF_AVAILABLE else "text/html"
    filename_ext = "pdf" if PDF_AVAILABLE else "html"

    if type == "transaction_receipt":
        if not txn_ref:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "txn_ref is required for transaction_receipt")
        result = await db.execute(
            select(Transaction).where(
                Transaction.account_id == account.id,
                Transaction.txn_ref == txn_ref,
            )
        )
        txn = result.scalar_one_or_none()
        if txn is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")

        data = build_receipt_data(txn)
        buf = await generate_pdf("transaction_receipt", data)
        filename = f"receipt_{txn_ref}.{filename_ext}"

    else:
        # Parse date range
        from_str = from_date if isinstance(from_date, str) else None
        to_str = to_date if isinstance(to_date, str) else None
        try:
            dt_from = datetime.strptime(from_str, "%Y-%m-%d").replace(tzinfo=timezone.utc) if from_str else None
            dt_to = datetime.strptime(to_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc) if to_str else None
        except (ValueError, TypeError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD")

        filters = [Transaction.account_id == account.id]
        if dt_from:
            filters.append(Transaction.created_at >= dt_from)
        if dt_to:
            filters.append(Transaction.created_at <= dt_to)

        result = await db.execute(
            select(Transaction).where(and_(*filters)).order_by(Transaction.created_at.desc()).limit(500)
        )
        transactions = result.scalars().all()

        period_str = f"{from_str or 'All'} to {to_str or 'now'}"

        if type == "balance_sheet":
            data = build_balance_sheet_data(transactions, period_str)
            template = "balance_sheet"
            filename = f"balance_sheet_{from_str or 'all'}_{to_str or 'now'}.{filename_ext}"
        elif type == "profit_loss":
            data = build_profit_loss_data(transactions, period_str)
            template = "profit_loss"
            filename = f"profit_loss_{from_str or 'all'}_{to_str or 'now'}.{filename_ext}"
        elif type == "full_accounting_pack":
            from app.services import accounting_engine
            # Ensure COA is generated
            coas = await accounting_engine.ensure_chart_of_accounts(db, account.id)
            
            # Fetch Journal Entries
            # Just grab the last 500 lines for demo
            je_result = await db.execute(select(accounting_engine.JournalEntry).where(accounting_engine.JournalEntry.account_id == account.id).order_by(accounting_engine.JournalEntry.created_at.desc()).limit(500))
            entries = je_result.scalars().all()
            
            journal_entries_data = []
            for je in entries:
                lines_res = await db.execute(select(accounting_engine.JournalLine, accounting_engine.ChartOfAccount).join(accounting_engine.ChartOfAccount).where(accounting_engine.JournalLine.journal_entry_id == je.id))
                lines = []
                for line, coa in lines_res.all():
                    lines.append({
                        "account_name": coa.name,
                        "debit": f"₹{line.debit_paise / 100:.2f}" if line.debit_paise else "",
                        "credit": f"₹{line.credit_paise / 100:.2f}" if line.credit_paise else ""
                    })
                journal_entries_data.append({
                    "entry_no": je.entry_no,
                    "date": je.created_at.strftime("%Y-%m-%d"),
                    "narration": je.narration,
                    "lines": lines
                })
                
            # Fetch General Ledger
            general_ledgers = []
            for coa in coas.values():
                gl_data = await accounting_engine.get_ledger_for_account(db, coa.id)
                if gl_data and gl_data["lines"]:
                    formatted_lines = []
                    for line in gl_data["lines"]:
                        formatted_lines.append({
                            "date": line["date"].strftime("%Y-%m-%d"),
                            "entry_no": line["entry_no"],
                            "narration": line["narration"],
                            "payee": line["payee"],
                            "debit": f"₹{line['debit'] / 100:.2f}" if line['debit'] else "",
                            "credit": f"₹{line['credit'] / 100:.2f}" if line['credit'] else "",
                            "balance": f"₹{line['balance'] / 100:.2f}"
                        })
                    general_ledgers.append({
                        "code": coa.code,
                        "name": coa.name,
                        "lines": formatted_lines,
                        "closing_balance": f"₹{gl_data['closing_balance'] / 100:.2f}"
                    })
            
            # Fetch Payee Ledgers (just distinct payees)
            payees_res = await db.execute(select(accounting_engine.JournalLine.payee_vpa).join(accounting_engine.JournalEntry).where(accounting_engine.JournalEntry.account_id == account.id).distinct())
            payees = [p for p in payees_res.scalars().all() if p]
            
            payee_ledgers = []
            for payee in payees:
                pl_data = await accounting_engine.get_ledger_for_payee(db, account.id, payee)
                if pl_data["lines"]:
                    formatted_lines = []
                    for line in pl_data["lines"]:
                        formatted_lines.append({
                            "date": line["date"].strftime("%Y-%m-%d"),
                            "entry_no": line["entry_no"],
                            "narration": line["narration"],
                            "account_name": line["account_name"],
                            "debit": f"₹{line['debit'] / 100:.2f}" if line['debit'] else "",
                            "credit": f"₹{line['credit'] / 100:.2f}" if line['credit'] else "",
                        })
                    payee_ledgers.append({
                        "payee_vpa": payee,
                        "lines": formatted_lines,
                        "total_debit": f"₹{pl_data['total_debit'] / 100:.2f}",
                        "total_credit": f"₹{pl_data['total_credit'] / 100:.2f}"
                    })
            
            # Trial Balance
            tb_data = await accounting_engine.get_trial_balance(db, account.id, dt_to)
            trial_balance = {
                "balanced": tb_data["balanced"],
                "total_debit": f"₹{tb_data['total_debit'] / 100:.2f}",
                "total_credit": f"₹{tb_data['total_credit'] / 100:.2f}",
                "rows": [{
                    "code": r["code"],
                    "name": r["name"],
                    "debit": f"₹{r['debit'] / 100:.2f}" if r["debit"] else "",
                    "credit": f"₹{r['credit'] / 100:.2f}" if r["credit"] else ""
                } for r in tb_data["rows"]]
            }
            
            # Balance Sheet v2
            bs_data = await accounting_engine.get_balance_sheet_v2(db, account.id, dt_to)
            balance_sheet = {
                "balanced": bs_data["balanced"],
                "total_assets": bs_data["total_assets"] / 100,
                "total_liabilities": bs_data["total_liabilities"] / 100,
                "total_equity": bs_data["total_equity"] / 100,
                "assets": [{"name": a["name"], "balance": f"₹{a['balance'] / 100:.2f}"} for a in bs_data["assets"]],
                "liabilities": [{"name": line["name"], "balance": f"₹{line['balance'] / 100:.2f}"} for line in bs_data["liabilities"]],
                "equity": [{"name": e["name"], "balance": f"₹{e['balance'] / 100:.2f}"} for e in bs_data["equity"]],
            }
            
            # Cash flow
            cf_data = await accounting_engine.get_cash_flow(db, account.id, dt_from, dt_to)
            cash_flow = {
                "net_change": cf_data["net_change"] / 100,
                "operating": {
                    "total": f"₹{cf_data['operating']['total'] / 100:.2f}",
                    "items": [{"name": i["name"], "amount": f"₹{i['amount'] / 100:.2f}"} for i in cf_data["operating"]["items"]]
                },
                "investing": {
                    "total": f"₹{cf_data['investing']['total'] / 100:.2f}",
                    "items": [{"name": i["name"], "amount": f"₹{i['amount'] / 100:.2f}"} for i in cf_data["investing"]["items"]]
                },
                "financing": {
                    "total": f"₹{cf_data['financing']['total'] / 100:.2f}",
                    "items": [{"name": i["name"], "amount": f"₹{i['amount'] / 100:.2f}"} for i in cf_data["financing"]["items"]]
                }
            }

            data = {
                "account_name": user.full_name,
                "generated_at": datetime.utcnow().strftime("%d %b %Y %H:%M UTC"),
                "journal_entries": journal_entries_data,
                "general_ledgers": general_ledgers,
                "payee_ledgers": payee_ledgers,
                "trial_balance": trial_balance,
                "balance_sheet": balance_sheet,
                "cash_flow": cash_flow,
            }
            template = "full_accounting_pack"
            filename = f"accounting_pack_{from_str or 'all'}_{to_str or 'now'}.{filename_ext}"

        buf = await generate_pdf(template, data)

    from fastapi.responses import Response

    return Response(
        content=buf.getvalue(),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
