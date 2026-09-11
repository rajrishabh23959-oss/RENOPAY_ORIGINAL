import { useState, useEffect } from "react";
import { AccountingAPI, AnalyticsAPI } from "../lib/api";
import { Card, Btn, Badge } from "../components/ui";
import { fmt } from "../lib/format";
import { useAuth } from "../context/AuthContext";

export function AccountingScreen({ onBack }) {
  const { profile } = useAuth();
  
  // Need to read initial dev_mode_enabled from profile or fetch it.
  // Actually, we don't have it in profile directly unless we added it.
  // We'll maintain local state, assuming it starts false or true based on some fetch.
  // We'll assume we start by fetching dev mode status (from /accounts/me or a new endpoint? 
  // Let's just track it locally for the demo and assume it's initially false, or toggle it and optimistically update)
  const [devMode, setDevMode] = useState(false);
  const [activeTab, setActiveTab] = useState("journal");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
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

  useEffect(() => {
    if (devMode) {
      fetchData(activeTab);
    }
  }, [devMode, activeTab]);

  const fetchData = async (tab) => {
    try {
      if (tab === "journal") {
        const data = await AccountingAPI.getJournal();
        setJournal(data);
      } else if (tab === "general") {
        const coaData = await AccountingAPI.getChartOfAccounts();
        setCoas(coaData);
        if (coaData.length > 0 && !selectedCoa) {
          setSelectedCoa(coaData[0].id);
        }
      } else if (tab === "trial") {
        const data = await AccountingAPI.getTrialBalance();
        setTrialBalance(data);
      } else if (tab === "compliance") {
        const data = await AccountingAPI.getGstReport();
        setGstReport(data);
      } else if (tab === "invoices") {
        const data = await AccountingAPI.getInvoices();
        setInvoices(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === "general" && selectedCoa) {
      AccountingAPI.getLedger(selectedCoa).then(setGeneralLedger).catch(console.error);
    }
  }, [selectedCoa, activeTab]);

  useEffect(() => {
    if (activeTab === "payee" && selectedPayee) {
      AccountingAPI.getPayeeLedger(selectedPayee).then(setPayeeLedger).catch(console.error);
    }
  }, [selectedPayee, activeTab]);

  const toggleDevMode = async () => {
    const next = !devMode;
    setDevMode(next);
    try {
      await AccountingAPI.toggleDevMode(next);
    } catch (e) {
      setDevMode(!next);
    }
  };

  const handleDownload = async () => {
    setError(""); setSuccess(false); setDownloading(true);
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: "full_accounting_pack",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RenoPay_Accounting_Pack.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to generate report. Try again.");
    } finally {
      setDownloading(false);
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
            {/* Download Button */}
            {error && (
              <p className="text-danger text-xs text-center bg-danger/5 border border-danger/20 rounded-xl px-4 py-2.5">{error}</p>
            )}
            {success && (
              <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 text-center">
                <p className="text-success font-semibold text-sm">✅ Full Accounting Pack Downloaded!</p>
              </div>
            )}
            <Btn onClick={handleDownload} disabled={downloading} variant="gold">
              {downloading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Generating PDF…
                </span>
              ) : (
                "Generate Full Accounting Report (PDF)"
              )}
            </Btn>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2 no-scrollbar">
              {["journal", "general", "payee", "trial", "compliance", "invoices"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors
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
                <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-4 uppercase">Journal Entries</h3>
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
                  {journal.length === 0 && <p className="text-muted text-center text-xs py-4">No entries found.</p>}
                </div>
              </Card>
            )}

            {activeTab === "general" && (
              <Card className="p-4">
                <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-3 uppercase">General Ledger</h3>
                <select 
                  className="w-full bg-surf border border-line rounded-xl p-3 text-sm text-text mb-4 outline-none focus:border-accent"
                  value={selectedCoa || ""}
                  onChange={(e) => setSelectedCoa(e.target.value)}
                >
                  {coas.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>

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
                <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-3 uppercase">Payee Ledger</h3>
                <input
                  type="text"
                  placeholder="Enter Payee VPA (e.g. food@renopay)"
                  className="w-full bg-surf border border-line rounded-xl p-3 text-sm text-text mb-4 outline-none focus:border-accent"
                  value={selectedPayee}
                  onChange={(e) => setSelectedPayee(e.target.value)}
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
                  <p className="text-muted text-center text-xs py-4">No transactions found for this payee.</p>
                )}
              </Card>
            )}

            {activeTab === "trial" && trialBalance && (
              <Card className="p-4">
                <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-1 uppercase">Trial Balance</h3>
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
              </Card>
            )}

            {activeTab === "compliance" && (
              <div className="flex flex-col gap-4">
                <Card className="p-4">
                  <h3 className="text-[12px] font-bold text-textLight tracking-wider mb-4 uppercase">Estimated GST Report</h3>
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
    </div>
  );
}
