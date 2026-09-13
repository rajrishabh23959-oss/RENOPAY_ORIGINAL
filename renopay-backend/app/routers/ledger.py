"""
Ledger / PDF Report endpoints.

GET /analytics/report?from=2026-01-01&to=2026-08-20&type=balance_sheet
  -> streams a PDF binary

GET /analytics/report?type=transaction_receipt&txn_ref=RENO-TXN-XXX
  -> streams a single-transaction receipt PDF
"""
from datetime import datetime, timezone, timedelta
from typing import Literal

IST = timezone(timedelta(hours=5, minutes=30))

def to_ist(dt: datetime | None) -> datetime:
    if not dt:
        return datetime.now(IST)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)

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
    type: Literal[
        "balance_sheet",
        "profit_loss",
        "transaction_receipt",
        "full_accounting_pack",
        "journal",
        "general_ledger",
        "payee_ledger",
        "trial_balance",
    ] = Query("balance_sheet"),
    from_date: str = Query(None, alias="from", description="YYYY-MM-DD"),
    to_date: str = Query(None, alias="to", description="YYYY-MM-DD"),
    txn_ref: str | None = Query(None, description="Required when type=transaction_receipt"),
    disposition: Literal["attachment", "inline"] = Query("attachment", description="attachment or inline"),
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
        elif type in ("full_accounting_pack", "journal", "general_ledger", "payee_ledger", "trial_balance"):
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

            # Group for Journal Entries
            entries_dict = {}
            for entry, line, coa in all_rows:
                if entry.id not in entries_dict:
                    entry_date = to_ist(entry.created_at).strftime("%d %b %Y, %I:%M %p IST") if entry.created_at else ""
                    entries_dict[entry.id] = {
                        "entry_no": entry.entry_no or "",
                        "date": entry_date,
                        "narration": entry.narration or "",
                        "created_at": entry.created_at,
                        "debit_accounts": [],
                        "credit_accounts": [],
                        "debit_paise": 0,
                        "credit_paise": 0,
                    }
                d = line.debit_paise or 0
                c = line.credit_paise or 0
                coa_name = getattr(coa, "name", "Account") or "Account"
                if d > 0:
                    entries_dict[entry.id]["debit_accounts"].append(coa_name)
                    entries_dict[entry.id]["debit_paise"] += d
                if c > 0:
                    entries_dict[entry.id]["credit_accounts"].append(coa_name)
                    entries_dict[entry.id]["credit_paise"] += c

            journal_entries_data = []
            total_je_paise = 0
            sorted_entries = sorted(
                entries_dict.values(),
                key=lambda x: x.get("created_at") or datetime.min
            )
            for item in sorted_entries:
                amt_paise = max(item["debit_paise"], item["credit_paise"])
                total_je_paise += amt_paise
                journal_entries_data.append({
                    "entry_no": item["entry_no"],
                    "date": item["date"],
                    "narration": item["narration"],
                    "debit_account": ", ".join(item["debit_accounts"]) if item["debit_accounts"] else "—",
                    "credit_account": ", ".join(item["credit_accounts"]) if item["credit_accounts"] else "—",
                    "amount": f"Rs {amt_paise / 100:,.2f}",
                })
            total_journal_amount = f"Rs {total_je_paise / 100:,.2f}"

            # Group for General Ledgers (calculated in-memory)
            gl_map = defaultdict(lambda: {"lines": [], "running_balance": 0})
            for entry, line, coa in all_rows:
                gl = gl_map[coa.id]
                d = line.debit_paise or 0
                c = line.credit_paise or 0
                coa_type = getattr(coa, "account_type", None)
                if coa_type in (accounting_engine.AccountType.ASSET, accounting_engine.AccountType.EXPENSE):
                    gl["running_balance"] += (d - c)
                else:
                    gl["running_balance"] += (c - d)

                entry_date = to_ist(entry.created_at).strftime("%d %b, %I:%M %p") if entry.created_at else ""
                gl["lines"].append({
                    "date": entry_date,
                    "entry_no": entry.entry_no or "",
                    "narration": entry.narration or "",
                    "payee": line.payee_vpa or line.payee_name or "—",
                    "debit": f"Rs {d / 100:,.2f}" if d else "",
                    "credit": f"Rs {c / 100:,.2f}" if c else "",
                    "balance": f"Rs {gl['running_balance'] / 100:,.2f}",
                })

            general_ledgers = []
            for coa in sorted(coas.values(), key=lambda c: getattr(c, "code", "") or ""):
                gl = gl_map.get(coa.id)
                if gl and gl["lines"]:
                    code_val = getattr(coa, "code", "") or ""
                    clean_code = code_val.split('-')[1] if '-' in code_val else code_val
                    general_ledgers.append({
                        "code": clean_code,
                        "name": getattr(coa, "name", "Account") or "Account",
                        "lines": gl["lines"],
                        "closing_balance": f"Rs {gl['running_balance'] / 100:,.2f}",
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
                    entry_date = to_ist(entry.created_at).strftime("%d %b, %I:%M %p") if entry.created_at else ""
                    p["lines"].append({
                        "date": entry_date,
                        "entry_no": entry.entry_no or "",
                        "narration": entry.narration or "",
                        "account_name": getattr(coa, "name", "Account") or "Account",
                        "debit": f"Rs {d / 100:,.2f}" if d else "",
                        "credit": f"Rs {c / 100:,.2f}" if c else "",
                    })

            payee_ledgers = [
                {
                    "payee_vpa": vpa,
                    "lines": data["lines"],
                    "total_debit": f"Rs {data['total_debit'] / 100:,.2f}",
                    "total_credit": f"Rs {data['total_credit'] / 100:,.2f}",
                }
                for vpa, data in payee_map.items()
            ]

            # Trial Balance
            tb_data = await accounting_engine.get_trial_balance(db, account.id, dt_to)
            trial_balance = {
                "balanced": tb_data.get("balanced", True),
                "total_debit": f"Rs {(tb_data.get('total_debit') or 0) / 100:,.2f}",
                "total_credit": f"Rs {(tb_data.get('total_credit') or 0) / 100:,.2f}",
                "rows": [{
                    "code": r.get("code") or "",
                    "name": r.get("name") or "",
                    "debit": f"Rs {float(r['debit']) / 100:,.2f}" if r.get("debit") else "",
                    "credit": f"Rs {float(r['credit']) / 100:,.2f}" if r.get("credit") else ""
                } for r in tb_data.get("rows", [])]
            }

            data = {
                "account_name": getattr(user, "full_name", None) or "Account Holder",
                "generated_at": datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST"),
                "period_str": f"{from_str or 'Start'} to {to_str or 'Now'}" if (from_str or to_str) else None,
                "journal_entries": journal_entries_data,
                "total_journal_amount": total_journal_amount,
                "general_ledgers": general_ledgers,
                "payee_ledgers": payee_ledgers,
                "trial_balance": trial_balance,
            }
            if type == "journal":
                template = "journal"
                filename = f"journal_{from_str or 'all'}_{to_str or 'now'}.{filename_ext}"
            elif type == "general_ledger":
                template = "general_ledger"
                filename = f"general_ledger_{from_str or 'all'}_{to_str or 'now'}.{filename_ext}"
            elif type == "payee_ledger":
                template = "payee_ledger"
                filename = f"payee_ledger_{from_str or 'all'}_{to_str or 'now'}.{filename_ext}"
            elif type == "trial_balance":
                template = "trial_balance"
                filename = f"trial_balance_{to_str or 'now'}.{filename_ext}"
            else:
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
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )
