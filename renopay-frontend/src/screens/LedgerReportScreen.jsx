import { useState, useEffect } from "react";
import { AnalyticsAPI, PaymentAPI } from "../lib/api";
import { Card, Btn, Badge } from "../components/ui";
import { fmt, ago } from "../lib/format";

/**
 * LedgerReportScreen — PDF Report Generation.
 *
 * Lets the user choose a date range and report type, then
 * fetches /analytics/report which streams a PDF (or HTML if WeasyPrint
 * is not installed). The browser then triggers a native download.
 */

const REPORT_TYPES = [
  { key: "full_accounting_pack", label: "Accounting Pack", icon: "📑", desc: "Journals, Ledgers, Trial Balance, P&L, Balance Sheet & Cash Flow" },
  { key: "balance_sheet", label: "Balance Sheet", icon: "📊", desc: "All credits & debits with category breakdown" },
  { key: "profit_loss",   label: "P&L Report",    icon: "📈", desc: "Income vs expenses with net profit/loss" },
  { key: "transaction_receipt", label: "Receipt",  icon: "🧾", desc: "Single-transaction receipt by reference" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export function LedgerReportScreen({ onBack }) {
  const [reportType, setReportType] = useState("balance_sheet");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  const [txnRef, setTxnRef] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [recentTxns, setRecentTxns] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    PaymentAPI.getTransactions(10, 0)
      .then(setRecentTxns)
      .catch(() => {});
    // Live preview: fetch expense summary
    AnalyticsAPI.expenses("month")
      .then(setPreview)
      .catch(() => {});
  }, []);

  const handleDownload = async () => {
    setError(""); setSuccess(false); setDownloading(true);
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: reportType,
        from: fromDate,
        to: toDate,
        txn_ref: reportType === "transaction_receipt" ? txnRef : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = blob.type?.includes("html") ? "html" : "pdf";
      a.download = `RenoPay_${reportType}_${fromDate}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      console.error("Download report failed:", e);
      let msg = "Failed to generate report. Try again.";
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) msg = json.detail;
          else if (text) msg = text.slice(0, 150);
        } catch (_) {}
      } else if (e?.response?.data?.detail) {
        msg = e.response.data.detail;
      } else if (e?.message) {
        msg = e.message;
      }
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const selectedType = REPORT_TYPES.find((r) => r.key === reportType);

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {/* Header */}
      <div className="pt-[50px] pb-4 px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Reports & PDF 📄</h2>
      </div>

      <div className="px-[22px] flex flex-col gap-4">

        {/* Live Preview Stats */}
        {preview && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Income", value: fmt(preview.total_income), color: "#22C55E" },
              { label: "Spent", value: fmt(preview.total_spent), color: "#FF6A1A" },
              { label: "Net", value: fmt(preview.net), color: preview.net >= 0 ? "#22C55E" : "#FF6A1A" },
            ].map((s) => (
              <Card key={s.label} className="p-3 text-center">
                <p className="text-[9px] text-muted font-bold tracking-widest mb-1">{s.label}</p>
                <p className="text-base font-extrabold font-mono" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-muted">this month</p>
              </Card>
            ))}
          </div>
        )}

        {/* Report Type Selector */}
        <Card className="p-4">
          <p className="text-[10px] text-muted font-bold tracking-widest mb-3">REPORT TYPE</p>
          <div className="flex flex-col gap-2">
            {REPORT_TYPES.map((r) => (
              <button
                key={r.key}
                className="btn flex items-center gap-3 p-3 rounded-xl text-left"
                style={{
                  background: reportType === r.key ? "#FF6A1A15" : "#151210",
                  border: `1.5px solid ${reportType === r.key ? "#FF6A1A" : "#2A2320"}`,
                }}
                onClick={() => setReportType(r.key)}
              >
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-textLight">{r.label}</p>
                  <p className="text-muted text-[11px]">{r.desc}</p>
                </div>
                {reportType === r.key && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Date Range / TxnRef Input */}
        {reportType !== "transaction_receipt" ? (
          <Card className="p-4">
            <p className="text-[10px] text-muted font-bold tracking-widest mb-3">DATE RANGE</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted mb-1">From</p>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="text-sm" max={toDate} />
              </div>
              <div>
                <p className="text-[10px] text-muted mb-1">To</p>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="text-sm" min={fromDate} max={today()} />
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <p className="text-[10px] text-muted font-bold tracking-widest mb-2">TRANSACTION REF</p>
            <input
              placeholder="RENO-TXN-XXXX (from history)"
              value={txnRef}
              onChange={(e) => setTxnRef(e.target.value.toUpperCase())}
              className="font-mono text-sm"
            />
            {recentTxns.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-muted mb-1.5">Recent transactions:</p>
                <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5">
                  {recentTxns.slice(0, 6).map((t) => (
                    <button
                      key={t.txn_ref}
                      className="btn flex items-center justify-between p-2 rounded-lg text-left"
                      style={{ background: txnRef === t.txn_ref ? "#FF6A1A18" : "#151210", border: `1px solid ${txnRef === t.txn_ref ? "#FF6A1A" : "#2A2320"}` }}
                      onClick={() => setTxnRef(t.txn_ref)}
                    >
                      <span className="text-textLight text-[11px] font-mono">{t.txn_ref}</span>
                      <span className={`text-[11px] font-bold font-mono ${t.type === "credit" ? "text-teal" : "text-danger"}`}>
                        {t.type === "credit" ? "+" : "-"}{fmt(t.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Download Button */}
        {error && (
          <p className="text-danger text-xs text-center bg-danger/5 border border-danger/20 rounded-xl px-4 py-2.5">{error}</p>
        )}
        {success && (
          <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 text-center">
            <p className="text-success font-semibold text-sm">✅ PDF downloaded successfully!</p>
          </div>
        )}

        <Btn
          onClick={handleDownload}
          disabled={downloading || (reportType === "transaction_receipt" && !txnRef)}
        >
          {downloading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating PDF…
            </span>
          ) : (
            `⬇ Download ${selectedType?.label} PDF`
          )}
        </Btn>

        {/* Category breakdown preview */}
        {preview?.by_category?.length > 0 && reportType !== "transaction_receipt" && (
          <Card className="p-4">
            <p className="text-[10px] text-muted font-bold tracking-widest mb-3">THIS MONTH'S SPEND PREVIEW</p>
            {preview.by_category.slice(0, 5).map((c) => (
              <div key={c.category} className="mb-2.5">
                <div className="flex justify-between mb-1">
                  <p className="text-textLight text-xs font-semibold">{c.category}</p>
                  <p className="text-muted text-[11px]">{fmt(c.amount)} · {c.percent}%</p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2A2320" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.percent}%`, background: "linear-gradient(90deg,#B8420E,#FF6A1A)" }} />
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Info Note */}
        <div className="flex items-start gap-2 px-2 pb-2">
          <span className="text-[14px] mt-0.5">💡</span>
          <p className="text-muted text-[11px] leading-relaxed">
            Reports are generated directly from your <strong className="text-textLight">immutable transaction ledger</strong> — 100% accurate, no estimates.
            Perfect for tax filing, expense audits, or sharing with your accountant.
          </p>
        </div>
      </div>
    </div>
  );
}
