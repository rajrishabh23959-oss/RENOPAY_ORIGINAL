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
@page { size: A4; margin: 15mm 12mm; }
* { margin: 0; padding: 0; }
body { font-family: Helvetica, Arial, sans-serif; color: #1C2321; background: #fff; font-size: 12px; }
.page { padding: 15px; }
.header { border-bottom: 2px solid #F3A833; padding-bottom: 12px; margin-bottom: 18px; }
.logo { font-size: 20px; font-weight: bold; color: #192926; }
.logo span { color: #F3A833; }
.logo-sub { font-size: 10px; color: #888; font-weight: normal; margin-top: 2px; }
.meta { text-align: right; font-size: 11px; color: #666; }
.meta strong { font-size: 13px; color: #1C2321; }
h2 { font-size: 18px; font-weight: bold; margin-bottom: 4px; color: #192926; }
h3 { font-size: 12px; font-weight: bold; margin-bottom: 10px; color: #555; text-transform: uppercase; }
table { width: 100%; margin-bottom: 18px; }
th { background: #192926; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: bold; }
td { padding: 6px 8px; border-bottom: 1px solid #E2D5B8; font-size: 11px; }
tr:last-child td { border-bottom: none; }
tr:nth-child(even) { background: #F9F5ED; }
.amount-debit { color: #dc2626; font-weight: bold; font-family: Courier, monospace; }
.amount-credit { color: #16a34a; font-weight: bold; font-family: Courier, monospace; }
.amount-neutral { font-weight: bold; font-family: Courier, monospace; }
.badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; }
.badge-success { background: #dcfce7; color: #166534; }
.badge-pending { background: #fef9c3; color: #854d0e; }
.badge-failed { background: #fee2e2; color: #991b1b; }
.summary-card { background: #F3ECDD; border: 1px solid #E2D5B8; padding: 10px; margin-bottom: 10px; }
.summary-card .label { font-size: 9px; color: #888; text-transform: uppercase; margin-bottom: 3px; }
.summary-card .value { font-size: 16px; font-weight: bold; font-family: Courier, monospace; color: #192926; }
.footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E2D5B8; font-size: 9px; color: #aaa; text-align: center; }
.highlight-row td { background: #fff8e1; font-weight: bold; }
.balance-mismatch { background: #fee2e2; border: 1px solid #dc2626; padding: 8px 12px; color: #991b1b; font-weight: bold; margin-bottom: 14px; }
"""

# ── Templates ──────────────────────────────────────────────────────────────────
TEMPLATES: dict[str, str] = {
    "transaction_receipt": """
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>RenoPay — Transaction Receipt</title>
<style>{{ css }}
.receipt-card { max-width: 420px; margin: 0 auto; border: 1.5px solid #E2D5B8; border-radius: 16px; overflow: hidden; }
.receipt-amount { text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #192926 0%, #2d4a42 100%); }
.receipt-amount .currency { font-size: 14px; color: #F3A833; font-weight: 600; }
.receipt-amount .value { font-size: 42px; font-weight: 800; color: #fff; font-family: 'Space Mono', monospace; line-height: 1; }
.receipt-amount .type { font-size: 12px; color: rgba(255,255,255,.6); margin-top: 6px; }
.receipt-body { padding: 20px 24px; }
.receipt-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #F0E8D5; }
.receipt-row:last-child { border-bottom: none; }
.receipt-row .key { font-size: 11px; color: #888; }
.receipt-row .val { font-size: 12px; font-weight: 600; color: #1C2321; text-align: right; max-width: 60%; }
</style></head>
<body><div class="page">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Payment Receipt</div></div>
  <div class="meta"><strong>{{ txn_ref }}</strong>{{ generated_at }}</div>
</div>
<div class="receipt-card">
  <div class="receipt-amount">
    <div class="currency">₹</div>
    <div class="value">{{ "%.2f"|format(amount) }}</div>
    <div class="type">{{ type | upper }}</div>
  </div>
  <div class="receipt-body">
    <div class="receipt-row"><span class="key">Status</span><span class="val"><span class="badge badge-{{ status }}">{{ status | upper }}</span></span></div>
    <div class="receipt-row"><span class="key">To / From</span><span class="val">{{ counterparty_vpa }}</span></div>
    <div class="receipt-row"><span class="key">Description</span><span class="val">{{ description or '—' }}</span></div>
    <div class="receipt-row"><span class="key">Category</span><span class="val">{{ category }}</span></div>
    <div class="receipt-row"><span class="key">Date &amp; Time</span><span class="val">{{ created_at }}</span></div>
    {% if round_up > 0 %}<div class="receipt-row"><span class="key">Gold Round-Up</span><span class="val" style="color:#F3A833">+ ₹{{ "%.2f"|format(round_up) }}</span></div>{% endif %}
  </div>
</div>
<div class="footer">This is a system-generated receipt. RenoPay — Secure Payments Platform.</div>
</div></body></html>
""",

    "balance_sheet": """
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>RenoPay — Balance Sheet</title>
<style>{{ css }}</style></head>
<body><div class="page">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Balance Sheet</div></div>
  <div class="meta"><strong>{{ period }}</strong>Generated: {{ generated_at }}</div>
</div>
{% if balance_mismatch %}<div class="balance-mismatch">⚠️ BALANCE MISMATCH: Total debits and credits do not reconcile. Please review manually.</div>{% endif %}
<div class="summary-grid">
  <div class="summary-card"><div class="label">Total Income</div><div class="value" style="color:#16a34a">₹{{ "%.2f"|format(total_income) }}</div></div>
  <div class="summary-card"><div class="label">Total Spent</div><div class="value" style="color:#dc2626">₹{{ "%.2f"|format(total_spent) }}</div></div>
  <div class="summary-card"><div class="label">Net Balance</div><div class="value" style="color:{{'#16a34a' if net >= 0 else '#dc2626'}}">₹{{ "%.2f"|format(net) }}</div></div>
</div>
<h3>Transaction Ledger</h3>
<table>
  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
  {% for t in transactions %}
  <tr>
    <td>{{ t.date }}</td>
    <td>{{ t.description }}</td>
    <td>{{ t.category }}</td>
    <td><span class="badge {{'badge-success' if t.type == 'credit' else 'badge-failed'}}">{{ t.type | upper }}</span></td>
    <td style="text-align:right"><span class="{{'amount-credit' if t.type == 'credit' else 'amount-debit'}}">{{ '+' if t.type == 'credit' else '-' }}₹{{ "%.2f"|format(t.amount) }}</span></td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<h3>By Category</h3>
<table>
  <thead><tr><th>Category</th><th style="text-align:right">Amount Spent</th><th style="text-align:right">% of Total</th></tr></thead>
  <tbody>
  {% for c in by_category %}
  <tr>
    <td>{{ c.category }}</td>
    <td style="text-align:right" class="amount-debit">₹{{ "%.2f"|format(c.amount) }}</td>
    <td style="text-align:right">{{ c.percent }}%</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<div class="footer">RenoPay — Grounded AI Accounting. All figures from immutable ledger. Report generated {{ generated_at }}</div>
</div></body></html>
""",

    "profit_loss": """
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>RenoPay — Profit &amp; Loss</title>
<style>{{ css }}</style></head>
<body><div class="page">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Income &amp; Expense Report</div></div>
  <div class="meta"><strong>{{ period }}</strong>Generated: {{ generated_at }}</div>
</div>
<div class="summary-grid">
  <div class="summary-card"><div class="label">Gross Income</div><div class="value" style="color:#16a34a">₹{{ "%.2f"|format(total_income) }}</div></div>
  <div class="summary-card"><div class="label">Total Expenses</div><div class="value" style="color:#dc2626">₹{{ "%.2f"|format(total_spent) }}</div></div>
  <div class="summary-card"><div class="label">Net {{ 'Profit' if net >= 0 else 'Loss' }}</div><div class="value" style="color:{{'#16a34a' if net >= 0 else '#dc2626'}}">₹{{ "%.2f"|format(net|abs) }}</div></div>
</div>
<h3>Income Breakdown</h3>
<table>
  <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
  {% for r in income_rows %}
  <tr><td>{{ r.category }}</td><td style="text-align:right" class="amount-credit">+₹{{ "%.2f"|format(r.amount) }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Total Income</td><td style="text-align:right" class="amount-credit">+₹{{ "%.2f"|format(total_income) }}</td></tr>
  </tbody>
</table>
<h3>Expense Breakdown</h3>
<table>
  <thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">% of Spend</th></tr></thead>
  <tbody>
  {% for e in expense_rows %}
  <tr><td>{{ e.category }}</td><td style="text-align:right" class="amount-debit">-₹{{ "%.2f"|format(e.amount) }}</td><td style="text-align:right">{{ e.percent }}%</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Total Expenses</td><td style="text-align:right" class="amount-debit">-₹{{ "%.2f"|format(total_spent) }}</td><td></td></tr>
  </tbody>
</table>
<div class="footer">RenoPay — All figures sourced from immutable transaction ledger. Generated {{ generated_at }}</div>
</div></body></html>""",
    "full_accounting_pack": """
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>RenoPay — Full Accounting Pack</title>
<style>{{ css }}
.page-break { page-break-before: always; }
.cover { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
.cover h1 { font-size: 32px; font-weight: 800; color: #192926; margin-bottom: 16px; }
.cover h2 { font-size: 18px; font-weight: 400; color: #555; margin-bottom: 32px; }
.cover p { font-size: 12px; color: #888; }
</style></head>
<body>

<div class="page cover">
    <h1>Reno<span>Pay</span></h1>
    <h2>Full Accounting Report</h2>
    <p>Account: {{ account_name }}</p>
    <p>Generated: {{ generated_at }}</p>
</div>

<div class="page page-break">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Journal Entries</div></div>
  <div class="meta">Generated: {{ generated_at }}</div>
</div>
<h3>Journal</h3>
<table>
  <thead><tr><th>Entry No</th><th>Date</th><th>Narration</th><th>Ledger Head</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead>
  <tbody>
  {% for je in journal_entries %}
      {% for line in je.lines %}
      <tr>
        {% if loop.index == 1 %}
        <td rowspan="{{ je.lines|length }}">{{ je.entry_no }}</td>
        <td rowspan="{{ je.lines|length }}">{{ je.date }}</td>
        <td rowspan="{{ je.lines|length }}">{{ je.narration }}</td>
        {% endif %}
        <td>{{ line.account_name }}</td>
        <td style="text-align:right" class="amount-debit">{{ line.debit if line.debit else '' }}</td>
        <td style="text-align:right" class="amount-credit">{{ line.credit if line.credit else '' }}</td>
      </tr>
      {% endfor %}
  {% endfor %}
  </tbody>
</table>
</div>

<div class="page page-break">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">General Ledger</div></div>
  <div class="meta">Generated: {{ generated_at }}</div>
</div>
{% for gl in general_ledgers %}
<h3>{{ gl.code }} - {{ gl.name }}</h3>
<table>
  <thead><tr><th>Date</th><th>Entry No</th><th>Narration</th><th>Payee</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
  <tbody>
  {% for line in gl.lines %}
  <tr>
    <td>{{ line.date }}</td>
    <td>{{ line.entry_no }}</td>
    <td>{{ line.narration }}</td>
    <td>{{ line.payee or '—' }}</td>
    <td style="text-align:right" class="amount-debit">{{ line.debit if line.debit else '' }}</td>
    <td style="text-align:right" class="amount-credit">{{ line.credit if line.credit else '' }}</td>
    <td style="text-align:right" class="amount-neutral">{{ line.balance }}</td>
  </tr>
  {% endfor %}
  <tr class="highlight-row">
    <td colspan="6" style="text-align:right">Closing Balance</td>
    <td style="text-align:right" class="amount-neutral">{{ gl.closing_balance }}</td>
  </tr>
  </tbody>
</table>
<br>
{% endfor %}
</div>

<div class="page page-break">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Payee Ledgers</div></div>
  <div class="meta">Generated: {{ generated_at }}</div>
</div>
{% for pl in payee_ledgers %}
<h3>Payee: {{ pl.payee_vpa }}</h3>
<table>
  <thead><tr><th>Date</th><th>Entry No</th><th>Narration</th><th>Account</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead>
  <tbody>
  {% for line in pl.lines %}
  <tr>
    <td>{{ line.date }}</td>
    <td>{{ line.entry_no }}</td>
    <td>{{ line.narration }}</td>
    <td>{{ line.account_name }}</td>
    <td style="text-align:right" class="amount-debit">{{ line.debit if line.debit else '' }}</td>
    <td style="text-align:right" class="amount-credit">{{ line.credit if line.credit else '' }}</td>
  </tr>
  {% endfor %}
  <tr class="highlight-row">
    <td colspan="4" style="text-align:right">Totals</td>
    <td style="text-align:right" class="amount-debit">{{ pl.total_debit }}</td>
    <td style="text-align:right" class="amount-credit">{{ pl.total_credit }}</td>
  </tr>
  </tbody>
</table>
<br>
{% endfor %}
</div>

<div class="page page-break">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Trial Balance</div></div>
  <div class="meta">Generated: {{ generated_at }}</div>
</div>
{% if trial_balance.balanced == false %}
<div class="balance-mismatch">⚠️ BALANCE MISMATCH: Total debits and credits do not reconcile.</div>
{% endif %}
<table>
  <thead><tr><th>Code</th><th>Account Name</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr></thead>
  <tbody>
  {% for row in trial_balance.rows %}
  <tr>
    <td>{{ row.code }}</td>
    <td>{{ row.name }}</td>
    <td style="text-align:right" class="amount-debit">{{ row.debit if row.debit else '' }}</td>
    <td style="text-align:right" class="amount-credit">{{ row.credit if row.credit else '' }}</td>
  </tr>
  {% endfor %}
  <tr class="highlight-row">
    <td colspan="2" style="text-align:right">Totals</td>
    <td style="text-align:right" class="amount-debit">{{ trial_balance.total_debit }}</td>
    <td style="text-align:right" class="amount-credit">{{ trial_balance.total_credit }}</td>
  </tr>
  </tbody>
</table>
</div>

<div class="page page-break">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Balance Sheet</div></div>
  <div class="meta">Generated: {{ generated_at }}</div>
</div>
{% if balance_sheet.balanced == false %}
<div class="balance-mismatch">⚠️ BALANCE MISMATCH: Assets != Liabilities + Equity</div>
{% endif %}
<h3>Assets</h3>
<table>
  <tbody>
  {% for a in balance_sheet.assets %}
  <tr><td>{{ a.name }}</td><td style="text-align:right" class="amount-neutral">{{ a.balance }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Total Assets</td><td style="text-align:right" class="amount-neutral">₹{{ "%.2f"|format(balance_sheet.total_assets) }}</td></tr>
  </tbody>
</table>
<h3>Liabilities</h3>
<table>
  <tbody>
  {% for l in balance_sheet.liabilities %}
  <tr><td>{{ l.name }}</td><td style="text-align:right" class="amount-neutral">{{ l.balance }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Total Liabilities</td><td style="text-align:right" class="amount-neutral">₹{{ "%.2f"|format(balance_sheet.total_liabilities) }}</td></tr>
  </tbody>
</table>
<h3>Equity</h3>
<table>
  <tbody>
  {% for e in balance_sheet.equity %}
  <tr><td>{{ e.name }}</td><td style="text-align:right" class="amount-neutral">{{ e.balance }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Total Equity</td><td style="text-align:right" class="amount-neutral">₹{{ "%.2f"|format(balance_sheet.total_equity) }}</td></tr>
  </tbody>
</table>
<div class="summary-grid" style="margin-top: 20px;">
  <div class="summary-card"><div class="label">Total Assets</div><div class="value">₹{{ "%.2f"|format(balance_sheet.total_assets) }}</div></div>
  <div class="summary-card"><div class="label">Total Liab + Equity</div><div class="value">₹{{ "%.2f"|format(balance_sheet.total_liab_equity) }}</div></div>
</div>
</div>

<div class="page page-break">
<div class="header">
  <div><div class="logo">Reno<span>Pay</span></div><div class="logo-sub">Cash Flow</div></div>
  <div class="meta">Generated: {{ generated_at }}</div>
</div>
<h3>Operating Activities</h3>
<table>
  <tbody>
  {% for item in cash_flow.operating['items'] %}
  <tr><td>{{ item.name }}</td><td style="text-align:right" class="amount-neutral">{{ item.amount }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Net Operating Cash Flow</td><td style="text-align:right" class="amount-neutral">{{ cash_flow.operating.total }}</td></tr>
  </tbody>
</table>
<h3>Investing Activities</h3>
<table>
  <tbody>
  {% for item in cash_flow.investing['items'] %}
  <tr><td>{{ item.name }}</td><td style="text-align:right" class="amount-neutral">{{ item.amount }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Net Investing Cash Flow</td><td style="text-align:right" class="amount-neutral">{{ cash_flow.investing.total }}</td></tr>
  </tbody>
</table>
<h3>Financing Activities</h3>
<table>
  <tbody>
  {% for item in cash_flow.financing['items'] %}
  <tr><td>{{ item.name }}</td><td style="text-align:right" class="amount-neutral">{{ item.amount }}</td></tr>
  {% endfor %}
  <tr class="highlight-row"><td>Net Financing Cash Flow</td><td style="text-align:right" class="amount-neutral">{{ cash_flow.financing.total }}</td></tr>
  </tbody>
</table>
<div class="summary-grid" style="margin-top: 20px;">
  <div class="summary-card"><div class="label">Net Change in Cash</div><div class="value">₹{{ "%.2f"|format(cash_flow.net_change) }}</div></div>
</div>
<div class="footer">RenoPay AI Accounting Engine</div>
</div>

</body></html>
""",
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
