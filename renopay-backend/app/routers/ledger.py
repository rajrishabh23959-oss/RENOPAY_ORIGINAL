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
            from collections import defaultdict

            # Ensure COA is generated
            coas = await accounting_engine.ensure_chart_of_accounts(db, account.id)

            # 1. Batch fetch all journal entries and lines in ONE single query
            je_query = (
                select(
                    accounting_engine.JournalEntry,
                    accounting_engine.JournalLine,
                    accounting_engine.ChartOfAccount,
                )
                .join(accounting_engine.JournalLine, accounting_engine.JournalLine.journal_entry_id == accounting_engine.JournalEntry.id)
                .join(accounting_engine.ChartOfAccount, accounting_engine.JournalLine.chart_account_id == accounting_engine.ChartOfAccount.id)
                .where(accounting_engine.JournalEntry.account_id == account.id)
                .order_by(accounting_engine.JournalEntry.created_at.asc(), accounting_engine.JournalLine.id.asc())
            )
            if dt_from:
                je_query = je_query.where(accounting_engine.JournalEntry.created_at >= dt_from)
            if dt_to:
                je_query = je_query.where(accounting_engine.JournalEntry.created_at <= dt_to)

            all_lines_res = await db.execute(je_query)
            all_rows = all_lines_res.all()

            # Group for Journal Entries (display newest first)
            entries_dict = {}
            for entry, line, coa in all_rows:
                if entry.id not in entries_dict:
                    entries_dict[entry.id] = {
                        "entry_no": entry.entry_no,
                        "date": entry.created_at.strftime("%Y-%m-%d"),
                        "narration": entry.narration,
                        "created_at": entry.created_at,
                        "lines": [],
                    }
                d = line.debit_paise or 0
                c = line.credit_paise or 0
                entries_dict[entry.id]["lines"].append({
                    "account_name": coa.name,
                    "debit": f"₹{d / 100:.2f}" if d else "",
                    "credit": f"₹{c / 100:.2f}" if c else "",
                })

            journal_entries_data = sorted(
                entries_dict.values(),
                key=lambda x: x["created_at"],
                reverse=True
            )[:200]

            # Group for General Ledgers (calculated in-memory)
            gl_map = defaultdict(lambda: {"lines": [], "running_balance": 0})
            for entry, line, coa in all_rows:
                gl = gl_map[coa.id]
                d = line.debit_paise or 0
                c = line.credit_paise or 0
                if coa.account_type in (accounting_engine.AccountType.ASSET, accounting_engine.AccountType.EXPENSE):
                    gl["running_balance"] += (d - c)
                else:
                    gl["running_balance"] += (c - d)

                gl["lines"].append({
                    "date": entry.created_at.strftime("%Y-%m-%d"),
                    "entry_no": entry.entry_no,
                    "narration": entry.narration,
                    "payee": line.payee_vpa or line.payee_name or "—",
                    "debit": f"₹{d / 100:.2f}" if d else "",
                    "credit": f"₹{c / 100:.2f}" if c else "",
                    "balance": f"₹{gl['running_balance'] / 100:.2f}",
                })

            general_ledgers = []
            for coa in sorted(coas.values(), key=lambda c: c.code):
                gl = gl_map.get(coa.id)
                if gl and gl["lines"]:
                    general_ledgers.append({
                        "code": coa.code.split('-')[1] if '-' in coa.code else coa.code,
                        "name": coa.name,
                        "lines": gl["lines"],
                        "closing_balance": f"₹{gl['running_balance'] / 100:.2f}",
                    })

            # Group for Payee Ledgers (calculated in-memory)
            payee_map = defaultdict(lambda: {"lines": [], "total_debit": 0, "total_credit": 0})
            for entry, line, coa in all_rows:
                if line.payee_vpa:
                    p = payee_map[line.payee_vpa]
                    d = line.debit_paise or 0
                    c = line.credit_paise or 0
                    p["total_debit"] += d
                    p["total_credit"] += c
                    p["lines"].append({
                        "date": entry.created_at.strftime("%Y-%m-%d"),
                        "entry_no": entry.entry_no,
                        "narration": entry.narration,
                        "account_name": coa.name,
                        "debit": f"₹{d / 100:.2f}" if d else "",
                        "credit": f"₹{c / 100:.2f}" if c else "",
                    })

            payee_ledgers = [
                {
                    "payee_vpa": vpa,
                    "lines": data["lines"],
                    "total_debit": f"₹{data['total_debit'] / 100:.2f}",
                    "total_credit": f"₹{data['total_credit'] / 100:.2f}",
                }
                for vpa, data in payee_map.items()
            ]

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
            total_assets = float(bs_data["total_assets"]) / 100
            total_liabilities = float(bs_data["total_liabilities"]) / 100
            total_equity = float(bs_data["total_equity"]) / 100
            balance_sheet = {
                "balanced": bs_data["balanced"],
                "total_assets": total_assets,
                "total_liabilities": total_liabilities,
                "total_equity": total_equity,
                "total_liab_equity": total_liabilities + total_equity,
                "assets": [{"name": a["name"], "balance": f"₹{float(a['balance']) / 100:.2f}"} for a in bs_data["assets"]],
                "liabilities": [{"name": line["name"], "balance": f"₹{float(line['balance']) / 100:.2f}"} for line in bs_data["liabilities"]],
                "equity": [{"name": e["name"], "balance": f"₹{float(e['balance']) / 100:.2f}"} for e in bs_data["equity"]],
            }

            # Cash flow
            cf_data = await accounting_engine.get_cash_flow(db, account.id, dt_from, dt_to)
            cash_flow = {
                "net_change": (cf_data.get("net_change") or 0) / 100,
                "operating": {
                    "total": f"₹{(cf_data.get('operating', {}).get('total') or 0) / 100:.2f}",
                    "items": [{"name": i["name"], "amount": f"₹{(i.get('amount') or 0) / 100:.2f}"} for i in cf_data.get("operating", {}).get("items", [])]
                },
                "investing": {
                    "total": f"₹{(cf_data.get('investing', {}).get('total') or 0) / 100:.2f}",
                    "items": [{"name": i["name"], "amount": f"₹{(i.get('amount') or 0) / 100:.2f}"} for i in cf_data.get("investing", {}).get("items", [])]
                },
                "financing": {
                    "total": f"₹{(cf_data.get('financing', {}).get('total') or 0) / 100:.2f}",
                    "items": [{"name": i["name"], "amount": f"₹{(i.get('amount') or 0) / 100:.2f}"} for i in cf_data.get("financing", {}).get("items", [])]
                }
            }

            data = {
                "account_name": user.full_name or "Account Holder",
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

    is_pdf = buf.getvalue().startswith(b"%PDF")
    real_content_type = "application/pdf" if is_pdf else "text/html; charset=utf-8"
    real_ext = "pdf" if is_pdf else "html"
    if not filename.endswith(f".{real_ext}"):
        filename = f"{filename.rsplit('.', 1)[0]}.{real_ext}"

    return Response(
        content=buf.getvalue(),
        media_type=real_content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
