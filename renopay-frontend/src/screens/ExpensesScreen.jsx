import { useState, useEffect, useCallback } from "react";
import { AnalyticsAPI } from "../lib/api";
import { Card, Btn, Badge } from "../components/ui";
import { fmt } from "../lib/format";
import { PdfPreviewModal } from "../components/PdfPreviewModal";
import { downloadOrSharePdf } from "../lib/download";

const CATEGORY_ICONS = {
  Food: "🍔",
  Shopping: "🛍️",
  Transport: "🚗",
  Bills: "⚡",
  Entertainment: "🍿",
  Health: "💊",
  Education: "📚",
  Investment: "📈",
  Income: "💰",
  Other: "📦",
};

const CATEGORY_COLORS = {
  Food: "#FF6A1A",
  Shopping: "#3B82F6",
  Transport: "#10B981",
  Bills: "#8B5CF6",
  Entertainment: "#EC4899",
  Health: "#EF4444",
  Education: "#F59E0B",
  Investment: "#EAB308",
  Income: "#059669",
  Other: "#6B7280",
};

export function ExpensesScreen({ onBack }) {
  const [period, setPeriod] = useState("month"); // week | month | all | custom
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Custom calendar date range
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  // PDF Preview & Download state
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFilename, setPdfFilename] = useState("renopay-expense-statement.pdf");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const sDate = period === "custom" ? startDate : null;
      const eDate = period === "custom" ? endDate : null;
      const res = await AnalyticsAPI.expenses(period, sDate, eDate);
      setData(res);
    } catch (e) {
      setErr("Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quick preset dates for custom picker
  const setPreset = (days) => {
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setStartDate(start);
    setEndDate(end);
  };

  const setThisMonthPreset = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.month || now.getMonth(), 1).toISOString().split("T")[0];
    const end = new Date().toISOString().split("T")[0];
    setStartDate(start);
    setEndDate(end);
  };

  // Generate / fetch PDF
  const fetchPdfBlob = async () => {
    const sDate = period === "custom" ? startDate : null;
    const eDate = period === "custom" ? endDate : null;
    const blob = await AnalyticsAPI.expensePdf(period, sDate, eDate);
    const fname = `renopay-expenses-${period === "custom" ? `${startDate}-to-${endDate}` : period}.pdf`;
    return { blob, fname };
  };

  const handleViewPdf = async () => {
    setPdfLoading(true);
    setErr("");
    try {
      const { blob, fname } = await fetchPdfBlob();
      setPdfBlob(blob);
      setPdfFilename(fname);
      setIsPdfModalOpen(true);
    } catch (e) {
      setErr("Failed to generate PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    setErr("");
    try {
      const { blob, fname } = await fetchPdfBlob();
      await downloadOrSharePdf(blob, fname);
    } catch (e) {
      setErr("Could not download PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const bpct = data?.budget_used_percent ?? 0;

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {/* Top App Bar */}
      <div className="pt-[50px] pb-[16px] px-[20px] flex items-center justify-between border-b border-line/40 bg-bg/95 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2 text-base hover:border-accent transition-colors"
            onClick={onBack}
          >
            ←
          </button>
          <div>
            <h2 className="text-[20px] font-extrabold text-textLight leading-none">Expense Tracker</h2>
            <p className="text-[11px] text-muted mt-0.5">Budgeting & Certified PDF Statements</p>
          </div>
        </div>

        {/* Action Buttons: View & Download PDF */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleViewPdf}
            disabled={pdfLoading || loading}
            className="btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#211A16] border border-accent/40 text-accent hover:bg-accent/10 transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
            title="View 2-Page Visual Statement PDF"
          >
            {pdfLoading ? (
              <span className="animate-spin inline-block h-3 w-3 border-2 border-accent border-t-transparent rounded-full" />
            ) : (
              <span>👁️ View PDF</span>
            )}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading || loading}
            className="btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
            title="Download 2-Page Visual Statement PDF"
          >
            <span>⬇️</span>
          </button>
        </div>
      </div>

      <div className="px-[20px] pt-4 flex flex-col gap-3.5">
        {/* Error Alert */}
        {err && (
          <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-medium flex justify-between items-center animate-fadeUp">
            <span>⚠️ {err}</span>
            <button onClick={() => setErr("")} className="text-white text-xs ml-2 cursor-pointer">✕</button>
          </div>
        )}

        {/* Period Selector Tabs */}
        <div className="flex gap-2">
          {[
            ["week", "Week"],
            ["month", "Month"],
            ["all", "All"],
            ["custom", "📅 Custom"],
          ].map(([v, l]) => (
            <button
              key={v}
              className="btn flex-1 py-2 rounded-[10px] text-xs font-semibold transition-all"
              style={{
                background: period === v ? "#FF6A1A" : "#151210",
                color: period === v ? "#fff" : "#8C827A",
                border: `1px solid ${period === v ? "#FF6A1A" : "#2A2320"}`,
              }}
              onClick={() => setPeriod(v)}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Custom Calendar Date Range Picker */}
        {period === "custom" && (
          <Card className="p-4 border-accent/30 bg-gradient-to-b from-[#1F1916] to-[#141110] animate-fadeUp">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-textLight flex items-center gap-1.5">
                <span>📅</span> Select Custom Date Range
              </p>
              <Badge color="#FF6A1A" size={10}>Calendar Filter</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-bg border border-line focus:border-accent text-textLight text-xs rounded-lg px-2.5 py-2 font-mono outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={todayStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-bg border border-line focus:border-accent text-textLight text-xs rounded-lg px-2.5 py-2 font-mono outline-none transition-colors"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-line/30">
              <span className="text-[10px] text-muted self-center mr-1">Quick:</span>
              <button
                onClick={() => setPreset(7)}
                className="px-2 py-1 rounded-md text-[10px] bg-card border border-line/60 text-textLight hover:border-accent"
              >
                Last 7D
              </button>
              <button
                onClick={() => setPreset(30)}
                className="px-2 py-1 rounded-md text-[10px] bg-card border border-line/60 text-textLight hover:border-accent"
              >
                Last 30D
              </button>
              <button
                onClick={setThisMonthPreset}
                className="px-2 py-1 rounded-md text-[10px] bg-card border border-line/60 text-textLight hover:border-accent"
              >
                This Month
              </button>
              <button
                onClick={() => { setStartDate(thirtyDaysAgoStr); setEndDate(todayStr); }}
                className="px-2 py-1 rounded-md text-[10px] bg-card border border-line/60 text-muted hover:text-white"
              >
                Reset
              </button>
            </div>
          </Card>
        )}

        {/* Loading Spinner */}
        {loading && !data && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-accent mb-2"></div>
            <p className="text-xs text-muted">Calculating financial heartbeat...</p>
          </div>
        )}

        {data && (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 border-danger/[.25] bg-gradient-to-br from-[#201515] to-[#151210]">
                <p className="text-muted text-[10px] tracking-wide font-semibold uppercase">Total Spent</p>
                <p className="font-mono text-2xl font-black text-danger mt-1.5">{fmt(data.total_spent)}</p>
                <p className="text-[10px] text-muted mt-1">Outflow</p>
              </Card>
              <Card className="p-4 border-teal/[.25] bg-gradient-to-br from-[#12201c] to-[#151210]">
                <p className="text-muted text-[10px] tracking-wide font-semibold uppercase">Total Inflow</p>
                <p className="font-mono text-2xl font-black text-teal mt-1.5">{fmt(data.total_income)}</p>
                <p className="text-[10px] mt-1" style={{ color: data.net >= 0 ? "#22C55E" : "#ef4444" }}>
                  Net: {data.net >= 0 ? "+" : ""}{fmt(data.net)}
                </p>
              </Card>
            </div>

            {/* Monthly Budget Card with Gauge */}
            <Card className="p-[18px] border-line/60 bg-gradient-to-b from-[#1c1815] to-[#141210]">
              <div className="flex justify-between items-center mb-2.5">
                <div>
                  <p className="text-[13px] font-bold text-textLight">Monthly Budget Adherence</p>
                  <p className="text-[10px] text-muted">Limit: {fmt(data.budget)}</p>
                </div>
                <div className="text-right">
                  <span
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: bpct > 85 ? "#ff3d6022" : bpct > 65 ? "#FFA00022" : "#22C55E22",
                      color: bpct > 85 ? "#ff3d60" : bpct > 65 ? "#FFA000" : "#22C55E",
                    }}
                  >
                    {bpct}% Used
                  </span>
                </div>
              </div>

              {/* Progress bar gauge */}
              <div className="bg-bg rounded-full h-2.5 overflow-hidden p-0.5 border border-line/30">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(2, bpct))}%`,
                    background: bpct > 85 ? "#ff3d60" : bpct > 65 ? "#FFA000" : "#22C55E",
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] mt-2.5 text-muted">
                <span>{bpct > 85 ? "🚨 Over budget risk" : bpct > 65 ? "⚠️ Moderate burn rate" : "✅ Well on track"}</span>
                <span className="font-mono font-medium text-textLight">
                  {fmt(Math.max(0, data.budget - data.total_spent))} remaining
                </span>
              </div>
            </Card>

            {/* Category Breakdown */}
            <Card className="p-[18px] border-line/60">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm font-extrabold text-textLight">Spending by Category</p>
                  <p className="text-[10px] text-muted">Detailed allocation and distribution</p>
                </div>
                <Badge color="#FF6A1A" size={10}>
                  {data.by_category.length} {data.by_category.length === 1 ? "Category" : "Categories"}
                </Badge>
              </div>

              {data.by_category.length === 0 ? (
                <div className="py-8 text-center text-muted text-xs">
                  <p className="text-2xl mb-1.5">🍃</p>
                  No spending recorded for this timeframe.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.by_category.map((c) => {
                    const icon = CATEGORY_ICONS[c.category] || "📦";
                    const color = CATEGORY_COLORS[c.category] || "#6B7280";
                    return (
                      <div key={c.category} className="p-2.5 rounded-xl bg-bg/40 border border-line/30">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[13px] font-semibold text-textLight flex items-center gap-1.5">
                            <span className="text-sm">{icon}</span>
                            <span>{c.category}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted bg-card px-1.5 py-0.5 rounded border border-line/40">
                              {c.percent}%
                            </span>
                            <span className="text-xs font-mono font-bold" style={{ color }}>
                              {fmt(c.amount)}
                            </span>
                          </div>
                        </div>
                        <div className="bg-bg rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(3, c.percent)}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Bottom Statement Download CTA Card */}
            <Card className="p-4 border-accent/30 bg-gradient-to-r from-[#211A16] to-[#171311] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-lg">
                  📄
                </div>
                <div>
                  <p className="text-xs font-bold text-textLight">EXPENSE REPORT</p>
                  <p className="text-[10px] text-muted">FULL MONTH REPORT</p>
                </div>
              </div>
              <button
                onClick={handleViewPdf}
                disabled={pdfLoading}
                className="btn px-3 py-2 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent/90 transition-all flex items-center gap-1 shadow-md disabled:opacity-50"
              >
                {pdfLoading ? "Generating..." : "View PDF ↗"}
              </button>
            </Card>
          </>
        )}
      </div>

      {/* PDF Canvas / In-App Viewer Modal */}
      <PdfPreviewModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfBlob={pdfBlob}
        title="RenoPay Financial Statement"
        filename={pdfFilename}
        loading={pdfLoading}
      />
    </div>
  );
}
