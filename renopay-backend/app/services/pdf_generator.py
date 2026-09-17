"""
PDF Generator Service using WeasyPrint + Jinja2 inline templates.

WeasyPrint converts HTML/CSS -> PDF entirely in Python without spawning
a Chromium process. This keeps the container lean and the latency low.

Usage:
    stream = await generate_pdf("transaction_receipt", data_dict)
    # stream is an io.BytesIO ready to be streamed via FastAPI StreamingResponse

Requirements (add to requirements.txt):
    weasyprint>=62.0
    jinja2>=3.1.4
"""
import io
from datetime import datetime, timezone, timedelta
from typing import Literal
from jinja2 import Environment, BaseLoader

IST = timezone(timedelta(hours=5, minutes=30))

def to_ist(dt: datetime | None) -> datetime:
    if not dt:
        return datetime.now(IST)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)

try:
    from weasyprint import HTML as WeasyprintHTML
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError):
    WEASYPRINT_AVAILABLE = False

try:
    from xhtml2pdf import pisa
    XHTML2PDF_AVAILABLE = True
except ImportError:
    XHTML2PDF_AVAILABLE = False

PDF_AVAILABLE = WEASYPRINT_AVAILABLE or XHTML2PDF_AVAILABLE

ReportType = Literal[
    "transaction_receipt",
    "balance_sheet",
    "profit_loss",
    "cash_flow",
    "full_accounting_pack",
    "journal",
    "general_ledger",
    "payee_ledger",
    "trial_balance",
    "expense_report",
    "travel_ticket",
]

# ── Shared CSS ─────────────────────────────────────────────────────────────────
BASE_CSS = """
@page {
    size: A4 portrait;
    margin: 12mm 14mm;
}
* { margin: 0; padding: 0; }
body {
    font-family: Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.35;
}
.page { padding: 4px; }
.header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
.logo-title { font-size: 22px; font-weight: bold; color: #162a45; }
.logo-accent { color: #e06a10; }
.logo-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
.meta-box { text-align: right; font-size: 10px; color: #64748b; }
.meta-box strong { font-size: 12px; color: #162a45; }
.accent-line-navy { height: 2px; background-color: #162a45; width: 100%; margin-bottom: 2px; }
.accent-line-orange { height: 2px; background-color: #e06a10; width: 100%; margin-bottom: 16px; }

.section-title {
    font-size: 16px;
    font-weight: bold;
    color: #162a45;
    margin-top: 18px;
    margin-bottom: 10px;
}
.sub-section-title {
    font-size: 13px;
    font-weight: bold;
    color: #162a45;
    margin-top: 14px;
    margin-bottom: 6px;
}

.report-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
}
.report-table th {
    background-color: #162a45;
    color: #ffffff;
    font-weight: bold;
    font-size: 10.5px;
    padding: 7px 8px;
    border: 1px solid #162a45;
    text-align: left;
}
.report-table td {
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    font-size: 10px;
    color: #1e293b;
}
.report-table tr.even td {
    background-color: #f8fafc;
}
.report-table tr.odd td {
    background-color: #ffffff;
}
.total-row td {
    background-color: #ffffff;
    border-top: 1.5px solid #162a45;
    border-bottom: 2px solid #162a45;
    font-weight: bold;
    font-size: 10.5px;
    color: #162a45;
}
.closing-row td {
    background-color: #ffffff;
    border-top: 1.5px solid #162a45;
    border-bottom: 2px solid #162a45;
    font-weight: bold;
    font-size: 10.5px;
    color: #162a45;
}
.footer-text {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 9.5px;
    color: #64748b;
    text-align: center;
}
.page-break {
    page-break-before: always;
}
"""

# ── Templates ──────────────────────────────────────────────────────────────────
TEMPLATES: dict[str, str] = {
    "transaction_receipt": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — Payment Receipt</title>
<style>
{{ css }}
body {
    background-color: #ffffff;
    padding: 10px;
}
.receipt-wrapper {
    width: 96%;
    margin: 0 auto;
}
.receipt-box {
    border: 1px solid #e2e8f0;
    background-color: #f8fafc;
    margin-top: 14px;
    margin-bottom: 18px;
    padding: 16px 12px;
    text-align: center;
}
.badge-success {
    background-color: #15803d;
    color: #ffffff;
    font-size: 11px;
    font-weight: bold;
    padding: 4px 12px;
}
.badge-failed {
    background-color: #dc2626;
    color: #ffffff;
    font-size: 11px;
    font-weight: bold;
    padding: 4px 12px;
}
.badge-pending {
    background-color: #d97706;
    color: #ffffff;
    font-size: 11px;
    font-weight: bold;
    padding: 4px 12px;
}
</style>
</head>
<body>
<div class="receipt-wrapper">
    <!-- Brand Header -->
    <table class="header-table" cellpadding="0" cellspacing="0">
        <tr>
            <td valign="top">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span></div>
                <div class="logo-sub">Secure Payments Platform</div>
            </td>
        </tr>
    </table>
    <div style="height: 2.5px; background-color: #e06a10; width: 100%; margin-top: 4px; margin-bottom: 18px;"></div>

    <!-- Title & Status -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
        <tr>
            <td valign="middle">
                <div style="font-size: 19px; font-weight: bold; color: #162a45;">Payment Receipt</div>
            </td>
            <td valign="middle" align="right">
                <span class="badge-{{ status }}">{{ status | upper }}</span>
            </td>
        </tr>
    </table>

    <!-- Monospace Reference -->
    <div style="text-align: center; font-family: Courier, monospace; font-size: 12px; font-weight: bold; color: #162a45; margin-bottom: 14px;">
        {{ txn_ref }}
    </div>

    <!-- Highlight Amount Card -->
    <div class="receipt-box">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
            AMOUNT {{ 'CREDITED' if type == 'credit' else 'DEBITED' }}
        </div>
        <div style="font-size: 32px; font-weight: bold; color: {{ '#15803d' if type == 'credit' else '#162a45' }}; margin-bottom: 6px;">
            Rs {{ "%.2f"|format(amount) }}
        </div>
        <div style="font-size: 11px; font-weight: bold; color: #334155;">
            {{ type | upper }} &nbsp;<span style="color: #e06a10;">|</span>&nbsp; Category: {{ category }}
        </div>
    </div>

    <!-- Key-Value Detail Table -->
    <table width="100%" cellpadding="7" cellspacing="0" style="border-collapse: collapse; margin-bottom: 22px;">
        <tr style="background-color: #f1f5f9;">
            <td width="35%" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Transaction ID</td>
            <td width="65%" align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #162a45; font-size: 11px; font-family: Courier, monospace;">{{ txn_ref }}</td>
        </tr>
        <tr>
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Status</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: {{ '#15803d' if status == 'success' else '#dc2626' }}; font-size: 11px;">{{ status | upper }}</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Type</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #162a45; font-size: 11px;">{{ type | upper }}</td>
        </tr>
        <tr>
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Amount</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #162a45; font-size: 11px;">Rs {{ "%.2f"|format(amount) }}</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Category</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #162a45; font-size: 11px;">{{ category }}</td>
        </tr>
        <tr>
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">To / From</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #162a45; font-size: 11px;">{{ counterparty_vpa }}</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Description</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; color: #162a45; font-size: 11px;">{{ description or '—' }}</td>
        </tr>
        <tr>
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Transaction Date &amp; Time</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; color: #162a45; font-size: 11px;">{{ created_at }}</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 11px;">Receipt Generated</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; color: #162a45; font-size: 11px;">{{ generated_at }}</td>
        </tr>
        {% if round_up > 0 %}
        <tr>
            <td style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #e06a10; font-size: 11px;">Digital Gold Round-Up</td>
            <td align="right" style="border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #e06a10; font-size: 11px;">+ Rs {{ "%.2f"|format(round_up) }}</td>
        </tr>
        {% endif %}
    </table>

    <!-- Footer -->
    <div style="border-top: 1px solid #cbd5e1; margin-top: 20px; padding-top: 12px; text-align: center;">
        <div style="font-size: 10px; color: #64748b; font-style: italic; margin-bottom: 3px;">
            This is a system-generated receipt and does not require a signature.
        </div>
        <div style="font-size: 10.5px; color: #162a45; font-weight: bold;">
            RenoPay &mdash; Secure Payments Platform
        </div>
    </div>
</div>
</body>
</html>""",

    "full_accounting_pack": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — Full Accounting Pack</title>
<style>
{{ css }}
</style>
</head>
<body>
<div class="page">
    <!-- Header banner -->
    <table class="header-table" cellpadding="0" cellspacing="0">
        <tr>
            <td valign="middle">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span></div>
                <div class="logo-sub">Grounded AI Double-Entry Accounting Statement</div>
            </td>
            <td valign="middle" class="meta-box">
                <div><strong>{{ account_name }}</strong></div>
                <div>Generated: {{ generated_at }}</div>
                {% if period_str %}<div>Period: <strong style="color: #e06a10;">{{ period_str }}</strong></div>{% endif %}
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange"></div>

    <!-- 1. Journal Entries -->
    <div class="section-title">1. Journal Entries</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="15%" align="left">Entry No</th>
                <th width="15%" align="left">Date</th>
                <th width="22%" align="left">Narration</th>
                <th width="18%" align="left">Debit Account</th>
                <th width="18%" align="left">Credit Account</th>
                <th width="12%" align="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            {% for je in journal_entries %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-weight: bold; font-family: Courier, monospace;">{{ je.entry_no }}</td>
                <td>{{ je.date }}</td>
                <td>{{ je.narration }}</td>
                <td>{{ je.debit_account }}</td>
                <td>{{ je.credit_account }}</td>
                <td align="right" style="font-weight: bold;">{{ je.amount }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="4" style="border-right: none;"></td>
                <td align="right" style="border-left: none; border-right: none;">Total</td>
                <td align="right">{{ total_journal_amount }}</td>
            </tr>
        </tbody>
    </table>

    <!-- 2. General Ledger -->
    <div class="section-title" style="margin-top: 26px;">2. General Ledger</div>
    {% for gl in general_ledgers %}
    <div class="sub-section-title">{{ gl.code }} &nbsp;-&nbsp; {{ gl.name }}</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="11%" align="left">Date</th>
                <th width="15%" align="left">Entry No</th>
                <th width="20%" align="left">Narration</th>
                <th width="22%" align="left">Payee</th>
                <th width="11%" align="right">Debit</th>
                <th width="10%" align="right">Credit</th>
                <th width="11%" align="right">Balance</th>
            </tr>
        </thead>
        <tbody>
            {% for line in gl.lines %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td>{{ line.date }}</td>
                <td style="font-family: Courier, monospace;">{{ line.entry_no }}</td>
                <td>{{ line.narration }}</td>
                <td>{{ line.payee or '—' }}</td>
                <td align="right">{{ line.debit }}</td>
                <td align="right">{{ line.credit }}</td>
                <td align="right" style="font-weight: bold;">{{ line.balance }}</td>
            </tr>
            {% endfor %}
            <tr class="closing-row">
                <td colspan="6" align="right" style="border-right: none;">Closing Balance</td>
                <td align="right">{{ gl.closing_balance }}</td>
            </tr>
        </tbody>
    </table>
    {% endfor %}

    <!-- 3. Payee-wise Ledger -->
    <div class="section-title" style="margin-top: 26px;">3. Payee-wise Ledger</div>
    {% for pl in payee_ledgers %}
    <div class="sub-section-title">{{ pl.payee_vpa }}</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="12%" align="left">Date</th>
                <th width="16%" align="left">Entry No</th>
                <th width="24%" align="left">Narration</th>
                <th width="24%" align="left">Account</th>
                <th width="12%" align="right">Debit</th>
                <th width="12%" align="right">Credit</th>
            </tr>
        </thead>
        <tbody>
            {% for line in pl.lines %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td>{{ line.date }}</td>
                <td style="font-family: Courier, monospace;">{{ line.entry_no }}</td>
                <td>{{ line.narration }}</td>
                <td>{{ line.account_name }}</td>
                <td align="right">{{ line.debit }}</td>
                <td align="right">{{ line.credit }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="4" align="right" style="border-right: none;">Total</td>
                <td align="right">{{ pl.total_debit }}</td>
                <td align="right">{{ pl.total_credit }}</td>
            </tr>
        </tbody>
    </table>
    {% endfor %}

    {% if trial_balance and trial_balance.rows %}
    <!-- 4. Trial Balance -->
    <div class="section-title" style="margin-top: 26px;">4. Trial Balance</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="15%" align="left">Code</th>
                <th width="45%" align="left">Account Name</th>
                <th width="20%" align="right">Debit</th>
                <th width="20%" align="right">Credit</th>
            </tr>
        </thead>
        <tbody>
            {% for row in trial_balance.rows %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ row.code }}</td>
                <td>{{ row.name }}</td>
                <td align="right">{{ row.debit if row.debit else '' }}</td>
                <td align="right">{{ row.credit if row.credit else '' }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Totals</td>
                <td align="right">{{ trial_balance.total_debit }}</td>
                <td align="right">{{ trial_balance.total_credit }}</td>
            </tr>
        </tbody>
    </table>
    {% endif %}

    {% if pnl %}
    <div class="page-break"></div>
    <div class="section-title">5. Profit &amp; Loss Statement (Income Statement)</div>
    <div class="sub-section-title">Income &amp; Revenue</div>
    <table class="report-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="15%">Account</th>
                <th width="65%">Category / Particulars</th>
                <th width="20%" align="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            {% for r in pnl.income_rows %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ r.code }}</td>
                <td>{{ r.name }}</td>
                <td align="right" style="color: #15803d; font-weight: bold;">+ {{ r.amount }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Total Income</td>
                <td align="right" style="color: #15803d;">{{ pnl.total_income }}</td>
            </tr>
        </tbody>
    </table>

    <div class="sub-section-title">Operating &amp; Direct Expenses</div>
    <table class="report-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="15%">Account</th>
                <th width="65%">Category / Particulars</th>
                <th width="20%" align="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            {% for r in pnl.expense_rows %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ r.code }}</td>
                <td>{{ r.name }}</td>
                <td align="right" style="color: #dc2626; font-weight: bold;">- {{ r.amount }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Total Expenses</td>
                <td align="right" style="color: #dc2626;">{{ pnl.total_expenses }}</td>
            </tr>
        </tbody>
    </table>

    <table class="report-table" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
        <tbody>
            <tr class="closing-row">
                <td width="70%" style="font-size: 11px; font-weight: bold;">NET {{ 'PROFIT' if pnl.is_profit else 'LOSS' }} (Total Income − Total Expenses)</td>
                <td width="30%" align="right" style="font-size: 13px; font-weight: bold; color: {{ '#15803d' if pnl.is_profit else '#dc2626' }};">
                    {{ '+' if pnl.is_profit else '-' }} {{ pnl.net_profit }}
                </td>
            </tr>
        </tbody>
    </table>
    {% endif %}

    {% if balance_sheet %}
    <div class="page-break"></div>
    <div class="section-title">6. Balance Sheet (Statement of Financial Position)</div>
    <div class="sub-section-title">Assets (Cash, Digital Wallets, Receivables)</div>
    <table class="report-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="15%">Code</th>
                <th width="65%">Account</th>
                <th width="20%" align="right">Balance</th>
            </tr>
        </thead>
        <tbody>
            {% for r in balance_sheet.assets %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ r.code }}</td>
                <td>{{ r.name }}</td>
                <td align="right">{{ r.balance }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Total Assets</td>
                <td align="right" style="color: #162a45;">{{ balance_sheet.total_assets }}</td>
            </tr>
        </tbody>
    </table>

    <div class="sub-section-title">Liabilities &amp; Obligations</div>
    <table class="report-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="15%">Code</th>
                <th width="65%">Account</th>
                <th width="20%" align="right">Balance</th>
            </tr>
        </thead>
        <tbody>
            {% for r in balance_sheet.liabilities %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ r.code }}</td>
                <td>{{ r.name }}</td>
                <td align="right">{{ r.balance }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Total Liabilities</td>
                <td align="right">{{ balance_sheet.total_liabilities }}</td>
            </tr>
        </tbody>
    </table>

    <div class="sub-section-title">Owner's Equity &amp; Retained Earnings</div>
    <table class="report-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="15%">Code</th>
                <th width="65%">Account</th>
                <th width="20%" align="right">Balance</th>
            </tr>
        </thead>
        <tbody>
            {% for r in balance_sheet.equity %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ r.code }}</td>
                <td>{{ r.name }}</td>
                <td align="right">{{ r.balance }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Total Equity</td>
                <td align="right">{{ balance_sheet.total_equity }}</td>
            </tr>
        </tbody>
    </table>

    <table class="report-table" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
        <tbody>
            <tr class="closing-row">
                <td width="70%" style="font-size: 11px; font-weight: bold;">TOTAL LIABILITIES &amp; EQUITY</td>
                <td width="30%" align="right" style="font-size: 12px; font-weight: bold;">{{ balance_sheet.total_liabilities_equity }}</td>
            </tr>
            <tr>
                <td colspan="2" align="center" style="background: #f8fafc; font-size: 10px; font-weight: bold; color: {{ '#15803d' if balance_sheet.balanced else '#dc2626' }};">
                    {{ '✓ Assets = Liabilities + Equity (Balanced Statement)' if balance_sheet.balanced else '⚠ Attention: Imbalance detected in Assets vs Liabilities+Equity' }}
                </td>
            </tr>
        </tbody>
    </table>
    {% endif %}

    {% if cash_flow %}
    <div class="page-break"></div>
    <div class="section-title">7. Cash Flow Statement (Digital Cash &amp; Bank Movement)</div>
    <table class="report-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="75%">Cash Flow Component</th>
                <th width="25%" align="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
                <td>Opening Cash &amp; Digital Balances</td>
                <td align="right">{{ cash_flow.opening_balance }}</td>
            </tr>
            <tr class="total-row">
                <td colspan="2" style="background-color: #f8fafc; font-size: 10.5px; color: #162a45;">Operating Activities (Collections &amp; Payments)</td>
            </tr>
            {% for r in cash_flow.operating_inflows %}
            <tr class="odd">
                <td style="padding-left: 20px;">Cash Inflow: {{ r.name }}</td>
                <td align="right" style="color: #15803d;">+ {{ r.amount }}</td>
            </tr>
            {% endfor %}
            {% for r in cash_flow.operating_outflows %}
            <tr class="even">
                <td style="padding-left: 20px;">Cash Outflow: {{ r.name }}</td>
                <td align="right" style="color: #dc2626;">- {{ r.amount }}</td>
            </tr>
            {% endfor %}
            <tr style="font-weight: bold; background: #fff;">
                <td style="padding-left: 10px;">Net Cash from Operating Activities</td>
                <td align="right">{{ cash_flow.operating_net }}</td>
            </tr>

            <tr class="total-row">
                <td colspan="2" style="background-color: #f8fafc; font-size: 10.5px; color: #162a45;">Investing Activities (Digital Gold &amp; Investments)</td>
            </tr>
            {% for r in cash_flow.investing_inflows %}
            <tr class="odd">
                <td style="padding-left: 20px;">Cash Inflow: {{ r.name }}</td>
                <td align="right" style="color: #15803d;">+ {{ r.amount }}</td>
            </tr>
            {% endfor %}
            {% for r in cash_flow.investing_outflows %}
            <tr class="even">
                <td style="padding-left: 20px;">Cash Outflow: {{ r.name }}</td>
                <td align="right" style="color: #dc2626;">- {{ r.amount }}</td>
            </tr>
            {% endfor %}
            <tr style="font-weight: bold; background: #fff;">
                <td style="padding-left: 10px;">Net Cash from Investing Activities</td>
                <td align="right">{{ cash_flow.investing_net }}</td>
            </tr>

            <tr class="total-row">
                <td colspan="2" style="background-color: #f8fafc; font-size: 10.5px; color: #162a45;">Financing Activities (Capital, Loans &amp; Transfers)</td>
            </tr>
            {% for r in cash_flow.financing_inflows %}
            <tr class="odd">
                <td style="padding-left: 20px;">Cash Inflow: {{ r.name }}</td>
                <td align="right" style="color: #15803d;">+ {{ r.amount }}</td>
            </tr>
            {% endfor %}
            {% for r in cash_flow.financing_outflows %}
            <tr class="even">
                <td style="padding-left: 20px;">Cash Outflow: {{ r.name }}</td>
                <td align="right" style="color: #dc2626;">- {{ r.amount }}</td>
            </tr>
            {% endfor %}
            <tr style="font-weight: bold; background: #fff;">
                <td style="padding-left: 10px;">Net Cash from Financing Activities</td>
                <td align="right">{{ cash_flow.financing_net }}</td>
            </tr>

            <tr class="total-row">
                <td>Net Increase / (Decrease) in Cash &amp; Bank</td>
                <td align="right" style="color: {{ '#15803d' if cash_flow.is_positive else '#dc2626' }};">{{ cash_flow.net_change }}</td>
            </tr>
            <tr class="closing-row">
                <td style="font-size: 11px; font-weight: bold;">Closing Cash &amp; Digital Balances</td>
                <td align="right" style="font-size: 12px; font-weight: bold; color: #162a45;">{{ cash_flow.closing_balance }}</td>
            </tr>
        </tbody>
    </table>
    {% endif %}

    <div class="footer-text">
        RenoPay Double-Entry Accounting Engine &mdash; Immutable Ledger Record &mdash; Generated {{ generated_at }}
    </div>
</div>
</body>
</html>""",

    "balance_sheet": """<!DOCTYPE html><html><head><meta charset="utf-8"><title>RenoPay — Balance Sheet</title><style>{{ css }}</style></head>
<body><div class="page">
<table class="header-table" cellpadding="0" cellspacing="0">
  <tr>
    <td><div class="logo-title">Reno<span class="logo-accent">Pay</span></div><div class="logo-sub">Balance Sheet &mdash; Statement of Financial Position</div></td>
    <td class="meta-box"><div><strong>As of: {{ as_of_str or period or 'Latest' }}</strong></div><div>Holder: {{ account_name }}</div><div>Generated: {{ generated_at }}</div></td>
  </tr>
</table>
<div class="accent-line-navy"></div><div class="accent-line-orange"></div>

{% if balance_sheet and balance_sheet.assets is defined %}
<div class="section-title">Assets (Cash, Digital Wallets, Receivables)</div>
<table class="report-table" cellpadding="0" cellspacing="0">
  <thead><tr><th width="15%">Code</th><th width="65%">Account</th><th width="20%" align="right">Balance</th></tr></thead>
  <tbody>
    {% for r in balance_sheet.assets %}
    <tr class="{{ 'even' if loop.index is even else 'odd' }}">
      <td style="font-family: Courier, monospace;">{{ r.code }}</td><td>{{ r.name }}</td><td align="right">{{ r.balance }}</td>
    </tr>
    {% endfor %}
    <tr class="total-row"><td colspan="2" align="right" style="border-right: none;">Total Assets</td><td align="right" style="color:#162a45;">{{ balance_sheet.total_assets }}</td></tr>
  </tbody>
</table>

<div class="section-title">Liabilities &amp; Obligations</div>
<table class="report-table" cellpadding="0" cellspacing="0">
  <thead><tr><th width="15%">Code</th><th width="65%">Account</th><th width="20%" align="right">Balance</th></tr></thead>
  <tbody>
    {% for r in balance_sheet.liabilities %}
    <tr class="{{ 'even' if loop.index is even else 'odd' }}">
      <td style="font-family: Courier, monospace;">{{ r.code }}</td><td>{{ r.name }}</td><td align="right">{{ r.balance }}</td>
    </tr>
    {% endfor %}
    <tr class="total-row"><td colspan="2" align="right" style="border-right: none;">Total Liabilities</td><td align="right">{{ balance_sheet.total_liabilities }}</td></tr>
  </tbody>
</table>

<div class="section-title">Owner's Equity &amp; Retained Earnings</div>
<table class="report-table" cellpadding="0" cellspacing="0">
  <thead><tr><th width="15%">Code</th><th width="65%">Account</th><th width="20%" align="right">Balance</th></tr></thead>
  <tbody>
    {% for r in balance_sheet.equity %}
    <tr class="{{ 'even' if loop.index is even else 'odd' }}">
      <td style="font-family: Courier, monospace;">{{ r.code }}</td><td>{{ r.name }}</td><td align="right">{{ r.balance }}</td>
    </tr>
    {% endfor %}
    <tr class="total-row"><td colspan="2" align="right" style="border-right: none;">Total Equity</td><td align="right">{{ balance_sheet.total_equity }}</td></tr>
  </tbody>
</table>

<table class="report-table" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
  <tbody>
    <tr class="closing-row">
      <td width="70%" style="font-size: 11px; font-weight: bold;">TOTAL LIABILITIES &amp; EQUITY</td>
      <td width="30%" align="right" style="font-size: 12px; font-weight: bold;">{{ balance_sheet.total_liabilities_equity }}</td>
    </tr>
    <tr>
      <td colspan="2" align="center" style="background: #f8fafc; font-size: 10.5px; font-weight: bold; padding: 10px; color: {{ '#15803d' if balance_sheet.balanced else '#dc2626' }};">
        {{ '✓ Assets = Liabilities + Equity (Balanced Financial Position)' if balance_sheet.balanced else '⚠ Attention: Imbalance detected in Assets vs Liabilities+Equity' }}
      </td>
    </tr>
  </tbody>
</table>
{% else %}
<div class="section-title">Summary</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Total Income</th><th>Total Expenses</th><th>Net Balance</th></tr></thead>
  <tbody>
    <tr>
      <td style="font-weight:bold; color:#15803d; font-size:12px;">Rs {{ "%.2f"|format(total_income or 0) }}</td>
      <td style="font-weight:bold; color:#dc2626; font-size:12px;">Rs {{ "%.2f"|format(total_spent or 0) }}</td>
      <td style="font-weight:bold; color:{{'#15803d' if (net or 0) >= 0 else '#dc2626'}}; font-size:12px;">Rs {{ "%.2f"|format(net or 0) }}</td>
    </tr>
  </tbody>
</table>
{% endif %}
<div class="footer-text">RenoPay Double-Entry Accounting Engine &mdash; Immutable Ledger Record &mdash; Generated {{ generated_at }}</div>
</div></body></html>""",

    "profit_loss": """<!DOCTYPE html><html><head><meta charset="utf-8"><title>RenoPay — Profit &amp; Loss</title><style>{{ css }}</style></head>
<body><div class="page">
<table class="header-table" cellpadding="0" cellspacing="0">
  <tr>
    <td><div class="logo-title">Reno<span class="logo-accent">Pay</span></div><div class="logo-sub">Profit &amp; Loss &mdash; Statement of Financial Performance</div></td>
    <td class="meta-box"><div><strong>Period: {{ period_str or period or 'All Time' }}</strong></div><div>Holder: {{ account_name }}</div><div>Generated: {{ generated_at }}</div></td>
  </tr>
</table>
<div class="accent-line-navy"></div><div class="accent-line-orange"></div>

{% if pnl and pnl.income_rows is defined %}
<div class="section-title">Income &amp; Revenue</div>
<table class="report-table" cellpadding="0" cellspacing="0">
  <thead><tr><th width="15%">Account</th><th width="65%">Category / Particulars</th><th width="20%" align="right">Amount</th></tr></thead>
  <tbody>
    {% for r in pnl.income_rows %}
    <tr class="{{ 'even' if loop.index is even else 'odd' }}">
      <td style="font-family: Courier, monospace;">{{ r.code }}</td><td>{{ r.name }}</td><td align="right" style="color: #15803d; font-weight: bold;">+ {{ r.amount }}</td>
    </tr>
    {% endfor %}
    <tr class="total-row"><td colspan="2" align="right" style="border-right: none;">Total Income</td><td align="right" style="color: #15803d;">{{ pnl.total_income }}</td></tr>
  </tbody>
</table>

<div class="section-title">Operating &amp; Direct Expenses</div>
<table class="report-table" cellpadding="0" cellspacing="0">
  <thead><tr><th width="15%">Account</th><th width="65%">Category / Particulars</th><th width="20%" align="right">Amount</th></tr></thead>
  <tbody>
    {% for r in pnl.expense_rows %}
    <tr class="{{ 'even' if loop.index is even else 'odd' }}">
      <td style="font-family: Courier, monospace;">{{ r.code }}</td><td>{{ r.name }}</td><td align="right" style="color: #dc2626; font-weight: bold;">- {{ r.amount }}</td>
    </tr>
    {% endfor %}
    <tr class="total-row"><td colspan="2" align="right" style="border-right: none;">Total Expenses</td><td align="right" style="color: #dc2626;">{{ pnl.total_expenses }}</td></tr>
  </tbody>
</table>

<table class="report-table" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
  <tbody>
    <tr class="closing-row">
      <td width="70%" style="font-size: 11px; font-weight: bold;">NET {{ 'PROFIT' if pnl.is_profit else 'LOSS' }} (Total Income − Total Expenses)</td>
      <td width="30%" align="right" style="font-size: 13px; font-weight: bold; color: {{ '#15803d' if pnl.is_profit else '#dc2626' }};">
        {{ '+' if pnl.is_profit else '-' }} {{ pnl.net_profit }}
      </td>
    </tr>
  </tbody>
</table>
{% else %}
<div class="section-title">Performance Summary</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Gross Income</th><th>Total Expenses</th><th>Net Result</th></tr></thead>
  <tbody>
    <tr>
      <td style="font-weight:bold; color:#15803d; font-size:12px;">+ Rs {{ "%.2f"|format(total_income or 0) }}</td>
      <td style="font-weight:bold; color:#dc2626; font-size:12px;">- Rs {{ "%.2f"|format(total_spent or 0) }}</td>
      <td style="font-weight:bold; color:{{'#15803d' if (net or 0) >= 0 else '#dc2626'}}; font-size:12px;">Rs {{ "%.2f"|format(net or 0) }}</td>
    </tr>
  </tbody>
</table>
{% endif %}
<div class="footer-text">RenoPay Double-Entry Accounting Engine &mdash; Immutable Ledger Record &mdash; Generated {{ generated_at }}</div>
</div></body></html>""",

    "cash_flow": """<!DOCTYPE html><html><head><meta charset="utf-8"><title>RenoPay — Cash Flow Statement</title><style>{{ css }}</style></head>
<body><div class="page">
<table class="header-table" cellpadding="0" cellspacing="0">
  <tr>
    <td><div class="logo-title">Reno<span class="logo-accent">Pay</span></div><div class="logo-sub">Cash Flow Statement &mdash; Direct Method</div></td>
    <td class="meta-box"><div><strong>Period: {{ period_str or period or 'All Time' }}</strong></div><div>Holder: {{ account_name }}</div><div>Generated: {{ generated_at }}</div></td>
  </tr>
</table>
<div class="accent-line-navy"></div><div class="accent-line-orange"></div>

{% if cash_flow %}
<div class="section-title">Cash &amp; Bank Movements Summary</div>
<table class="report-table" cellpadding="0" cellspacing="0">
  <thead>
    <tr>
      <th width="75%">Cash Flow Component</th>
      <th width="25%" align="right">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td>Opening Cash &amp; Digital Balances</td>
      <td align="right">{{ cash_flow.opening_balance }}</td>
    </tr>
    <tr class="total-row">
      <td colspan="2" style="background-color: #f8fafc; font-size: 10.5px; color: #162a45;">Operating Activities (Collections &amp; Payments)</td>
    </tr>
    {% for r in cash_flow.operating_inflows %}
    <tr class="odd">
      <td style="padding-left: 20px;">Cash Inflow: {{ r.name }}</td>
      <td align="right" style="color: #15803d;">+ {{ r.amount }}</td>
    </tr>
    {% endfor %}
    {% for r in cash_flow.operating_outflows %}
    <tr class="even">
      <td style="padding-left: 20px;">Cash Outflow: {{ r.name }}</td>
      <td align="right" style="color: #dc2626;">- {{ r.amount }}</td>
    </tr>
    {% endfor %}
    <tr style="font-weight: bold; background: #fff;">
      <td style="padding-left: 10px;">Net Cash from Operating Activities</td>
      <td align="right">{{ cash_flow.operating_net }}</td>
    </tr>

    <tr class="total-row">
      <td colspan="2" style="background-color: #f8fafc; font-size: 10.5px; color: #162a45;">Investing Activities (Digital Gold &amp; Investments)</td>
    </tr>
    {% for r in cash_flow.investing_inflows %}
    <tr class="odd">
      <td style="padding-left: 20px;">Cash Inflow: {{ r.name }}</td>
      <td align="right" style="color: #15803d;">+ {{ r.amount }}</td>
    </tr>
    {% endfor %}
    {% for r in cash_flow.investing_outflows %}
    <tr class="even">
      <td style="padding-left: 20px;">Cash Outflow: {{ r.name }}</td>
      <td align="right" style="color: #dc2626;">- {{ r.amount }}</td>
    </tr>
    {% endfor %}
    <tr style="font-weight: bold; background: #fff;">
      <td style="padding-left: 10px;">Net Cash from Investing Activities</td>
      <td align="right">{{ cash_flow.investing_net }}</td>
    </tr>

    <tr class="total-row">
      <td colspan="2" style="background-color: #f8fafc; font-size: 10.5px; color: #162a45;">Financing Activities (Capital, Loans &amp; Transfers)</td>
    </tr>
    {% for r in cash_flow.financing_inflows %}
    <tr class="odd">
      <td style="padding-left: 20px;">Cash Inflow: {{ r.name }}</td>
      <td align="right" style="color: #15803d;">+ {{ r.amount }}</td>
    </tr>
    {% endfor %}
    {% for r in cash_flow.financing_outflows %}
    <tr class="even">
      <td style="padding-left: 20px;">Cash Outflow: {{ r.name }}</td>
      <td align="right" style="color: #dc2626;">- {{ r.amount }}</td>
    </tr>
    {% endfor %}
    <tr style="font-weight: bold; background: #fff;">
      <td style="padding-left: 10px;">Net Cash from Financing Activities</td>
      <td align="right">{{ cash_flow.financing_net }}</td>
    </tr>

    <tr class="total-row">
      <td>Net Increase / (Decrease) in Cash &amp; Bank</td>
      <td align="right" style="color: {{ '#15803d' if cash_flow.is_positive else '#dc2626' }};">{{ cash_flow.net_change }}</td>
    </tr>
    <tr class="closing-row">
      <td style="font-size: 11px; font-weight: bold;">Closing Cash &amp; Digital Balances</td>
      <td align="right" style="font-size: 12px; font-weight: bold; color: #162a45;">{{ cash_flow.closing_balance }}</td>
    </tr>
  </tbody>
</table>
{% endif %}
<div class="footer-text">RenoPay Double-Entry Accounting Engine &mdash; Immutable Ledger Record &mdash; Generated {{ generated_at }}</div>
</div></body></html>""",

    "journal": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — Journal Entries</title>
<style>
{{ css }}
</style>
</head>
<body>
<div class="page">
    <table class="header-table" cellpadding="0" cellspacing="0">
        <tr>
            <td valign="middle">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span></div>
                <div class="logo-sub">Official Double-Entry Journal Statement</div>
            </td>
            <td valign="middle" class="meta-box">
                <div><strong>{{ account_name }}</strong></div>
                <div>Generated: {{ generated_at }}</div>
                {% if period_str %}<div>Period: <strong style="color: #e06a10;">{{ period_str }}</strong></div>{% endif %}
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange"></div>

    <div class="section-title">Journal Entries</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="15%" align="left">Entry No</th>
                <th width="15%" align="left">Date</th>
                <th width="22%" align="left">Narration</th>
                <th width="18%" align="left">Debit Account</th>
                <th width="18%" align="left">Credit Account</th>
                <th width="12%" align="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            {% for je in journal_entries %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-weight: bold; font-family: Courier, monospace;">{{ je.entry_no }}</td>
                <td>{{ je.date }}</td>
                <td>{{ je.narration }}</td>
                <td>{{ je.debit_account }}</td>
                <td>{{ je.credit_account }}</td>
                <td align="right" style="font-weight: bold;">{{ je.amount }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="4" style="border-right: none;"></td>
                <td align="right" style="border-left: none; border-right: none;">Total</td>
                <td align="right">{{ total_journal_amount }}</td>
            </tr>
        </tbody>
    </table>

    <div class="footer-text">
        RenoPay Double-Entry Accounting Engine &mdash; Immutable Journal Record &mdash; Generated {{ generated_at }}
    </div>
</div>
</body>
</html>""",

    "general_ledger": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — General Ledger</title>
<style>
{{ css }}
</style>
</head>
<body>
<div class="page">
    <table class="header-table" cellpadding="0" cellspacing="0">
        <tr>
            <td valign="middle">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span></div>
                <div class="logo-sub">General Ledger Statement</div>
            </td>
            <td valign="middle" class="meta-box">
                <div><strong>{{ account_name }}</strong></div>
                <div>Generated: {{ generated_at }}</div>
                {% if period_str %}<div>Period: <strong style="color: #e06a10;">{{ period_str }}</strong></div>{% endif %}
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange"></div>

    <div class="section-title">General Ledger Accounts</div>
    {% for gl in general_ledgers %}
    <div class="sub-section-title">{{ gl.code }} &nbsp;-&nbsp; {{ gl.name }}</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="11%" align="left">Date</th>
                <th width="15%" align="left">Entry No</th>
                <th width="20%" align="left">Narration</th>
                <th width="22%" align="left">Payee</th>
                <th width="11%" align="right">Debit</th>
                <th width="10%" align="right">Credit</th>
                <th width="11%" align="right">Balance</th>
            </tr>
        </thead>
        <tbody>
            {% for line in gl.lines %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td>{{ line.date }}</td>
                <td style="font-family: Courier, monospace;">{{ line.entry_no }}</td>
                <td>{{ line.narration }}</td>
                <td>{{ line.payee or '—' }}</td>
                <td align="right">{{ line.debit }}</td>
                <td align="right">{{ line.credit }}</td>
                <td align="right" style="font-weight: bold;">{{ line.balance }}</td>
            </tr>
            {% endfor %}
            <tr class="closing-row">
                <td colspan="6" align="right" style="border-right: none;">Closing Balance</td>
                <td align="right">{{ gl.closing_balance }}</td>
            </tr>
        </tbody>
    </table>
    {% endfor %}

    <div class="footer-text">
        RenoPay Double-Entry Accounting Engine &mdash; Immutable General Ledger &mdash; Generated {{ generated_at }}
    </div>
</div>
</body>
</html>""",

    "payee_ledger": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — Payee Ledgers</title>
<style>
{{ css }}
</style>
</head>
<body>
<div class="page">
    <table class="header-table" cellpadding="0" cellspacing="0">
        <tr>
            <td valign="middle">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span></div>
                <div class="logo-sub">Payee-wise Ledger Statement</div>
            </td>
            <td valign="middle" class="meta-box">
                <div><strong>{{ account_name }}</strong></div>
                <div>Generated: {{ generated_at }}</div>
                {% if period_str %}<div>Period: <strong style="color: #e06a10;">{{ period_str }}</strong></div>{% endif %}
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange"></div>

    <div class="section-title">Payee Ledgers</div>
    {% for pl in payee_ledgers %}
    <div class="sub-section-title">{{ pl.payee_vpa }}</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="12%" align="left">Date</th>
                <th width="16%" align="left">Entry No</th>
                <th width="24%" align="left">Narration</th>
                <th width="24%" align="left">Account</th>
                <th width="12%" align="right">Debit</th>
                <th width="12%" align="right">Credit</th>
            </tr>
        </thead>
        <tbody>
            {% for line in pl.lines %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td>{{ line.date }}</td>
                <td style="font-family: Courier, monospace;">{{ line.entry_no }}</td>
                <td>{{ line.narration }}</td>
                <td>{{ line.account_name }}</td>
                <td align="right">{{ line.debit }}</td>
                <td align="right">{{ line.credit }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="4" align="right" style="border-right: none;">Total</td>
                <td align="right">{{ pl.total_debit }}</td>
                <td align="right">{{ pl.total_credit }}</td>
            </tr>
        </tbody>
    </table>
    {% endfor %}

    <div class="footer-text">
        RenoPay Double-Entry Accounting Engine &mdash; Immutable Payee Record &mdash; Generated {{ generated_at }}
    </div>
</div>
</body>
</html>""",

    "trial_balance": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — Trial Balance</title>
<style>
{{ css }}
</style>
</head>
<body>
<div class="page">
    <table class="header-table" cellpadding="0" cellspacing="0">
        <tr>
            <td valign="middle">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span></div>
                <div class="logo-sub">Trial Balance Statement</div>
            </td>
            <td valign="middle" class="meta-box">
                <div><strong>{{ account_name }}</strong></div>
                <div>Generated: {{ generated_at }}</div>
                {% if period_str %}<div>As of: <strong style="color: #e06a10;">{{ period_str }}</strong></div>{% endif %}
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange"></div>

    <div class="section-title">Trial Balance</div>
    <table class="report-table" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th width="15%" align="left">Code</th>
                <th width="45%" align="left">Account Name</th>
                <th width="20%" align="right">Debit</th>
                <th width="20%" align="right">Credit</th>
            </tr>
        </thead>
        <tbody>
            {% for row in trial_balance.rows %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-family: Courier, monospace;">{{ row.code }}</td>
                <td>{{ row.name }}</td>
                <td align="right">{{ row.debit if row.debit else '' }}</td>
                <td align="right">{{ row.credit if row.credit else '' }}</td>
            </tr>
            {% endfor %}
            <tr class="total-row">
                <td colspan="2" align="right" style="border-right: none;">Totals</td>
                <td align="right">{{ trial_balance.total_debit }}</td>
                <td align="right">{{ trial_balance.total_credit }}</td>
            </tr>
        </tbody>
    </table>

    <div class="footer-text">
        RenoPay Double-Entry Accounting Engine &mdash; Balanced Books &mdash; Generated {{ generated_at }}
    </div>
</div>
</body>
</html>""",

    "expense_report": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay &mdash; Expense & Financial Statement</title>
<style>
{{ css }}
@page {
    size: A4 portrait;
    margin: 10mm 12mm;
}
body {
    background-color: #ffffff;
    font-family: Helvetica, Arial, sans-serif;
    color: #1e293b;
    font-size: 11px;
}
.page-wrapper {
    width: 100%;
    margin: 0;
    padding: 0;
}
.card-metric {
    border: 1px solid #e2e8f0;
    background-color: #f8fafc;
    padding: 8px 10px;
    text-align: left;
}
.metric-title {
    font-size: 8.5px;
    font-weight: bold;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 3px;
}
.metric-value {
    font-size: 15px;
    font-weight: bold;
    font-family: Courier, monospace;
}
.bar-container {
    background-color: #e2e8f0;
    height: 10px;
    width: 100%;
    position: relative;
}
.bar-fill {
    height: 10px;
}
.pill {
    padding: 2px 6px;
    font-size: 8.5px;
    font-weight: bold;
}
</style>
</head>
<body>

<!-- ================= PAGE 1: VISUAL GRAPHS & SUMMARY KPIS ================= -->
<div class="page-wrapper">
    <!-- Header -->
    <table class="header-table" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
        <tr>
            <td width="58%" valign="top">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span> <span style="font-size: 14px; font-weight: bold; color: #64748b;">Analytics</span></div>
                <div class="logo-sub">Smart Expense Tracker & Financial Intelligence</div>
                <div style="margin-top: 4px; font-size: 9.5px; color: #334155;">
                    <strong>Account Holder:</strong> {{ user_name }} &bull; <span style="font-family: Courier, monospace; color: #0284c7;">{{ vpa }}</span>
                </div>
            </td>
            <td width="42%" align="right" valign="top" class="meta-box">
                <div style="font-size: 13px; font-weight: bold; color: #162a45;">EXPENSE REPORT</div>
                <div style="color: #e06a10; font-weight: bold; font-size: 10.5px; margin-top: 2px;">{{ period_label }}</div>
                <div style="margin-top: 2px;">Generated: {{ generated_at }}</div>
                <div style="margin-top: 1px; color: #16a34a; font-weight: bold;">Certified Digital Record</div>
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange" style="margin-bottom: 12px;"></div>

    <!-- 4 KPI Cards -->
    <table width="100%" cellpadding="0" cellspacing="6" style="margin-bottom: 10px;">
        <tr>
            <td width="25%">
                <div class="card-metric" style="border-left: 3px solid #dc2626;">
                    <div class="metric-title">Total Spent</div>
                    <div class="metric-value" style="color: #dc2626;">Rs. {{ total_spent_fmt }}</div>
                    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 2px;">{{ debit_count }} Expenses</div>
                </div>
            </td>
            <td width="25%">
                <div class="card-metric" style="border-left: 3px solid #16a34a;">
                    <div class="metric-title">Total Inflow</div>
                    <div class="metric-value" style="color: #16a34a;">Rs. {{ total_income_fmt }}</div>
                    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 2px;">{{ credit_count }} Credits</div>
                </div>
            </td>
            <td width="25%">
                <div class="card-metric" style="border-left: 3px solid #2563eb;">
                    <div class="metric-title">Net Savings</div>
                    <div class="metric-value" style="color: {{ '#16a34a' if net >= 0 else '#dc2626' }};">Rs. {{ net_fmt }}</div>
                    <div style="font-size: 8.5px; color: #94a3b8; margin-top: 2px;">{{ 'Surplus' if net >= 0 else 'Deficit' }}</div>
                </div>
            </td>
            <td width="25%">
                <div class="card-metric" style="border-left: 3px solid #7c3aed;">
                    <div class="metric-title">Monthly Budget</div>
                    <div class="metric-value" style="color: #7c3aed;">Rs. {{ budget_fmt }}</div>
                    <div style="font-size: 8.5px; color: {{ '#dc2626' if budget_used_percent > 85 else '#16a34a' }}; margin-top: 2px;">
                        {{ budget_used_percent }}% Used
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <!-- Budget Gauge Section -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 12px; padding: 8px 10px;">
        <tr>
            <td>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="font-size: 10.5px; font-weight: bold; color: #1e293b;">
                            Monthly Budget Adherence Gauge
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: bold; color: {{ '#dc2626' if budget_used_percent > 85 else '#d97706' if budget_used_percent > 65 else '#16a34a' }};">
                            Rs. {{ total_spent_fmt }} / Rs. {{ budget_fmt }} ({{ budget_used_percent }}%)
                        </td>
                    </tr>
                </table>
                <div class="bar-container" style="margin-top: 6px;">
                    <div class="bar-fill" style="width: {{ budget_bar_width }}%; background-color: {{ '#dc2626' if budget_used_percent > 85 else '#d97706' if budget_used_percent > 65 else '#16a34a' }};"></div>
                </div>
                <div style="font-size: 8.5px; color: #64748b; margin-top: 4px;">
                    Status: <strong>{{ budget_status_text }}</strong> &bull; Remaining: Rs. {{ budget_remaining_fmt }}
                </div>
            </td>
        </tr>
    </table>

    <!-- Visual Category Breakdown Chart -->
    <div class="sub-section-title" style="margin-top: 4px; margin-bottom: 6px;">
        Spending Breakdown by Category (Visual Graph)
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" class="report-table" style="margin-bottom: 10px;">
        <thead>
            <tr>
                <th width="22%">Category</th>
                <th width="44%">Visual Distribution Graph</th>
                <th width="12%" align="center">Txns</th>
                <th width="22%" align="right">Amount (Rs.)</th>
            </tr>
        </thead>
        <tbody>
            {% for cat in by_category %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td style="font-weight: bold;">
                    <span style="display: inline-block; width: 8px; height: 8px; background-color: {{ cat.color }}; margin-right: 4px;"></span>
                    {{ cat.category }}
                </td>
                <td style="padding: 4px 6px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td width="80%">
                                <div class="bar-container">
                                    <div class="bar-fill" style="width: {{ cat.percent_clamped }}%; background-color: {{ cat.color }};"></div>
                                </div>
                            </td>
                            <td width="20%" align="right" style="font-size: 9px; font-weight: bold; color: #475569; padding-left: 4px;">
                                {{ cat.percent }}%
                            </td>
                        </tr>
                    </table>
                </td>
                <td align="center" style="font-size: 9px; color: #64748b;">{{ cat.count }}</td>
                <td align="right" style="font-weight: bold; font-family: Courier, monospace; color: #0f172a;">
                    Rs. {{ cat.amount_fmt }}
                </td>
            </tr>
            {% endfor %}
            {% if not by_category %}
            <tr>
                <td colspan="4" align="center" style="padding: 16px; color: #94a3b8; font-style: italic;">
                    No categorized expenses during this period.
                </td>
            </tr>
            {% endif %}
            <tr class="total-row">
                <td colspan="2" style="font-weight: bold; color: #162a45;">Total Outflow</td>
                <td align="center" style="font-weight: bold; color: #162a45;">{{ debit_count }}</td>
                <td align="right" style="font-family: Courier, monospace; font-weight: bold; color: #dc2626;">Rs. {{ total_spent_fmt }}</td>
            </tr>
        </tbody>
    </table>

    <!-- Highlights Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 7px 10px; margin-top: 2px;">
        <tr>
            <td width="33%" style="font-size: 9px; color: #9a3412;">
                <strong>Top Category:</strong> {{ top_category or 'N/A' }}
            </td>
            <td width="33%" style="font-size: 9px; color: #9a3412;" align="center">
                <strong>Avg. Expense:</strong> Rs. {{ avg_spend_fmt }}
            </td>
            <td width="33%" style="font-size: 9px; color: #9a3412;" align="right">
                <strong>Financial Health:</strong> {{ health_label }}
            </td>
        </tr>
    </table>

    <div class="footer-text" style="margin-top: 10px;">
        Page 1 of 2 &bull; Visual Analytics & Summary &bull; Turn over for Page 2 itemized transaction records
    </div>
</div>

<!-- ================= PAGE 2: ITEMIZED TRANSACTIONS TABLE ================= -->
<div style="page-break-before: always;" class="page-wrapper">
    <!-- Header -->
    <table class="header-table" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
        <tr>
            <td width="60%" valign="top">
                <div class="logo-title">Reno<span class="logo-accent">Pay</span> <span style="font-size: 14px; font-weight: bold; color: #64748b;">Statement</span></div>
                <div class="logo-sub">Itemized Ledger & Transaction Destination Records</div>
            </td>
            <td width="40%" align="right" valign="top" class="meta-box">
                <div style="font-size: 11.5px; font-weight: bold; color: #162a45;">PAGE 2 &mdash; ITEMIZED DETAILS</div>
                <div style="color: #e06a10; font-size: 9.5px; font-weight: bold;">{{ period_label }}</div>
            </td>
        </tr>
    </table>
    <div class="accent-line-navy"></div>
    <div class="accent-line-orange" style="margin-bottom: 12px;"></div>

    <div class="sub-section-title" style="margin-top: 4px; margin-bottom: 6px;">
        Itemized Transactions & Where Spent
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" class="report-table">
        <thead>
            <tr>
                <th width="5%" align="center">#</th>
                <th width="21%">Date & Time (IST)</th>
                <th width="15%">Category</th>
                <th width="24%">Where Spent / To</th>
                <th width="21%">Purpose / Remarks</th>
                <th width="14%" align="right">Amount (Rs.)</th>
            </tr>
        </thead>
        <tbody>
            {% for t in txns %}
            <tr class="{{ 'even' if loop.index is even else 'odd' }}">
                <td align="center" style="color: #64748b; font-size: 8.5px;">{{ loop.index }}</td>
                <td style="font-size: 9px;">{{ t.date_ist }}</td>
                <td>
                    <span class="pill" style="background-color: {{ t.cat_color_bg }}; color: {{ t.cat_color_text }};">
                        {{ t.category }}
                    </span>
                </td>
                <td style="font-family: Courier, monospace; font-size: 8.5px; word-break: break-all; color: #0284c7;">
                    {{ t.counterparty_vpa }}
                </td>
                <td style="font-size: 9px; color: #334155;">{{ t.description }}</td>
                <td align="right" style="font-weight: bold; font-family: Courier, monospace; color: {{ '#dc2626' if t.is_debit else '#16a34a' }};">
                    {{ '-' if t.is_debit else '+' }}Rs. {{ t.amount_fmt }}
                </td>
            </tr>
            {% endfor %}
            {% if not txns %}
            <tr>
                <td colspan="6" align="center" style="padding: 24px; color: #94a3b8; font-style: italic;">
                    No transactions recorded during this selected period.
                </td>
            </tr>
            {% endif %}
            <tr class="total-row">
                <td colspan="5" align="right" style="font-weight: bold; color: #162a45;">Total Debits (Spent)</td>
                <td align="right" style="font-family: Courier, monospace; font-weight: bold; color: #dc2626;">Rs. {{ total_spent_fmt }}</td>
            </tr>
        </tbody>
    </table>

    <div class="footer-text" style="margin-top: 16px;">
        Page 2 of 2 &bull; Certified RenoPay Digital Banking Engine &bull; Generated on {{ generated_at }} &bull; All times in Indian Standard Time (IST)
    </div>
</div>

</body>
</html>""",
    "travel_ticket": """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RenoPay — Travel & Transit E-Ticket</title>
<style>
{{ css }}
body {
    background-color: #f8fafc;
    padding: 12px;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #0f172a;
}
.ticket-wrapper {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.ticket-header {
    background: linear-gradient(135deg, #162a45 0%, #0d1b2a 100%);
    color: #ffffff;
    padding: 18px 24px;
}
.ticket-header-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.5px;
}
.ticket-header-title span {
    color: #ff6a1a;
}
.ticket-type-pill {
    display: inline-block;
    background: rgba(255, 106, 26, 0.2);
    border: 1px solid #ff6a1a;
    color: #ff8a3d;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
}
.pnr-strip {
    background: #f1f5f9;
    border-bottom: 2px dashed #cbd5e1;
    padding: 12px 24px;
}
.badge-confirmed {
    background-color: #15803d;
    color: #ffffff;
    font-size: 11px;
    font-weight: bold;
    padding: 4px 14px;
    border-radius: 4px;
    text-transform: uppercase;
}
.journey-box {
    padding: 20px 24px;
}
.route-display {
    width: 100%;
    margin-bottom: 16px;
}
.city-name {
    font-size: 18px;
    font-weight: 800;
    color: #162a45;
}
.city-time {
    font-size: 14px;
    font-weight: 700;
    color: #ff6a1a;
    margin-top: 2px;
}
.city-date {
    font-size: 11px;
    color: #64748b;
    margin-top: 1px;
}
.info-grid {
    width: 100%;
    border-collapse: collapse;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-bottom: 18px;
}
.info-grid td {
    padding: 10px 14px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 11px;
}
.info-label {
    font-size: 10px;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
    display: block;
    margin-bottom: 2px;
}
.info-value {
    font-size: 12px;
    font-weight: 700;
    color: #1e293b;
}
.passenger-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
}
.passenger-table th {
    background-color: #162a45;
    color: #ffffff;
    font-size: 10px;
    text-transform: uppercase;
    padding: 8px 12px;
    text-align: left;
}
.passenger-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 11px;
}
.fare-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}
.fare-table td {
    padding: 6px 12px;
    font-size: 11px;
}
.fare-total {
    border-top: 2px solid #162a45;
    font-size: 14px;
    font-weight: 800;
    color: #162a45;
}
.ticket-footer {
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 14px 24px;
    font-size: 9.5px;
    color: #64748b;
    line-height: 1.4;
}
.barcode {
    font-family: 'Courier New', Courier, monospace;
    font-size: 18px;
    letter-spacing: 4px;
    color: #334155;
    text-align: center;
    margin-top: 8px;
}
</style>
</head>
<body>
<div class="ticket-wrapper">
    <!-- Header -->
    <div class="ticket-header">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td valign="middle">
                    <div class="ticket-header-title">Reno<span>Pay</span> Travel & Transit</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">Official Electronic Reservation Slip & Boarding Pass</div>
                </td>
                <td valign="middle" align="right">
                    <span class="ticket-type-pill">{{ booking_type | upper }}</span>
                </td>
            </tr>
        </table>
    </div>

    <!-- PNR & Status Strip -->
    <div class="pnr-strip">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td valign="middle">
                    <span style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">PNR / Booking Reference</span><br>
                    <span style="font-family: Courier, monospace; font-size: 15px; font-weight: 800; color: #162a45; letter-spacing: 1px;">{{ pnr_or_ticket_no }}</span>
                </td>
                <td valign="middle" align="right">
                    <span class="badge-confirmed">CONFIRMED</span>
                </td>
            </tr>
        </table>
    </div>

    <!-- Journey Details -->
    <div class="journey-box">
        <table class="route-display" cellpadding="0" cellspacing="0">
            <tr>
                <td width="42%" valign="top">
                    <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">FROM / ORIGIN</div>
                    <div class="city-name">{{ from_location }}</div>
                    <div class="city-time">{{ departure_time }}</div>
                    <div class="city-date">{{ departure_date }}</div>
                </td>
                <td width="16%" align="center" valign="middle">
                    <div style="font-size: 20px; color: #ff6a1a;">&#10230;</div>
                    {% if distance_km > 0 %}
                    <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px;">{{ distance_km }} KM</div>
                    {% endif %}
                </td>
                <td width="42%" align="right" valign="top">
                    <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">TO / DESTINATION</div>
                    <div class="city-name">{{ to_location }}</div>
                    <div class="city-time">{{ arrival_time }}</div>
                    <div class="city-date">{{ arrival_date or departure_date }}</div>
                </td>
            </tr>
        </table>

        <table class="info-grid" cellpadding="0" cellspacing="0">
            <tr>
                <td width="33%">
                    <span class="info-label">Service / Carrier</span>
                    <span class="info-value">{{ operator_name }}</span>
                    {% if service_number %}<span style="font-size: 10px; color: #64748b;"> ({{ service_number }})</span>{% endif %}
                </td>
                <td width="33%">
                    <span class="info-label">Class / Category</span>
                    <span class="info-value" style="color: #ff6a1a;">{{ travel_class }}</span>
                </td>
                <td width="34%">
                    <span class="info-label">Seat / Berth / Room</span>
                    <span class="info-value">{{ seat_or_room_no or "Assigned at Check-in" }}</span>
                </td>
            </tr>
        </table>

        <!-- Passenger Details Table -->
        <table class="passenger-table" cellpadding="0" cellspacing="0">
            <thead>
                <tr>
                    <th width="8%">#</th>
                    <th width="45%">Passenger / Guest Name</th>
                    <th width="22%">Age / Gender</th>
                    <th width="25%" align="right">Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td style="font-weight: 700; color: #162a45;">{{ passenger_name }}</td>
                    <td style="color: #475569;">{{ passenger_meta or "Adult" }}</td>
                    <td align="right"><span style="color: #15803d; font-weight: 700;">Confirmed (CNF)</span></td>
                </tr>
            </tbody>
        </table>

        <!-- Fare Breakdown & Payment Confirmation -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-top: 10px;">
            <div style="font-size: 11px; font-weight: 800; color: #162a45; text-transform: uppercase; margin-bottom: 6px;">
                Payment & Fare Breakdown (Paid via RenoPay Wallet)
            </div>
            <table class="fare-table" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="color: #475569;">Base Fare {% if rate_desc %}<span style="font-size: 10px; color: #64748b;">({{ rate_desc }})</span>{% endif %}</td>
                    <td align="right" style="font-family: Courier, monospace; font-weight: 600;">Rs. {{ base_fare_fmt }}</td>
                </tr>
                <tr>
                    <td style="color: #475569;">Taxes & Convenience Fee (GST)</td>
                    <td align="right" style="font-family: Courier, monospace; font-weight: 600;">Rs. {{ tax_fmt }}</td>
                </tr>
                <tr class="fare-total">
                    <td style="padding-top: 8px;">Total Amount Paid</td>
                    <td align="right" style="padding-top: 8px; font-family: Courier, monospace; color: #15803d;">Rs. {{ total_fare_fmt }}</td>
                </tr>
            </table>

            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #64748b;">
                <table width="100%">
                    <tr>
                        <td><strong>RenoPay Txn Ref:</strong> <span style="font-family: Courier, monospace; color: #162a45;">{{ txn_ref }}</span></td>
                        <td align="right"><strong>Booked At:</strong> {{ booked_at }}</td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="barcode">
            ||| | | |||| || | ||||| ||| | ||| |||| | | ||
        </div>
        <div style="text-align: center; font-size: 9px; color: #94a3b8; font-family: Courier, monospace; margin-top: 2px;">
            VERIFIED-DIGITAL-TOKEN-{{ pnr_or_ticket_no }}
        </div>
    </div>

    <!-- Terms & Footer -->
    <div class="ticket-footer">
        <strong>Important Instructions:</strong>
        <ul style="margin-left: 16px; margin-top: 4px;">
            <li>Please carry an original Government-issued Photo ID (Aadhaar, Passport, PAN card, or Voter ID) during travel.</li>
            <li>For trains and buses, report at boarding point at least 30 minutes prior to departure; for domestic flights, arrive at airport 2 hours prior.</li>
            <li>This e-ticket is securely issued and guaranteed by <strong>RenoPay Virtual Banking & Transit Services</strong>.</li>
        </ul>
    </div>
</div>
</body>
</html>""",
}


def _render_template(template_name: str, data: dict) -> str:
    """Render a Jinja2 template string with data."""
    raw = TEMPLATES[template_name]
    env = Environment(loader=BaseLoader())
    tmpl = env.from_string(raw)
    return tmpl.render(css=BASE_CSS, **data)


async def generate_pdf(template_name: ReportType, data: dict) -> io.BytesIO:
    """
    Render a Jinja2 template and convert it to a PDF using WeasyPrint or xhtml2pdf.
    Returns an in-memory BytesIO buffer.
    """
    html_str = _render_template(template_name, data)
    buf = io.BytesIO()

    if WEASYPRINT_AVAILABLE:
        try:
            pdf_bytes = WeasyprintHTML(string=html_str).write_pdf()
            buf.write(pdf_bytes)
            buf.seek(0)
            return buf
        except Exception:
            pass

    if XHTML2PDF_AVAILABLE:
        try:
            pisa_status = pisa.CreatePDF(html_str, dest=buf)
            if not pisa_status.err:
                buf.seek(0)
                return buf
        except Exception:
            pass

    # Graceful fallback: return the raw HTML as bytes
    buf = io.BytesIO(html_str.encode("utf-8"))
    buf.seek(0)
    return buf


def build_balance_sheet_data(transactions: list, period: str) -> dict:
    """Format raw transaction rows into the balance_sheet template context."""
    total_income = sum(t.amount_paise for t in transactions if t.type.value == "credit") / 100
    total_spent = sum(t.amount_paise for t in transactions if t.type.value == "debit") / 100
    net = total_income - total_spent

    by_cat: dict = {}
    for t in transactions:
        if t.type.value == "debit":
            cat = t.category.value if hasattr(t.category, "value") else str(t.category)
            by_cat[cat] = by_cat.get(cat, 0) + t.amount_paise / 100

    by_category = sorted(
        [{"category": k, "amount": v, "percent": round(v / total_spent * 100, 1) if total_spent else 0}
         for k, v in by_cat.items()],
        key=lambda x: -x["amount"],
    )

    txn_rows = [
        {
            "date": to_ist(t.created_at).strftime("%d %b %Y, %I:%M %p IST"),
            "description": t.description or "—",
            "category": t.category.value if hasattr(t.category, "value") else str(t.category),
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "amount": t.amount_paise / 100,
        }
        for t in transactions
    ]

    return {
        "period": period,
        "generated_at": datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST"),
        "total_income": total_income,
        "total_spent": total_spent,
        "net": net,
        "transactions": txn_rows,
        "by_category": by_category,
        "balance_mismatch": False,
    }


def build_profit_loss_data(transactions: list, period: str) -> dict:
    """Format raw transaction rows into the profit_loss template context."""
    income_by_cat: dict = {}
    expense_by_cat: dict = {}

    for t in transactions:
        cat = t.category.value if hasattr(t.category, "value") else str(t.category)
        if t.type.value == "credit":
            income_by_cat[cat] = income_by_cat.get(cat, 0) + t.amount_paise / 100
        else:
            expense_by_cat[cat] = expense_by_cat.get(cat, 0) + t.amount_paise / 100

    total_income = sum(income_by_cat.values())
    total_spent = sum(expense_by_cat.values())
    net = total_income - total_spent

    income_rows = [{"category": k, "amount": v} for k, v in sorted(income_by_cat.items(), key=lambda x: -x[1])]
    expense_rows = [
        {"category": k, "amount": v, "percent": round(v / total_spent * 100, 1) if total_spent else 0}
        for k, v in sorted(expense_by_cat.items(), key=lambda x: -x[1])
    ]

    return {
        "period": period,
        "generated_at": datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST"),
        "total_income": total_income,
        "total_spent": total_spent,
        "net": net,
        "income_rows": income_rows,
        "expense_rows": expense_rows,
    }


def build_receipt_data(txn) -> dict:
    created_ist = to_ist(txn.created_at)
    now_ist = datetime.now(IST)
    return {
        "generated_at": now_ist.strftime("%d %b %Y, %I:%M %p IST"),
        "txn_ref": txn.txn_ref,
        "amount": txn.amount_paise / 100,
        "type": txn.type.value if hasattr(txn.type, "value") else str(txn.type),
        "status": txn.status.value if hasattr(txn.status, "value") else str(txn.status),
        "counterparty_vpa": txn.counterparty_vpa,
        "description": txn.description or "UPI Transfer",
        "category": txn.category.value if hasattr(txn.category, "value") else str(txn.category),
        "created_at": created_ist.strftime("%d %b %Y, %I:%M %p IST"),
        "round_up": txn.round_up_paise / 100 if txn.round_up_paise else 0,
    }


def build_expense_report_data(
    account,
    user,
    transactions: list,
    period: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Prepare context data for the 2-page expense_report PDF template."""
    now_ist = datetime.now(IST)

    CATEGORY_PALETTE = {
        "Food": ("#FF6A1A", "#FFF7ED", "#C2410C"),
        "Shopping": ("#3B82F6", "#EFF6FF", "#1D4ED8"),
        "Transport": ("#10B981", "#ECFDF5", "#047857"),
        "Bills": ("#8B5CF6", "#F5F3FF", "#6D28D9"),
        "Entertainment": ("#EC4899", "#FDF2F8", "#BE185D"),
        "Health": ("#EF4444", "#FEF2F2", "#B91C1C"),
        "Education": ("#F59E0B", "#FFFBEB", "#B45309"),
        "Investment": ("#EAB308", "#FEFCE8", "#A16207"),
        "Income": ("#059669", "#ECFDF5", "#047857"),
        "Other": ("#6B7280", "#F3F4F6", "#374151"),
    }

    debit_txns = [t for t in transactions if (t.type.value if hasattr(t.type, "value") else str(t.type)) == "debit"]
    credit_txns = [t for t in transactions if (t.type.value if hasattr(t.type, "value") else str(t.type)) == "credit"]

    total_spent = sum(t.amount_paise for t in debit_txns) / 100
    total_income = sum(t.amount_paise for t in credit_txns) / 100
    net = total_income - total_spent

    budget = (account.monthly_budget_paise or 1000000) / 100
    budget_used_percent = round(min(100, (total_spent / budget) * 100), 1) if budget > 0 else 0

    # Group debits by category
    cat_stats: dict[str, dict] = {}
    for t in debit_txns:
        c_name = t.category.value if hasattr(t.category, "value") else str(t.category or "Other")
        if c_name not in cat_stats:
            cat_stats[c_name] = {"paise": 0, "count": 0}
        cat_stats[c_name]["paise"] += t.amount_paise
        cat_stats[c_name]["count"] += 1

    by_category = []
    for c_name, info in sorted(cat_stats.items(), key=lambda x: -x[1]["paise"]):
        c_amt = info["paise"] / 100
        pct = round((c_amt / total_spent) * 100, 1) if total_spent > 0 else 0
        palette = CATEGORY_PALETTE.get(c_name, CATEGORY_PALETTE["Other"])
        by_category.append({
            "category": c_name,
            "amount_fmt": f"{c_amt:,.2f}",
            "count": info["count"],
            "percent": pct,
            "percent_clamped": max(3, min(100, pct)),
            "color": palette[0],
            "bg_color": palette[1],
            "text_color": palette[2],
        })

    top_cat = by_category[0]["category"] if by_category else "None"
    avg_spend = (total_spent / max(1, len(debit_txns))) if debit_txns else 0

    if period == "custom" and start_date and end_date:
        period_label = f"Custom: {start_date} to {end_date}"
    elif period == "week":
        period_label = "Past 7 Days"
    elif period == "month":
        period_label = "Past 30 Days"
    else:
        period_label = "All Recorded Activity"

    budget_status_text = (
        "Critical — Over Budget" if budget_used_percent > 85
        else "Moderate Utilization" if budget_used_percent > 65
        else "Healthy & On Track"
    )

    health_label = (
        "Safe & Thriving" if budget_used_percent <= 65
        else "Moderate" if budget_used_percent <= 85
        else "Needs Attention"
    )

    # Prepare itemized list for Page 2
    itemized_txns = []
    for t in transactions:
        is_debit = (t.type.value if hasattr(t.type, "value") else str(t.type)) == "debit"
        c_name = t.category.value if hasattr(t.category, "value") else str(t.category or "Other")
        palette = CATEGORY_PALETTE.get(c_name, CATEGORY_PALETTE["Other"])
        itemized_txns.append({
            "date_ist": to_ist(t.created_at).strftime("%d %b %Y, %I:%M %p"),
            "category": c_name,
            "cat_color_bg": palette[1],
            "cat_color_text": palette[2],
            "counterparty_vpa": t.counterparty_vpa or "—",
            "description": t.description or ("Debit Transfer" if is_debit else "Credit Received"),
            "is_debit": is_debit,
            "amount_fmt": f"{t.amount_paise / 100:,.2f}",
        })

    return {
        "user_name": user.full_name or "RenoPay Member",
        "vpa": account.vpa,
        "period_label": period_label,
        "generated_at": now_ist.strftime("%d %b %Y, %I:%M %p IST"),
        "total_spent_fmt": f"{total_spent:,.2f}",
        "total_income_fmt": f"{total_income:,.2f}",
        "net_fmt": f"{abs(net):,.2f}",
        "net": net,
        "debit_count": len(debit_txns),
        "credit_count": len(credit_txns),
        "budget_fmt": f"{budget:,.2f}",
        "budget_used_percent": budget_used_percent,
        "budget_bar_width": min(100, max(2, budget_used_percent)),
        "budget_remaining_fmt": f"{max(0, budget - total_spent):,.2f}",
        "budget_status_text": budget_status_text,
        "by_category": by_category,
        "top_category": top_cat,
        "avg_spend_fmt": f"{avg_spend:,.2f}",
        "health_label": health_label,
        "txns": itemized_txns,
    }


def build_travel_ticket_data(booking, txn=None, user=None) -> dict:
    """Prepare context data for the travel_ticket PDF template."""
    now_ist = datetime.now(IST)
    booked_time = to_ist(booking.created_at) if booking.created_at else now_ist

    base_fare_paise = booking.base_fare_paise or booking.amount_paise
    tax_paise = booking.tax_paise or (booking.amount_paise - base_fare_paise)

    rate_desc = ""
    if booking.booking_type == "train" and booking.distance_km > 0:
        c = booking.travel_class.lower()
        if "sleep" in c or "sl" in c:
            rate_desc = f"{booking.distance_km:.0f} km × ₹0.7 / km"
        elif "3a" in c or "3rd" in c:
            rate_desc = f"{booking.distance_km:.0f} km × ₹1.2 / km"
        elif "2a" in c or "2nd" in c:
            rate_desc = f"{booking.distance_km:.0f} km × ₹2.0 / km"
        elif "1a" in c or "1st" in c:
            rate_desc = f"{booking.distance_km:.0f} km × ₹3.0 / km"
        else:
            rate_desc = f"{booking.distance_km:.0f} km distance fare"
    elif booking.booking_type == "bus" and booking.distance_km > 0:
        rate_desc = f"{booking.distance_km:.0f} km route transit"
    elif booking.booking_type == "hotel":
        rate_desc = "Room charge"

    passenger_meta = "Adult (General)"
    if booking.passenger_details:
        try:
            import json
            p_data = json.loads(booking.passenger_details)
            if isinstance(p_data, dict):
                age = p_data.get("age")
                gender = p_data.get("gender")
                if age and gender:
                    passenger_meta = f"{age} Yrs / {gender.capitalize()}"
        except Exception:
            pass

    return {
        "booking_type": str(booking.booking_type.value if hasattr(booking.booking_type, "value") else booking.booking_type),
        "pnr_or_ticket_no": booking.pnr_or_ticket_no,
        "operator_name": booking.operator_name,
        "service_number": booking.service_number or "",
        "from_location": booking.from_location,
        "to_location": booking.to_location,
        "departure_date": booking.departure_date,
        "departure_time": booking.departure_time or "08:00 AM",
        "arrival_date": booking.arrival_date or booking.departure_date,
        "arrival_time": booking.arrival_time or "04:30 PM",
        "distance_km": booking.distance_km or 0.0,
        "travel_class": booking.travel_class,
        "seat_or_room_no": booking.seat_or_room_no or "Seat Assigned",
        "passenger_name": booking.passenger_name or (user.full_name if user else "Passenger"),
        "passenger_meta": passenger_meta,
        "base_fare_fmt": f"{base_fare_paise / 100:,.2f}",
        "tax_fmt": f"{tax_paise / 100:,.2f}",
        "total_fare_fmt": f"{booking.amount_paise / 100:,.2f}",
        "rate_desc": rate_desc,
        "txn_ref": booking.txn_ref,
        "booked_at": booked_time.strftime("%d %b %Y, %I:%M %p IST"),
        "generated_at": now_ist.strftime("%d %b %Y, %I:%M %p IST"),
    }
