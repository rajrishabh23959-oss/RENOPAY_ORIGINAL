import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { FinancialServices } from "../lib/financialServices";
import { PaymentAPI, FinancialAPI } from "../lib/api";
import { fmt } from "../lib/format";
import { Card, Btn, Badge } from "../components/ui";
import { PaymentMethodModal } from "../components/PaymentMethodModal";

function calcEmi(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  const monthlyRate = annualRate / 12 / 100;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(emi);
}

export function LoansScreen({ onBack, onNavigate, initialTab = "personal" }) {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // "personal" | "mutual" | "gold" | "credit" | "myloans"

  // Personal Loan State
  const [personalAmount, setPersonalAmount] = useState(75000);
  const [personalTenure, setPersonalTenure] = useState(12);
  const [personalLender, setPersonalLender] = useState("HDFC Bank & RenoPay Credit");
  const personalRate = 11.5;

  // Mutual Funds Loan State
  const [mfLoanAmount, setMfLoanAmount] = useState(50000);
  const [mfTenure, setMfTenure] = useState(12);
  const mfRate = 9.25;

  // Gold Loan State
  const [goldLoanAmount, setGoldLoanAmount] = useState(30000);
  const [goldTenure, setGoldTenure] = useState(6);
  const goldRate = 9.0; // 0.75% per month

  // Active Loans from store
  const [activeLoans, setActiveLoans] = useState([]);

  // Disbursal / Repay Modal State
  const [modalMode, setModalMode] = useState(null); // "apply" | "repay" | null
  const [selectedLoanForRepay, setSelectedLoanForRepay] = useState(null);
  const [pendingLoanData, setPendingLoanData] = useState(null);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState(null);

  const loadLoans = async () => {
    try {
      const backendLoans = await FinancialAPI.getLoans();
      if (backendLoans && backendLoans.length > 0) {
        setActiveLoans(backendLoans);
        return;
      }
    } catch (_) {}
    setActiveLoans(FinancialServices.getLoans());
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const handleDownloadReceipt = async (txnRef) => {
    if (!txnRef) return;
    try {
      const blob = await FinancialAPI.getReceiptPdf(txnRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt_${txnRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download PDF receipt: " + (e?.response?.data?.detail || e.message));
    }
  };

  // Personal EMI calculation
  const personalEmi = useMemo(
    () => calcEmi(personalAmount, personalRate, personalTenure),
    [personalAmount, personalRate, personalTenure]
  );
  const personalTotalPay = personalEmi * personalTenure;
  const personalInterest = personalTotalPay - personalAmount;

  // MF EMI calculation
  const mfEmi = useMemo(
    () => calcEmi(mfLoanAmount, mfRate, mfTenure),
    [mfLoanAmount, mfRate, mfTenure]
  );

  // Gold EMI calculation
  const goldEmi = useMemo(
    () => calcEmi(goldLoanAmount, goldRate, goldTenure),
    [goldLoanAmount, goldRate, goldTenure]
  );

  // Initiate Application Modal
  const openApplyModal = (type, lender, principal, tenureMonths, rate, emi) => {
    setPendingLoanData({
      type,
      lender,
      principal,
      tenureMonths,
      interestRate: rate,
      monthlyEmi: emi,
    });
    setModalMode("apply");
    setPin("");
    setModalError("");
  };

  // Initiate Repayment Modal
  const openRepayModal = (loan) => {
    setSelectedLoanForRepay(loan);
    setModalMode("repay");
    setPin("");
    setModalError("");
  };

  // Submit Loan Disbursal (Credit into main account balance)
  const handleConfirmDisbursal = async () => {
    if (profile?.has_upi_pin && !pin) {
      setModalError("Please enter your 6-digit UPI PIN");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      const createdLoan = await FinancialAPI.applyLoan({
        loan_type: pendingLoanData.type,
        lender: pendingLoanData.lender,
        principal: pendingLoanData.principal,
        tenure_months: pendingLoanData.tenureMonths,
        interest_rate: pendingLoanData.interestRate,
        monthly_emi: pendingLoanData.monthlyEmi,
        pin: pin || undefined,
      });

      // Update local storage store
      FinancialServices.applyLoan(pendingLoanData);

      await refreshProfile?.();
      await loadLoans();

      setModalMode(null);
      setSuccessMessage({
        title: "Loan Approved & Disbursed! 🎉",
        message: `${fmt(createdLoan.principal)} has been credited instantly to your RenoPay wallet balance.`,
        note: `Your monthly EMI of ${fmt(createdLoan.monthlyEmi)} is due on ${createdLoan.nextDueDate}. Txn Ref: ${createdLoan.disbursalTxnRef}`,
        txnRef: createdLoan.disbursalTxnRef,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "Loan disbursal failed";
      setModalError(typeof msg === "object" ? msg.message || JSON.stringify(msg) : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit EMI Repayment (Debit from main account balance)
  const handleConfirmRepay = async (enteredPin, payMode = "normal") => {
    if (!selectedLoanForRepay) return;

    if (profile?.has_upi_pin && !enteredPin) {
      setModalError("Please enter your 6-digit UPI PIN");
      return;
    }

    const emi = selectedLoanForRepay.monthlyEmi;
    if ((profile?.account?.balance ?? 0) < emi) {
      setModalError("Insufficient wallet balance to pay this EMI. Please add money.");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      const res = await FinancialAPI.repayLoan({
        loan_code: selectedLoanForRepay.loan_code || selectedLoanForRepay.id,
        amount: emi,
        pin: enteredPin || undefined,
      });

      // Automatically decrease remaining loan balance in store
      const updatedLoan = FinancialServices.repayLoanEmi(selectedLoanForRepay.id);

      await refreshProfile?.();
      await loadLoans();

      setModalMode(null);
      setSuccessMessage({
        title: "EMI Payment Successful! ✅",
        message: `Paid ${fmt(emi)} towards ${selectedLoanForRepay.type} (${selectedLoanForRepay.loan_code || selectedLoanForRepay.id}).`,
        note: `Remaining balance reduced to ${fmt(res.remaining_amount ?? (updatedLoan?.remainingAmount || 0))}.`,
        txnRef: res.txn_ref,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "EMI payment failed";
      setModalError(typeof msg === "object" ? msg.message || JSON.stringify(msg) : msg);

    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px] text-textLight">
      {/* Top Header */}
      <div className="px-[22px] pt-[46px] pb-[16px] flex items-center justify-between border-b border-line bg-surf/60 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-card border border-line flex items-center justify-center text-textLight hover:border-accent/40 active:scale-95 transition-all"
            title="Go back"
          >
            ←
          </button>
          <div>
            <h2 className="text-[19px] font-extrabold text-textLight leading-tight">Loans & Credit</h2>
            <p className="text-[11px] text-muted">Pre-approved credit & Instant Wallet Disbursals</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("myloans")}
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "myloans"
              ? "bg-accent text-white border-accent shadow-accentGlow"
              : "bg-card border-line text-muted hover:text-textLight"
          }`}
        >
          <span>📜</span>
          <span>My Loans</span>
          {activeLoans.filter((l) => l.status === "ACTIVE").length > 0 && (
            <span className="w-4 h-4 rounded-full bg-white text-accent flex items-center justify-center text-[9px] font-extrabold ml-0.5">
              {activeLoans.filter((l) => l.status === "ACTIVE").length}
            </span>
          )}
        </button>
      </div>

      <div className="px-[20px] pt-3">
        {/* Navigation Tabs (Personal, MF, Gold, Credit Score, My Loans) */}
        <div className="grid grid-cols-5 gap-1 mb-4 bg-card p-1 rounded-2xl border border-line text-center">
          {[
            { key: "personal", label: "Personal", icon: "💼" },
            { key: "mutual", label: "MF Loan", icon: "📊" },
            { key: "gold", label: "Gold Loan", icon: "🪙" },
            { key: "credit", label: "Credit Score", icon: "🎯" },
            { key: "myloans", label: "Active EMIs", icon: "💳" },
          ].map((tab) => {
            const isSel = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSuccessMessage(null);
                }}
                className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isSel ? "bg-accent text-white shadow-accentGlow scale-[1.02]" : "text-muted hover:text-textLight"
                }`}
              >
                <span className="text-base mb-0.5">{tab.icon}</span>
                <span className={`text-[10px] font-bold truncate max-w-[60px] ${isSel ? "text-white" : ""}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 animate-fadeUp">
            <h4 className="font-extrabold text-sm mb-1">{successMessage.title}</h4>
            <p className="text-xs text-textLight">{successMessage.message}</p>
            <p className="text-[11px] text-muted mt-1.5">{successMessage.note}</p>
            {successMessage.txnRef && (
              <div className="mt-3 pt-2.5 border-t border-emerald-500/30 flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400">Ref: {successMessage.txnRef}</span>
                <button
                  type="button"
                  onClick={() => handleDownloadReceipt(successMessage.txnRef)}
                  className="px-3 py-1.5 rounded-xl bg-accent text-white text-[11px] font-extrabold hover:opacity-90 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>📥</span> Download PDF Receipt
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 1: PERSONAL LOAN ===================== */}
        {activeTab === "personal" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  <span>💼</span> Instant Personal Loan
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  Pre-Approved: ₹5,00,000
                </span>
              </div>

              {/* Partner Lenders */}
              <div className="mb-4">
                <label className="text-[10px] uppercase font-bold text-muted block mb-1.5">Selected Lending Partner</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "HDFC Bank & RenoPay Credit",
                    "Bajaj Finserv Direct",
                    "Tata Capital Premier",
                    "ICICI Bank Personal",
                  ].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPersonalLender(p)}
                      className={`p-2 rounded-xl text-left border text-xs font-semibold transition-all cursor-pointer ${
                        personalLender === p
                          ? "bg-accent/15 border-accent text-accent font-bold"
                          : "bg-surf border-line text-muted hover:text-textLight"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loan Amount Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-muted">Borrow Amount</span>
                  <span className="text-lg font-extrabold font-mono text-accent">{fmt(personalAmount)}</span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={500000}
                  step={5000}
                  value={personalAmount}
                  onChange={(e) => setPersonalAmount(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-muted font-bold mt-1">
                  <span>₹10,000</span>
                  <span>₹2,50,000</span>
                  <span>₹5,00,000</span>
                </div>
              </div>

              {/* Tenure Picker */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-muted">Repayment Tenure</span>
                  <span className="text-xs font-bold text-textLight">{personalTenure} Months</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[6, 12, 18, 24, 36].map((months) => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => setPersonalTenure(months)}
                      className={`py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        personalTenure === months
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-surf border-line text-muted hover:text-textLight"
                      }`}
                    >
                      {months}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Box */}
              <div className="p-3.5 rounded-2xl bg-surf border border-line space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Monthly EMI</span>
                  <span className="text-base font-extrabold font-mono text-textLight">{fmt(personalEmi)} / mo</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Annual Interest Rate</span>
                  <span className="font-bold text-emerald-400">{personalRate}% p.a.</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Total Interest Payable</span>
                  <span className="font-bold text-muted font-mono">{fmt(personalInterest)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Processing Fee</span>
                  <span className="text-emerald-400 font-bold">₹0 (Waived)</span>
                </div>
              </div>

              <Btn
                variant="primary"
                className="w-full py-3 text-sm font-extrabold flex items-center justify-center gap-2"
                onClick={() =>
                  openApplyModal(
                    "Personal Loan",
                    personalLender,
                    personalAmount,
                    personalTenure,
                    personalRate,
                    personalEmi
                  )
                }
              >
                <span>⚡</span>
                <span>Apply & Instant Disburse to Wallet</span>
              </Btn>
            </Card>

            {/* Highlights */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-card border border-line">
                <p className="text-base mb-1">⏱️</p>
                <p className="text-[11px] font-bold text-textLight">Under 60s</p>
                <p className="text-[9px] text-muted">Wallet Disbursal</p>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-line">
                <p className="text-base mb-1">📄</p>
                <p className="text-[11px] font-bold text-textLight">100% Paperless</p>
                <p className="text-[9px] text-muted">Zero branch visit</p>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-line">
                <p className="text-base mb-1">🛡️</p>
                <p className="text-[11px] font-bold text-textLight">No Foreclosure</p>
                <p className="text-[9px] text-muted">Penalty-free</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: MUTUAL FUNDS LOAN ===================== */}
        {activeTab === "mutual" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📊</span> Loan Against Mutual Funds
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                  9.25% p.a.
                </span>
              </div>

              <p className="text-xs text-muted mb-4">
                Don&apos;t sell your high-compounding mutual fund units. Pledge units digitally and get instant liquid funds credited straight to your wallet.
              </p>

              {/* Amount Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-muted">Pledge Credit Amount</span>
                  <span className="text-lg font-extrabold font-mono text-blue-400">{fmt(mfLoanAmount)}</span>
                </div>
                <input
                  type="range"
                  min={15000}
                  max={250000}
                  step={5000}
                  value={mfLoanAmount}
                  onChange={(e) => setMfLoanAmount(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Summary */}
              <div className="p-3.5 rounded-2xl bg-surf border border-line space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Estimated Monthly Interest / EMI</span>
                  <span className="text-base font-extrabold font-mono text-textLight">{fmt(mfEmi)} / mo</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">LTV (Loan to Value)</span>
                  <span className="font-bold text-emerald-400">Up to 75% of Equity NAV</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Portfolio Dividends</span>
                  <span className="font-bold text-textLight">Retained by you 100%</span>
                </div>
              </div>

              <Btn
                variant="teal"
                className="w-full py-3 text-sm font-extrabold flex items-center justify-center gap-2"
                onClick={() =>
                  openApplyModal(
                    "Mutual Funds Loan",
                    "RenoPay Securities & Mirae Asset",
                    mfLoanAmount,
                    mfTenure,
                    mfRate,
                    mfEmi
                  )
                }
              >
                <span>⚡</span>
                <span>Pledge Units & Disburse to Wallet</span>
              </Btn>
            </Card>
          </div>
        )}

        {/* ===================== TAB 3: GOLD LOAN ===================== */}
        {activeTab === "gold" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🪙</span> Instant Digital Gold Loan
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  0.75% / month
                </span>
              </div>

              <p className="text-xs text-muted mb-4">
                Borrow instantly against 24K 99.9% pure digital gold stored safely in your RenoPay Vault. Zero credit score check needed.
              </p>

              {/* Amount Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-muted">Borrow Against Gold</span>
                  <span className="text-lg font-extrabold font-mono text-amber-400">{fmt(goldLoanAmount)}</span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={150000}
                  step={2000}
                  value={goldLoanAmount}
                  onChange={(e) => setGoldLoanAmount(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Summary */}
              <div className="p-3.5 rounded-2xl bg-surf border border-line space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Monthly Interest</span>
                  <span className="text-base font-extrabold font-mono text-textLight">{fmt(goldEmi)} / mo</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Gold Security</span>
                  <span className="font-bold text-amber-400">Insured in Brinks Vault</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Repayment Flexibility</span>
                  <span className="font-bold text-textLight">Pay interest only / bullet principal</span>
                </div>
              </div>

              <Btn
                variant="primary"
                className="w-full py-3 text-sm font-extrabold flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
                onClick={() =>
                  openApplyModal(
                    "Gold Loan",
                    "RenoPay Bullion & Muthoot Vault",
                    goldLoanAmount,
                    goldTenure,
                    goldRate,
                    goldEmi
                  )
                }
              >
                <span>🪙</span>
                <span>Get Instant Gold Loan to Wallet</span>
              </Btn>
            </Card>
          </div>
        )}

        {/* ===================== TAB 4: CREDIT SCORE ===================== */}
        {activeTab === "credit" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-5 border-line text-center">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                Official Credit Health Report
              </span>

              {/* Gauge Meter */}
              <div className="relative w-44 h-44 mx-auto my-2 flex flex-col items-center justify-center rounded-full border-4 border-emerald-500/30 bg-emerald-500/[0.04]">
                <span className="text-4xl font-extrabold font-mono text-emerald-400">782</span>
                <span className="text-xs font-extrabold text-textLight uppercase tracking-wider mt-1">Excellent</span>
                <span className="text-[10px] text-muted mt-0.5">Experian &bull; Updated Today</span>
              </div>

              <p className="text-xs text-muted max-w-[280px] mx-auto mt-2">
                You qualify for pre-approved personal loans up to ₹5,00,000 at prime interest rates.
              </p>
            </Card>

            {/* Credit Factors Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-bold text-muted">On-Time Payments</span>
                <p className="text-base font-extrabold text-emerald-400 mt-1">100%</p>
                <p className="text-[10px] text-muted">Zero late marks</p>
              </div>
              <div className="p-3 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-bold text-muted">Credit Utilization</span>
                <p className="text-base font-extrabold text-emerald-400 mt-1">14%</p>
                <p className="text-[10px] text-muted">Ideal (&lt; 30%)</p>
              </div>
              <div className="p-3 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-bold text-muted">Credit Age</span>
                <p className="text-base font-extrabold text-textLight mt-1">4.5 Years</p>
                <p className="text-[10px] text-muted">Healthy history</p>
              </div>
              <div className="p-3 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-bold text-muted">Active Credit Lines</span>
                <p className="text-base font-extrabold text-textLight mt-1">3 Accounts</p>
                <p className="text-[10px] text-muted">Diversified mix</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 5: MY LOANS & ACTIVE EMIS ===================== */}
        {activeTab === "myloans" && (
          <div className="space-y-4 animate-fadeUp">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                My Active Loans & Repayment ({activeLoans.length})
              </h3>
              <button
                type="button"
                onClick={() => onNavigate?.("recharge", { tab: "loan" })}
                className="text-[11px] text-accent font-bold hover:underline"
              >
                Go to Bills ➔
              </button>
            </div>

            {activeLoans.length === 0 ? (
              <Card className="p-6 text-center border-line">
                <span className="text-3xl mb-2 block">🎉</span>
                <h4 className="font-extrabold text-sm text-textLight">No Active Loans</h4>
                <p className="text-xs text-muted mt-1">
                  You have no outstanding debts or dues. Apply for a pre-approved personal loan in under 60 seconds!
                </p>
                <Btn
                  variant="primary"
                  className="mt-4 py-2 px-4 text-xs font-bold"
                  onClick={() => setActiveTab("personal")}
                >
                  Apply Personal Loan
                </Btn>
              </Card>
            ) : (
              activeLoans.map((loan) => {
                const isClosed = loan.status === "CLOSED" || loan.remainingAmount <= 0;
                const paidPct = Math.round(
                  ((loan.principal - loan.remainingAmount) / loan.principal) * 100
                );

                return (
                  <Card key={loan.id} className="p-4 border-line hover:border-accent/40 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-textLight">{loan.type}</span>
                          <Badge color={isClosed ? "#22C55E" : "#FF6A1A"} size={9}>
                            {loan.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted font-mono">{loan.id} &bull; {loan.lender}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold font-mono text-accent">{fmt(loan.monthlyEmi)}</p>
                        <p className="text-[9px] text-muted">Monthly EMI</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="my-2.5">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted">Repayment Progress</span>
                        <span className="font-bold text-textLight">{paidPct}% paid</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surf overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, paidPct))}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-y border-line/40 text-xs my-2">
                      <div>
                        <span className="text-[10px] text-muted block">Remaining Principal</span>
                        <span className="font-bold text-textLight font-mono">
                          {isClosed ? "₹0 (Fully Paid)" : fmt(loan.remainingAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted block">Next Due Date</span>
                        <span className="font-bold text-textLight">
                          {isClosed ? "N/A" : loan.nextDueDate}
                        </span>
                      </div>
                    </div>

                    {!isClosed && (
                      <div className="flex items-center justify-between mt-3 pt-1">
                        <span className="text-[10px] text-muted">EMIs Paid: {loan.emisPaid || 0} / {loan.tenureMonths}</span>
                        <Btn
                          variant="teal"
                          className="py-1.5 px-4 text-xs font-bold"
                          onClick={() => openRepayModal(loan)}
                        >
                          Pay Monthly EMI ({fmt(loan.monthlyEmi)})
                        </Btn>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Repay EMI Modal (Normal Pay vs Advance Pay) */}
      <PaymentMethodModal
        isOpen={modalMode === "repay" && !!selectedLoanForRepay}
        onClose={() => {
          setModalMode(null);
          setModalError("");
        }}
        title="Pay Monthly EMI"
        subtitle={`${selectedLoanForRepay?.type} • Loan ID: ${selectedLoanForRepay?.loan_code || selectedLoanForRepay?.id}`}
        amount={selectedLoanForRepay?.monthlyEmi || 0}
        recipient={selectedLoanForRepay?.lender || "RenoPay Capital"}
        accountBalance={profile?.account?.balance ?? 0}
        onAddMoney={() => {
          setModalMode(null);
          onNavigate?.("addmoney");
        }}
        onConfirm={async (enteredPin, mode) => {
          await handleConfirmRepay(enteredPin, mode);
        }}
        loading={submitting}
        error={modalError}
      />

      {/* Loan Disbursal Authorization Modal */}
      {modalMode === "apply" && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-card border border-line rounded-3xl p-5 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto scrollbar-none">
            <div className="flex items-start justify-between mb-2 pb-1 border-b border-line/40">
              <div className="pr-2">
                <h3 className="text-base font-extrabold text-textLight leading-snug">
                  Confirm Loan Disbursal
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Disbursing {fmt(pendingLoanData?.principal || 0)} into RenoPay Wallet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="w-7 h-7 rounded-full bg-surf flex items-center justify-center text-muted hover:text-white cursor-pointer text-xs shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs mb-3 font-semibold">
                {modalError}
              </div>
            )}

            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-muted block mb-1">Enter 6-digit UPI PIN</label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest text-textLight font-extrabold outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-line text-xs font-bold text-muted hover:text-textLight transition-colors"
              >
                Cancel
              </button>
              <Btn
                variant="primary"
                disabled={submitting}
                className="flex-1 py-2.5 text-xs font-extrabold"
                onClick={handleConfirmDisbursal}
              >
                {submitting ? "Processing..." : "Confirm & Disburse"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
