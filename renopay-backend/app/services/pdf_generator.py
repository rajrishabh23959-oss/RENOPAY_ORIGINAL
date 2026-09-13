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
from datetime import datetime
from typing import Literal
from jinja2 import Environment, BaseLoader

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

ReportType = Literal["transaction_receipt", "balance_sheet", "profit_loss", "full_accounting_pack"]

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
    <td><div class="logo-title">Reno<span class="logo-accent">Pay</span></div><div class="logo-sub">Balance Sheet Statement</div></td>
    <td class="meta-box"><div><strong>{{ period }}</strong></div><div>Generated: {{ generated_at }}</div></td>
  </tr>
</table>
<div class="accent-line-navy"></div><div class="accent-line-orange"></div>
<div class="section-title">Summary</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Total Income</th><th>Total Expenses</th><th>Net Balance</th></tr></thead>
  <tbody>
    <tr>
      <td style="font-weight:bold; color:#15803d; font-size:12px;">Rs {{ "%.2f"|format(total_income) }}</td>
      <td style="font-weight:bold; color:#dc2626; font-size:12px;">Rs {{ "%.2f"|format(total_spent) }}</td>
      <td style="font-weight:bold; color:{{'#15803d' if net >= 0 else '#dc2626'}}; font-size:12px;">Rs {{ "%.2f"|format(net) }}</td>
    </tr>
  </tbody>
</table>
<div class="section-title">Transactions Ledger</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th align="right">Amount</th></tr></thead>
  <tbody>
  {% for t in transactions %}
  <tr class="{{ 'even' if loop.index is even else 'odd' }}">
    <td>{{ t.date }}</td>
    <td>{{ t.description }}</td>
    <td>{{ t.category }}</td>
    <td style="font-weight:bold; color:{{'#15803d' if t.type == 'credit' else '#dc2626'}};">{{ t.type | upper }}</td>
    <td align="right" style="font-weight:bold; color:{{'#15803d' if t.type == 'credit' else '#dc2626'}};">{{ '+' if t.type == 'credit' else '-' }}Rs {{ "%.2f"|format(t.amount) }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<div class="footer-text">RenoPay Immutable Ledger &mdash; Generated {{ generated_at }}</div>
</div></body></html>""",

    "profit_loss": """<!DOCTYPE html><html><head><meta charset="utf-8"><title>RenoPay — Profit &amp; Loss</title><style>{{ css }}</style></head>
<body><div class="page">
<table class="header-table" cellpadding="0" cellspacing="0">
  <tr>
    <td><div class="logo-title">Reno<span class="logo-accent">Pay</span></div><div class="logo-sub">Income &amp; Expense Statement</div></td>
    <td class="meta-box"><div><strong>{{ period }}</strong></div><div>Generated: {{ generated_at }}</div></td>
  </tr>
</table>
<div class="accent-line-navy"></div><div class="accent-line-orange"></div>
<div class="section-title">Performance Summary</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Gross Income</th><th>Total Expenses</th><th>Net Result</th></tr></thead>
  <tbody>
    <tr>
      <td style="font-weight:bold; color:#15803d; font-size:12px;">+ Rs {{ "%.2f"|format(total_income) }}</td>
      <td style="font-weight:bold; color:#dc2626; font-size:12px;">- Rs {{ "%.2f"|format(total_spent) }}</td>
      <td style="font-weight:bold; color:{{'#15803d' if net >= 0 else '#dc2626'}}; font-size:12px;">Rs {{ "%.2f"|format(net) }}</td>
    </tr>
  </tbody>
</table>
<div class="section-title">Income Categories</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Category</th><th align="right">Amount</th></tr></thead>
  <tbody>
  {% for r in income_rows %}
  <tr class="{{ 'even' if loop.index is even else 'odd' }}"><td>{{ r.category }}</td><td align="right" style="font-weight:bold; color:#15803d;">+ Rs {{ "%.2f"|format(r.amount) }}</td></tr>
  {% endfor %}
  <tr class="total-row"><td style="border-right:none;">Total Income</td><td align="right" style="color:#15803d;">+ Rs {{ "%.2f"|format(total_income) }}</td></tr>
  </tbody>
</table>
<div class="section-title">Expense Categories</div>
<table class="report-table" cellpadding="6" cellspacing="0">
  <thead><tr><th>Category</th><th align="right">Amount</th><th align="right">% of Spend</th></tr></thead>
  <tbody>
  {% for e in expense_rows %}
  <tr class="{{ 'even' if loop.index is even else 'odd' }}"><td>{{ e.category }}</td><td align="right" style="font-weight:bold; color:#dc2626;">- Rs {{ "%.2f"|format(e.amount) }}</td><td align="right">{{ e.percent }}%</td></tr>
  {% endfor %}
  <tr class="total-row"><td style="border-right:none;">Total Expenses</td><td align="right" style="color:#dc2626;">- Rs {{ "%.2f"|format(total_spent) }}</td><td style="border-left:none;"></td></tr>
  </tbody>
</table>
<div class="footer-text">RenoPay Immutable Ledger &mdash; Generated {{ generated_at }}</div>
</div></body></html>""",
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
            "date": t.created_at.strftime("%d %b %Y %H:%M"),
            "description": t.description or "—",
            "category": t.category.value if hasattr(t.category, "value") else str(t.category),
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "amount": t.amount_paise / 100,
        }
        for t in transactions
    ]

    return {
        "period": period,
        "generated_at": datetime.utcnow().strftime("%d %b %Y %H:%M UTC"),
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
        "generated_at": datetime.utcnow().strftime("%d %b %Y %H:%M UTC"),
        "total_income": total_income,
        "total_spent": total_spent,
        "net": net,
        "income_rows": income_rows,
        "expense_rows": expense_rows,
    }


def build_receipt_data(txn) -> dict:
    return {
        "generated_at": datetime.utcnow().strftime("%d %b %Y %H:%M UTC"),
        "txn_ref": txn.txn_ref,
        "amount": txn.amount_paise / 100,
        "type": txn.type.value if hasattr(txn.type, "value") else str(txn.type),
        "status": txn.status.value if hasattr(txn.status, "value") else str(txn.status),
        "counterparty_vpa": txn.counterparty_vpa,
        "description": txn.description or "UPI Transfer",
        "category": txn.category.value if hasattr(txn.category, "value") else str(txn.category),
        "created_at": txn.created_at.strftime("%d %b %Y, %I:%M %p"),
        "round_up": txn.round_up_paise / 100 if txn.round_up_paise else 0,
    }
