import { useState, useEffect } from "react";
import { AccountingAPI, AnalyticsAPI } from "../lib/api";
import { Card, Btn, Badge } from "../components/ui";
import { fmt } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { PdfPreviewModal } from "../components/PdfPreviewModal";
import { DatePickerInput } from "../components/DatePickerInput";

function formatDateStr(d) {
  return d.toISOString().split("T")[0];
}

function SectionDateFilterBar({
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  onViewPdf,
  onDownloadPdf,
  viewLabel = "View PDF",
  downloadLabel = "Download PDF",
  singleDate = false,
  singleDateLabel = "As-of Date",
  title = "Filter by Date Range",
}) {
  return (
    <div className="bg-surf/80 border border-line rounded-xl p-3 mb-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-textLight flex items-center gap-1.5">
          <span>📅</span> {title}
        </span>
        <span className="text-[10px] text-muted font-mono">
          {singleDate
            ? (from || "Latest Position")
            : (from && to ? `${from} → ${to}` : (from ? `From ${from}` : (to ? `Up to ${to}` : "All Records")))}
        </span>
      </div>

      <div className="flex items-end gap-2">
        {singleDate ? (
          <div className="flex-1">
            <label className="block text-[9px] text-muted font-bold mb-1 uppercase tracking-wider">
              {singleDateLabel}
            </label>
            <DatePickerInput
              value={from || ""}
              onChange={(e) => onFromChange(e.target.value)}
              title={singleDateLabel}
            />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-muted font-bold mb-1 uppercase tracking-wider">
                From Date
              </label>
              <DatePickerInput
                value={from || ""}
                onChange={(e) => onFromChange(e.target.value)}
                title="From Date"
              />
            </div>
            <div>
              <label className="block text-[9px] text-muted font-bold mb-1 uppercase tracking-wider">
                To Date
              </label>
              <DatePickerInput
                value={to || ""}
                onChange={(e) => onToChange(e.target.value)}
                title="To Date"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onApply}
          title="Apply Date Filter"
          className="h-[34px] px-3.5 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-sm hover:brightness-110 shadow-accentGlow active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          ✓
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-line/60">
        <button
          type="button"
          onClick={onViewPdf}
          className="py-2 px-3 rounded-lg text-[11px] font-bold bg-card border border-accent/40 text-accent hover:bg-accent/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>👁</span>
          <span>{viewLabel}</span>
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          className="py-2 px-3 rounded-lg text-[11px] font-bold bg-accent text-white hover:brightness-110 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>⬇</span>
          <span>{downloadLabel}</span>
        </button>
      </div>
    </div>
  );
}

export function AccountingScreen({ onBack }) {
  const { profile } = useAuth();

  const [devMode, setDevMode] = useState(false);
  const [activeTab, setActiveTab] = useState("journal");
  const [fullPackOpen, setFullPackOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Date Range state for Full Accounting Pack PDF
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Individual Tab Date Filter states
  const [journalFrom, setJournalFrom] = useState("");
  const [journalTo, setJournalTo] = useState("");

  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");

  const [payeeFrom, setPayeeFrom] = useState("");
  const [payeeTo, setPayeeTo] = useState("");

  const [trialAsOf, setTrialAsOf] = useState("");

  const [complianceFrom, setComplianceFrom] = useState("");
  const [complianceTo, setComplianceTo] = useState("");

  // PDF Preview Modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("Accounting Report");
  const [previewFilename, setPreviewFilename] = useState("RenoPay_Accounting_Pack.pdf");

  const [journal, setJournal] = useState([]);
  const [coas, setCoas] = useState([]);
  const [selectedCoa, setSelectedCoa] = useState(null);
  const [generalLedger, setGeneralLedger] = useState(null);
  const [payeeLedger, setPayeeLedger] = useState(null);
  const [selectedPayee, setSelectedPayee] = useState("");
  const [trialBalance, setTrialBalance] = useState(null);

  // Phase 2 state
  const [gstReport, setGstReport] = useState(null);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [payrollSuccess, setPayrollSuccess] = useState(false);

  // Phase 3 state
  const [invoices, setInvoices] = useState([]);
  const [newInvoiceCustomer, setNewInvoiceCustomer] = useState("Acme Corp");
  const [newInvoiceAmount, setNewInvoiceAmount] = useState(5000);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
    } else if (preset === "this_month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDateStr(first));
      setToDate(formatDateStr(now));
    } else if (preset === "last_30") {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setFromDate(formatDateStr(past));
      setToDate(formatDateStr(now));
    } else if (preset === "last_month") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(formatDateStr(first));
      setToDate(formatDateStr(last));
    }
  };

  const fetchJournal = async (f, t) => {
    try {
      const data = await AccountingAPI.getJournal(f || undefined, t || undefined);
      setJournal(data);
    } catch (e) {
      console.error("fetchJournal error:", e);
    }
  };

  const fetchGeneralLedger = async (coaId, f, t) => {
    if (!coaId) return;
    try {
      const data = await AccountingAPI.getLedger(coaId, f || undefined, t || undefined);
      setGeneralLedger(data);
    } catch (e) {
      console.error("fetchGeneralLedger error:", e);
    }
  };

  const fetchPayeeLedger = async (vpa, f, t) => {
    if (!vpa) return;
    try {
      const data = await AccountingAPI.getPayeeLedger(vpa, f || undefined, t || undefined);
      setPayeeLedger(data);
    } catch (e) {
      console.error("fetchPayeeLedger error:", e);
    }
  };

  const fetchTrialBalance = async (asOf) => {
    try {
      const data = await AccountingAPI.getTrialBalance(asOf || undefined);
      setTrialBalance(data);
    } catch (e) {
      console.error("fetchTrialBalance error:", e);
    }
  };

  const fetchCompliance = async (f, t) => {
    try {
      const data = await AccountingAPI.getGstReport(f || undefined, t || undefined);
      setGstReport(data);
    } catch (e) {
      console.error("fetchCompliance error:", e);
    }
  };

  useEffect(() => {
    if (devMode) {
      if (activeTab === "journal") {
        fetchJournal(journalFrom, journalTo);
      } else if (activeTab === "general") {
        AccountingAPI.getChartOfAccounts()
          .then((coaData) => {
            setCoas(coaData);
            if (coaData.length > 0) {
              const currentId = selectedCoa || coaData[0].id;
              if (!selectedCoa) setSelectedCoa(currentId);
              fetchGeneralLedger(currentId, ledgerFrom, ledgerTo);
            }
          })
          .catch(console.error);
      } else if (activeTab === "payee" && selectedPayee) {
        fetchPayeeLedger(selectedPayee, payeeFrom, payeeTo);
      } else if (activeTab === "trial") {
        fetchTrialBalance(trialAsOf);
      } else if (activeTab === "compliance") {
        fetchCompliance(complianceFrom, complianceTo);
      } else if (activeTab === "invoices") {
        AccountingAPI.getInvoices().then(setInvoices).catch(console.error);
      }
    }
  }, [devMode, activeTab]);

  useEffect(() => {
    if (activeTab === "general" && selectedCoa) {
      fetchGeneralLedger(selectedCoa, ledgerFrom, ledgerTo);
    }
  }, [selectedCoa]);

  useEffect(() => {
    if (activeTab === "payee" && selectedPayee) {
      fetchPayeeLedger(selectedPayee, payeeFrom, payeeTo);
    }
  }, [selectedPayee]);

  const toggleDevMode = async () => {
    const next = !devMode;
    setDevMode(next);
    try {
      await AccountingAPI.toggleDevMode(next);
    } catch (e) {
      setDevMode(!next);
    }
  };

  // Full Accounting Pack Download
  const handleDownload = async () => {
    setError(""); setSuccess(false); setDownloading(true);
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: "full_accounting_pack",
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = `RenoPay_Accounting_Pack${fromDate ? `_${fromDate}` : ""}${toDate ? `_to_${toDate}` : ""}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      console.error("Download accounting report failed:", e);
      let msg = "Failed to generate report. Try again.";
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) msg = json.detail;
          else if (text) msg = text.slice(0, 150);
        } catch (_) { }
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

  // Full Accounting Pack View
  const handleViewPdf = async () => {
    setError(""); setSuccess(false); setViewing(true);
    const filename = `RenoPay_Accounting_Pack${fromDate ? `_${fromDate}` : ""}${toDate ? `_to_${toDate}` : ""}.pdf`;
    setPreviewFilename(filename);
    setPreviewTitle("RenoPay Accounting Pack");
    setPreviewBlob(null);
    setPreviewLoading(true);
    setPreviewModalOpen(true);

    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: "full_accounting_pack",
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setPreviewBlob(blob);
    } catch (e) {
      console.error("View accounting report failed:", e);
      let msg = "Failed to generate report for viewing. Try again.";
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) msg = json.detail;
          else if (text) msg = text.slice(0, 150);
        } catch (_) { }
      } else if (e?.response?.data?.detail) {
        msg = e.response.data.detail;
      } else if (e?.message) {
        msg = e.message;
      }
      setError(msg);
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
      setViewing(false);
    }
  };

  // Section PDF View (Journal, General Ledger, Payee Ledger, Trial Balance, Balance Sheet)
  const handleViewSectionPdf = async (type, from, to, title, filename) => {
    setError("");
    setPreviewFilename(filename || `RenoPay_${type}.pdf`);
    setPreviewTitle(title || "Report Preview");
    setPreviewBlob(null);
    setPreviewLoading(true);
    setPreviewModalOpen(true);

    try {
      const blob = await AnalyticsAPI.downloadReport({
        type,
        from: from || undefined,
        to: to || undefined,
      });
      setPreviewBlob(blob);
    } catch (e) {
      console.error("View report failed:", e);
      let msg = "Failed to load report. Try again.";
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) msg = json.detail;
          else if (text) msg = text.slice(0, 150);
        } catch (_) { }
      } else if (e?.response?.data?.detail) {
        msg = e.response.data.detail;
      } else if (e?.message) {
        msg = e.message;
      }
      setError(msg);
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Section PDF Download
  const handleDownloadSectionPdf = async (type, from, to, filename) => {
    setError("");
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type,
        from: from || undefined,
        to: to || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `RenoPay_${type}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download report failed:", e);
      let msg = "Failed to download report. Try again.";
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) msg = json.detail;
          else if (text) msg = text.slice(0, 150);
        } catch (_) { }
      } else if (e?.response?.data?.detail) {
        msg = e.response.data.detail;
      } else if (e?.message) {
        msg = e.message;
      }
      setError(msg);
    }
  };

  const runPayroll = async () => {
    setRunningPayroll(true);
    setPayrollSuccess(false);
    try {
      const employees = [
        { name: "John Doe", salary: 500 },
        { name: "Jane Smith", salary: 600 }
      ];
      await AccountingAPI.generatePayroll(employees);
      setPayrollSuccess(true);
      setTimeout(() => setPayrollSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setRunningPayroll(false);
    }
  };

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      await AccountingAPI.createInvoice(newInvoiceCustomer, newInvoiceAmount);
      const data = await AccountingAPI.getInvoices();
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handlePayInvoice = async (id) => {
    setPayingInvoice(id);
    try {
      await AccountingAPI.payInvoice(id);
      const data = await AccountingAPI.getInvoices();
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setPayingInvoice(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {/* Header */}
      <div className="pt-[50px] pb-4 px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-text rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Business Mode</h2>
      </div>

      <div className="px-[22px] flex flex-col gap-4">

        {/* Dev Mode Toggle Card */}
        <Card className="p-4 flex items-center justify-between bg-gradient-to-r from-[#192926] to-[#2d4a42]">
          <div>
            <h3 className="text-white font-bold text-[16px] mb-1">Developer Mode</h3>
            <p className="text-white/70 text-[11px]">Enable raw double-entry ledger access</p>
          </div>
          <button
            onClick={toggleDevMode}
            className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 ${devMode ? 'bg-accent' : 'bg-line'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${devMode ? 'translate-x-6' : ''}`} />
          </button>
        </Card>

        {!devMode ? (
          <Card className="p-5 text-center mt-4 border-dashed border-2">
            <div className="text-4xl mb-3">🛠</div>
            <h3 className="text-text font-bold text-[18px] mb-2">Unlock Accounting Engine</h3>
            <p className="text-muted text-[12px] leading-relaxed">
              Enable Developer Mode to view raw double-entry journal postings, general ledgers, T-accounts, and download full compliance packs.
            </p>
          </Card>
        ) : (
          <>
            {/* Collapsible Full Accounting Pack Option */}
            <Card className="p-3.5 border-line/80 shadow-md">
              <div
                onClick={() => setFullPackOpen(!fullPackOpen)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center text-accent text-lg font-bold shrink-0">
                    📑
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-bold text-textLight">Full Accounting Report</h4>
                      <Badge variant="gold" className="text-[9px] py-0 px-1.5">All-in-One Pack</Badge>
                    </div>
                    <p className="text-muted text-[11px] mt-0.5">
                      Journal, General Ledger, Payee & Trial Balance in one bundle
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-accent font-bold text-[12px] bg-accent/10 px-2.5 py-1.5 rounded-lg shrink-0">
                  <span>{fullPackOpen ? "Hide" : "Open"}</span>
                  <span className={`transform transition-transform text-xs ${fullPackOpen ? "rotate-180" : ""}`}>▾</span>
                </div>
              </div>

              {fullPackOpen && (
                <div className="mt-3.5 pt-3.5 border-t border-line/70">
                  <div className="bg-surf/80 border border-line rounded-xl p-3 mb-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-textLight uppercase tracking-wider">
                        Filter by Date Range...
                      </label>
                      <span className="text-[10px] text-muted font-mono">
                        {datePreset === "all" ? "All Time Records" : `${fromDate || "Start"} → ${toDate || "End"}`}
                      </span>
                    </div>

                    {/* Preset Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        { id: "all", label: "All Time" },
                        { id: "this_month", label: "This Month" },
                        { id: "last_30", label: "Last 30 Days" },
                        { id: "last_month", label: "Last Month" },
                        { id: "custom", label: "Custom Range" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyDatePreset(p.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${datePreset === p.id
                              ? "bg-accent text-white shadow-sm"
                              : "bg-card border border-line text-muted hover:text-white"
                            }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Date Inputs */}
                    {datePreset === "custom" && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-line/60">
                        <div>
                          <label className="block text-[10px] text-muted font-bold mb-1">From Date</label>
                          <DatePickerInput
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            title="From Date"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted font-bold mb-1">To Date</label>
                          <DatePickerInput
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            title="To Date"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error and Success alerts */}
                  {error && (
                    <p className="text-danger text-xs text-center bg-danger/5 border border-danger/20 rounded-xl px-4 py-2 mb-3">
                      {error}
                    </p>
                  )}
                  {success && (
                    <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-2.5 mb-3 text-center">
                      <p className="text-success font-semibold text-xs">✅ Full Accounting Pack Downloaded!</p>
                    </div>
                  )}

                  {/* Dual Action Buttons: View and Download */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleViewPdf}
                      disabled={viewing || downloading}
                      className="w-full py-2.5 px-3 rounded-xl text-[12px] font-bold bg-card border border-accent/50 text-accent hover:bg-accent/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-sm cursor-pointer"
                    >
                      {viewing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                          <span>Loading…</span>
                        </>
                      ) : (
                        <>
                          <span>👁</span>
                          <span>View Full Pack</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={downloading || viewing}
                      className="w-full py-2.5 px-3 rounded-xl text-[12px] font-bold bg-accent text-white shadow-accentGlow hover:brightness-110 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                    >
                      {downloading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Downloading…</span>
                        </>
                      ) : (
                        <>
                          <span>⬇</span>
                          <span>Download Pack</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2 no-scrollbar">
              {["journal", "general", "payee", "trial", "compliance", "invoices"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer
                    ${activeTab === t ? "bg-accent text-white shadow-accentGlow" : "bg-card text-muted border border-line"}`}
                >
                  {t === "journal" && "Journal"}
                  {t === "general" && "General Ledger"}
                  {t === "payee" && "Payee Ledger"}
                  {t === "trial" && "Trial Balance"}
                  {t === "compliance" && "Compliance"}
                  {t === "invoices" && "Invoices"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "journal" && (
              <Card className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider uppercase">Journal Entries</h3>
                  <Badge variant="teal">Double Entry</Badge>
                </div>

                <SectionDateFilterBar
                  from={journalFrom}
                  to={journalTo}
                  onFromChange={setJournalFrom}
                  onToChange={setJournalTo}
                  onApply={() => fetchJournal(journalFrom, journalTo)}
                  onViewPdf={() => handleViewSectionPdf(
                    "journal",
                    journalFrom,
                    journalTo,
                    "Journal Entries Report",
                    `Journal_Entries_${journalFrom || "all"}_to_${journalTo || "now"}.pdf`
                  )}
                  onDownloadPdf={() => handleDownloadSectionPdf(
                    "journal",
                    journalFrom,
                    journalTo,
                    `Journal_Entries_${journalFrom || "all"}_to_${journalTo || "now"}.pdf`
                  )}
                  viewLabel="View Journal PDF"
                  downloadLabel="Download PDF"
                  title="Journal Date Filter"
                />

                <div className="flex flex-col gap-4">
                  {journal.map((j) => (
                    <div key={j.entry_no} className="border border-line rounded-lg overflow-hidden text-[11px]">
                      <div className="bg-card px-3 py-2 border-b border-line flex justify-between items-center">
                        <span className="font-mono font-bold text-accent">{j.entry_no}</span>
                        <span className="text-muted">{j.date}</span>
                      </div>
                      <div className="p-3 bg-surf">
                        <p className="text-muted mb-2">{j.narration}</p>
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-muted border-b border-line">
                              <th className="pb-1 font-semibold">Account</th>
                              <th className="pb-1 font-semibold text-right">Debit</th>
                              <th className="pb-1 font-semibold text-right">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {j.lines.map((l, i) => (
                              <tr key={i} className="border-b border-line/50 last:border-none">
                                <td className="py-1.5">{l.account_name}</td>
                                <td className="py-1.5 text-right font-mono text-danger font-semibold">{l.debit ? l.debit : ''}</td>
                                <td className="py-1.5 text-right font-mono text-teal font-semibold">{l.credit ? l.credit : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {journal.length === 0 && <p className="text-muted text-center text-xs py-4">No entries found for this range.</p>}
                </div>
              </Card>
            )}

            {activeTab === "general" && (
              <Card className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider uppercase">General Ledger</h3>
                  <Badge variant="teal">T-Account</Badge>
                </div>

                <select
                  className="w-full bg-surf border border-line rounded-xl p-3 text-sm text-text mb-3 outline-none focus:border-accent"
                  value={selectedCoa || ""}
                  onChange={(e) => setSelectedCoa(e.target.value)}
                >
                  {coas.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>

                <SectionDateFilterBar
                  from={ledgerFrom}
                  to={ledgerTo}
                  onFromChange={setLedgerFrom}
                  onToChange={setLedgerTo}
                  onApply={() => fetchGeneralLedger(selectedCoa, ledgerFrom, ledgerTo)}
                  onViewPdf={() => handleViewSectionPdf(
                    "general_ledger",
                    ledgerFrom,
                    ledgerTo,
                    "General Ledger Report",
                    `General_Ledger_${ledgerFrom || "all"}_to_${ledgerTo || "now"}.pdf`
                  )}
                  onDownloadPdf={() => handleDownloadSectionPdf(
                    "general_ledger",
                    ledgerFrom,
                    ledgerTo,
                    `General_Ledger_${ledgerFrom || "all"}_to_${ledgerTo || "now"}.pdf`
                  )}
                  viewLabel="View Ledger PDF"
                  downloadLabel="Download PDF"
                  title="Ledger Date Filter"
                />

                {generalLedger && (
                  <div className="overflow-x-auto text-[11px]">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead>
                        <tr className="text-muted border-b border-line">
                          <th className="pb-2 font-semibold">Date</th>
                          <th className="pb-2 font-semibold">Narration</th>
                          <th className="pb-2 font-semibold text-right">Debit</th>
                          <th className="pb-2 font-semibold text-right">Credit</th>
                          <th className="pb-2 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generalLedger.lines.map((l, i) => (
                          <tr key={i} className="border-b border-line/50 last:border-none">
                            <td className="py-2 text-muted">{l.date}</td>
                            <td className="py-2 max-w-[120px] truncate pr-2">{l.narration}</td>
                            <td className="py-2 text-right font-mono text-danger">{l.debit ? l.debit : ''}</td>
                            <td className="py-2 text-right font-mono text-teal">{l.credit ? l.credit : ''}</td>
                            <td className="py-2 text-right font-mono font-bold text-text">{l.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 pt-3 border-t border-line flex justify-between font-bold text-sm">
                      <span>Closing Balance</span>
                      <span className="font-mono">{generalLedger.closing_balance}</span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {activeTab === "payee" && (
              <Card className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider uppercase">Payee Ledger</h3>
                  <Badge variant="teal">VPA Scoped</Badge>
                </div>

                <input
                  type="text"
                  placeholder="Enter Payee VPA (e.g. food@renopay)"
                  className="w-full bg-surf border border-line rounded-xl p-3 text-sm text-text mb-3 outline-none focus:border-accent"
                  value={selectedPayee}
                  onChange={(e) => setSelectedPayee(e.target.value)}
                />

                <SectionDateFilterBar
                  from={payeeFrom}
                  to={payeeTo}
                  onFromChange={setPayeeFrom}
                  onToChange={setPayeeTo}
                  onApply={() => fetchPayeeLedger(selectedPayee, payeeFrom, payeeTo)}
                  onViewPdf={() => handleViewSectionPdf(
                    "payee_ledger",
                    payeeFrom,
                    payeeTo,
                    "Payee Ledger Report",
                    `Payee_Ledger_${payeeFrom || "all"}_to_${payeeTo || "now"}.pdf`
                  )}
                  onDownloadPdf={() => handleDownloadSectionPdf(
                    "payee_ledger",
                    payeeFrom,
                    payeeTo,
                    `Payee_Ledger_${payeeFrom || "all"}_to_${payeeTo || "now"}.pdf`
                  )}
                  viewLabel="View Payee PDF"
                  downloadLabel="Download PDF"
                  title="Payee Date Filter"
                />

                {payeeLedger && payeeLedger.lines.length > 0 ? (
                  <div className="overflow-x-auto text-[11px]">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead>
                        <tr className="text-muted border-b border-line">
                          <th className="pb-2 font-semibold">Date</th>
                          <th className="pb-2 font-semibold">Account</th>
                          <th className="pb-2 font-semibold text-right">Debit</th>
                          <th className="pb-2 font-semibold text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payeeLedger.lines.map((l, i) => (
                          <tr key={i} className="border-b border-line/50">
                            <td className="py-2 text-muted">{l.date}</td>
                            <td className="py-2">{l.account_name}</td>
                            <td className="py-2 text-right font-mono text-danger">{l.debit ? l.debit : ''}</td>
                            <td className="py-2 text-right font-mono text-teal">{l.credit ? l.credit : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 pt-3 border-t border-line flex justify-between font-bold text-[12px]">
                      <span>Totals</span>
                      <div className="flex gap-4">
                        <span className="font-mono text-danger">{payeeLedger.total_debit}</span>
                        <span className="font-mono text-teal">{payeeLedger.total_credit}</span>
                      </div>
                    </div>
                  </div>
                ) : selectedPayee && (
                  <p className="text-muted text-center text-xs py-4">No transactions found for this payee in selected range.</p>
                )}
              </Card>
            )}

            {activeTab === "trial" && (
              <Card className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider uppercase">Trial Balance</h3>
                  <Badge variant="teal">Audit Verification</Badge>
                </div>

                <SectionDateFilterBar
                  singleDate={true}
                  singleDateLabel="As-of Date"
                  from={trialAsOf}
                  onFromChange={setTrialAsOf}
                  onApply={() => fetchTrialBalance(trialAsOf)}
                  onViewPdf={() => handleViewSectionPdf(
                    "trial_balance",
                    undefined,
                    trialAsOf,
                    "Trial Balance Report",
                    `Trial_Balance_${trialAsOf || "latest"}.pdf`
                  )}
                  onDownloadPdf={() => handleDownloadSectionPdf(
                    "trial_balance",
                    undefined,
                    trialAsOf,
                    `Trial_Balance_${trialAsOf || "latest"}.pdf`
                  )}
                  viewLabel="View Trial Balance PDF"
                  downloadLabel="Download PDF"
                  title="Trial Balance As-Of Filter"
                />

                {trialBalance && (
                  <>
                    {!trialBalance.balanced && (
                      <div className="text-danger bg-danger/10 border border-danger p-2 rounded mb-3 text-xs font-bold text-center">
                        ⚠️ BALANCE MISMATCH
                      </div>
                    )}
                    <div className="overflow-x-auto text-[11px] mt-3">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead>
                          <tr className="text-muted border-b border-line">
                            <th className="pb-2 font-semibold">Code</th>
                            <th className="pb-2 font-semibold">Account Name</th>
                            <th className="pb-2 font-semibold text-right">Debit</th>
                            <th className="pb-2 font-semibold text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trialBalance.rows.map((r, i) => (
                            <tr key={i} className="border-b border-line/50">
                              <td className="py-2 font-mono text-muted">{r.code}</td>
                              <td className="py-2">{r.name}</td>
                              <td className="py-2 text-right font-mono text-danger">{r.debit ? r.debit : ''}</td>
                              <td className="py-2 text-right font-mono text-teal">{r.credit ? r.credit : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 pt-3 border-t border-line flex justify-between font-bold text-[12px]">
                        <span>Totals</span>
                        <div className="flex gap-4">
                          <span className="font-mono text-danger">{trialBalance.total_debit}</span>
                          <span className="font-mono text-teal">{trialBalance.total_credit}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            )}

            {activeTab === "compliance" && (
              <div className="flex flex-col gap-4">
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[12px] font-bold text-textLight tracking-wider uppercase">Estimated GST & Balance Sheet</h3>
                    <Badge variant="teal">Compliance</Badge>
                  </div>

                  <SectionDateFilterBar
                    from={complianceFrom}
                    to={complianceTo}
                    onFromChange={setComplianceFrom}
                    onToChange={setComplianceTo}
                    onApply={() => fetchCompliance(complianceFrom, complianceTo)}
                    onViewPdf={() => handleViewSectionPdf(
                      "balance_sheet",
                      complianceFrom,
                      complianceTo,
                      "Balance Sheet & Financials",
                      `Balance_Sheet_${complianceFrom || "all"}_to_${complianceTo || "now"}.pdf`
                    )}
                    onDownloadPdf={() => handleDownloadSectionPdf(
                      "balance_sheet",
                      complianceFrom,
                      complianceTo,
                      `Balance_Sheet_${complianceFrom || "all"}_to_${complianceTo || "now"}.pdf`
                    )}
                    viewLabel="View Balance Sheet PDF"
                    downloadLabel="Download PDF"
                    title="Financials Date Filter"
                  />

                  {gstReport ? (
                    <div className="flex flex-col gap-4">
                      <div className="bg-surf p-3 rounded-xl border border-line">
                        <p className="text-xs text-muted mb-1">Total Output Tax (Sales)</p>
                        <p className="text-lg font-mono font-bold text-teal">₹{gstReport.outward_supplies.total_tax}</p>
                      </div>
                      <div className="bg-surf p-3 rounded-xl border border-line">
                        <p className="text-xs text-muted mb-1">Total Input Tax (Purchases)</p>
                        <p className="text-lg font-mono font-bold text-danger">₹{gstReport.inward_supplies.total_tax}</p>
                      </div>
                      <div className="bg-card p-3 rounded-xl border border-accent/30 shadow-[0_0_15px_rgba(110,90,240,0.1)]">
                        <p className="text-xs text-muted mb-1">Net GST Payable</p>
                        <p className="text-xl font-mono font-bold text-text">₹{gstReport.net_gst_payable}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted text-xs text-center">Loading GST Report...</p>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-4 uppercase">Run Payroll</h3>
                  <p className="text-xs text-muted mb-4 leading-relaxed">
                    Automatically book salary expenses and credit cash/bank for your employees.
                  </p>
                  <div className="bg-surf rounded-xl border border-line p-3 mb-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold">John Doe</span>
                      <span className="font-mono text-muted">₹500.00</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">Jane Smith</span>
                      <span className="font-mono text-muted">₹600.00</span>
                    </div>
                  </div>
                  {payrollSuccess && (
                    <p className="text-success text-xs text-center mb-3">✅ Payroll journals booked successfully!</p>
                  )}
                  <Btn onClick={runPayroll} disabled={runningPayroll}>
                    {runningPayroll ? "Running Payroll..." : "Run Payroll Batch"}
                  </Btn>
                </Card>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="flex flex-col gap-4">
                <Card className="p-4">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-4 uppercase">Create Invoice</h3>
                  <div className="flex flex-col gap-3 mb-4">
                    <input
                      type="text"
                      value={newInvoiceCustomer}
                      onChange={(e) => setNewInvoiceCustomer(e.target.value)}
                      className="bg-surf border border-line rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                      placeholder="Customer Name"
                    />
                    <input
                      type="number"
                      value={newInvoiceAmount}
                      onChange={(e) => setNewInvoiceAmount(e.target.value)}
                      className="bg-surf border border-line rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                      placeholder="Amount (₹)"
                    />
                  </div>
                  <Btn onClick={handleCreateInvoice} disabled={creatingInvoice}>
                    {creatingInvoice ? "Creating..." : "Create Invoice"}
                  </Btn>
                </Card>

                <Card className="p-4">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-4 uppercase">Receivables</h3>
                  <div className="flex flex-col gap-3">
                    {invoices.length === 0 ? (
                      <p className="text-muted text-xs text-center">No invoices found.</p>
                    ) : (
                      invoices.map((inv) => (
                        <div key={inv.id} className="bg-surf p-3 rounded-xl border border-line flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-accent text-xs">{inv.invoice_no}</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${inv.status === 'PAID' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                              {inv.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{inv.customer_name}</span>
                              <span className="text-muted text-[10px]">{new Date(inv.created_at).toLocaleDateString()}</span>
                            </div>
                            <span className="text-lg font-mono font-bold">₹{inv.amount}</span>
                          </div>
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => handlePayInvoice(inv.id)}
                              disabled={payingInvoice === inv.id}
                              className="mt-2 w-full py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors"
                            >
                              {payingInvoice === inv.id ? "Marking..." : "Mark as Paid"}
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Static Explainer */}
            <Card className="p-4 mt-2">
              <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-4 uppercase">How it works</h3>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-semibold text-text">Transaction Sources</p>
                    <p className="text-xs text-muted">UPI, Cards, Bank Transfers</p>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-line ml-3"></div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-semibold text-text">AI Categorization</p>
                    <p className="text-xs text-muted">Maps merchant data to Chart of Accounts</p>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-line ml-3"></div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-semibold text-text">Append-Only Ledger</p>
                    <p className="text-xs text-muted">Double-entry system ensures balanced books</p>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-line ml-3"></div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">4</div>
                  <div>
                    <p className="text-sm font-semibold text-text">Reports & Answers</p>
                    <p className="text-xs text-muted">Balance Sheets, Trial Balance, T-Accounts</p>
                  </div>
                </div>
              </div>
            </Card>

          </>
        )}
      </div>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        pdfBlob={previewBlob}
        title={previewTitle}
        filename={previewFilename}
        loading={previewLoading}
      />
    </div>
  );
}
