import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { FinancialServices } from "../lib/financialServices";
import { PaymentAPI, FinancialAPI } from "../lib/api";
import { fmt } from "../lib/format";
import { Card, Btn, Badge } from "../components/ui";
import { PaymentMethodModal } from "../components/PaymentMethodModal";

const BEST_SIP_FUNDS = [
  {
    id: "F1",
    name: "Parag Parikh Flexi Cap Fund",
    category: "Flexi Cap &bull; 5★ Value Research",
    cagr3Y: "24.8%",
    cagr5Y: "22.4%",
    minSip: 500,
    aum: "₹68,400 Cr",
    risk: "Very High",
    tag: "Top Pick",
  },
  {
    id: "F2",
    name: "Mirae Asset Large Cap Fund",
    category: "Large Cap &bull; Consistent Alpha",
    cagr3Y: "18.2%",
    cagr5Y: "17.9%",
    minSip: 1000,
    aum: "₹38,200 Cr",
    risk: "Very High",
    tag: "Stable Growth",
  },
  {
    id: "F3",
    name: "Quant Small Cap Fund",
    category: "Small Cap &bull; High Momentum",
    cagr3Y: "36.4%",
    cagr5Y: "32.1%",
    minSip: 1000,
    aum: "₹18,900 Cr",
    risk: "Very High",
    tag: "High Alpha",
  },
  {
    id: "F4",
    name: "HDFC Balanced Advantage Fund",
    category: "Hybrid Dynamic Asset Allocation",
    cagr3Y: "19.5%",
    cagr5Y: "16.8%",
    minSip: 500,
    aum: "₹82,100 Cr",
    risk: "Moderate High",
    tag: "Low Volatility",
  },
  {
    id: "F5",
    name: "Tata Digital India Fund",
    category: "Sectoral &bull; Tech & AI Growth",
    cagr3Y: "21.0%",
    cagr5Y: "24.5%",
    minSip: 500,
    aum: "₹9,500 Cr",
    risk: "Very High",
    tag: "Theme Focus",
  },
];

const HIGH_GROWTH_FUNDS = [
  {
    id: "G1",
    name: "Quant Active Fund",
    category: "Multi Cap &bull; Dynamic Momentum",
    cagr3Y: "38.4%",
    cagr1Y: "44.2%",
    minSip: 1000,
    risk: "Aggressive",
    tag: "Momentum Alpha",
  },
  {
    id: "G2",
    name: "Tata Digital India Fund",
    category: "Thematic &bull; Tech & AI Growth",
    cagr3Y: "29.6%",
    cagr1Y: "38.1%",
    minSip: 500,
    risk: "Sector Focused",
    tag: "Tech & AI",
  },
  {
    id: "G3",
    name: "Motilal Oswal Midcap Fund",
    category: "Mid Cap &bull; High Conviction",
    cagr3Y: "34.2%",
    cagr1Y: "41.5%",
    minSip: 1000,
    risk: "High",
    tag: "Midcap Star",
  },
];

export function MutualFundsScreen({ onBack, onNavigate, initialTab = "bestsip" }) {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // "bestsip" | "growth" | "dailyrd" | "dailysip10" | "portfolio"

  // SIP Calculator State
  const [calcMonthly, setCalcMonthly] = useState(5000);
  const [calcTenureYears, setCalcTenureYears] = useState(10);
  const [assumedRate, setAssumedRate] = useState(14); // 14% p.a. expected CAGR

  // Daily RD State
  const [rdDaily, setRdDaily] = useState(100);
  const [rdTenureMonths, setRdTenureMonths] = useState(6);
  const rdInterestRate = 8.1; // 8.1% p.a. guaranteed

  // Investments from Store
  const [portfolio, setPortfolio] = useState(FinancialServices.getInvestments());

  // Investment Modal State
  const [investModal, setInvestModal] = useState(null); // { type, title, fundName, amount, isDaily, onConfirm }
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [successBanner, setSuccessBanner] = useState(null);

  const loadData = async () => {
    try {
      const backendInvestments = await FinancialAPI.getInvestments();
      if (backendInvestments && backendInvestments.length > 0) {
        const totalInvested = backendInvestments.reduce((sum, item) => sum + (item.invested_amount || 0), 0);
        const currentValue = backendInvestments.reduce((sum, item) => sum + (item.current_value || 0), 0);
        const overallGain = Math.max(0, currentValue - totalInvested);
        const gainPercent = totalInvested > 0 ? Number(((overallGain / totalInvested) * 100).toFixed(1)) : 0;
        setPortfolio({
          totalInvested,
          currentValue,
          overallGain,
          gainPercent,
          sips: backendInvestments.filter((i) => i.type === "sip" || i.type === "daily_sip"),
          rds: backendInvestments.filter((i) => i.type === "daily_rd"),
        });
        return;
      }
    } catch (_) {}
    setPortfolio(FinancialServices.getInvestments());
  };

  useEffect(() => {
    loadData();
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

  // Future SIP Value calculation
  const sipCalculation = useMemo(() => {
    const P = calcMonthly;
    const n = calcTenureYears * 12;
    const i = assumedRate / 12 / 100;
    const invested = P * n;
    const futureVal = Math.round((P * (Math.pow(1 + i, n) - 1) * (1 + i)) / i);
    const gains = futureVal - invested;
    return { invested, futureVal, gains };
  }, [calcMonthly, calcTenureYears, assumedRate]);

  // Daily RD calculation
  const rdCalculation = useMemo(() => {
    const days = rdTenureMonths * 30;
    const totalDeposited = rdDaily * days;
    const interest = Math.round(totalDeposited * (rdInterestRate / 100) * (rdTenureMonths / 12));
    const maturity = totalDeposited + interest;
    return { totalDeposited, interest, maturity };
  }, [rdDaily, rdTenureMonths]);

  // Start Monthly SIP Modal Trigger
  const handleTriggerSip = (fund) => {
    setInvestModal({
      type: "monthly_sip",
      title: "Start Monthly SIP",
      fundName: fund.name,
      amount: fund.minSip,
      category: fund.category,
      recipient: fund.name,
      onConfirm: async (enteredPin) => {
        const res = await FinancialAPI.invest({
          investment_type: "sip",
          fund_name: fund.name,
          category: fund.category,
          amount: fund.minSip,
          pin: enteredPin || undefined,
        });

        FinancialServices.startSip({
          fundName: fund.name,
          category: fund.category,
          monthlyAmount: fund.minSip,
          sipDay: 5,
        });

        await refreshProfile?.();
        await loadData();
        setInvestModal(null);
        setSuccessBanner({
          title: "SIP Started Successfully! 📈",
          message: `Your monthly SIP of ${fmt(fund.minSip)} in ${fund.name} is now active. Units will be allotted within 1 working day.`,
          txnRef: res.txn_ref,
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Start Daily SIP ₹10 Trigger
  const handleTriggerDailySip10 = () => {
    setInvestModal({
      type: "daily_sip_10",
      title: "Start Daily ₹10 Micro SIP",
      fundName: "Nifty 50 Index Micro Fund",
      amount: 10,
      isDaily: true,
      recipient: "Nifty 50 Index Fund",
      onConfirm: async (enteredPin) => {
        const res = await FinancialAPI.invest({
          investment_type: "daily_sip",
          fund_name: "Nifty 50 Index Micro Fund",
          category: "Daily SIP ₹10",
          amount: 10,
          pin: enteredPin || undefined,
        });

        FinancialServices.startDailySip10({
          fundName: "Nifty 50 Index Micro Fund",
        });

        await refreshProfile?.();
        await loadData();
        setInvestModal(null);
        setSuccessBanner({
          title: "Daily ₹10 SIP Activated! ☕➔💰",
          message: "₹10 will be invested daily into India's Top 50 Index. Watch your small daily habits compound into lakhs!",
          txnRef: res.txn_ref,
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Start Daily RD Trigger
  const handleTriggerDailyRd = () => {
    setInvestModal({
      type: "daily_rd",
      title: "Start Daily Recurring Deposit",
      fundName: `RenoPay Virtual Bank (${rdInterestRate}% p.a.)`,
      amount: rdDaily,
      isDaily: true,
      recipient: "RenoPay Virtual Bank",
      onConfirm: async (enteredPin) => {
        const res = await FinancialAPI.invest({
          investment_type: "daily_rd",
          fund_name: `RenoPay Virtual Bank (${rdInterestRate}% p.a.)`,
          category: "Recurring Deposit",
          amount: rdDaily,
          tenure_months: rdTenureMonths,
          interest_rate: rdInterestRate,
          pin: enteredPin || undefined,
        });

        FinancialServices.startDailyRd({
          dailyAmount: rdDaily,
          tenureMonths: rdTenureMonths,
          rate: rdInterestRate,
        });

        await refreshProfile?.();
        await loadData();
        setInvestModal(null);
        setSuccessBanner({
          title: "Daily RD Started! 🏦",
          message: `Depositing ${fmt(rdDaily)} daily for ${rdTenureMonths} months. Guaranteed Maturity: ${fmt(rdCalculation.maturity)}!`,
          txnRef: res.txn_ref,
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Execute Invest Submission
  const handleConfirmInvestment = async (enteredPin, payMode = "normal") => {
    if (profile?.has_upi_pin && !enteredPin) {
      setModalError("Please enter your 6-digit UPI PIN");
      return;
    }

    if ((profile?.account?.balance ?? 0) < (investModal?.amount || 0)) {
      setModalError("Insufficient wallet balance. Please add money to RenoPay wallet.");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      if (investModal?.onConfirm) {
        await investModal.onConfirm(enteredPin, payMode);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "Investment initiation failed";
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
            <h2 className="text-[19px] font-extrabold text-textLight leading-tight">Mutual Funds & RD</h2>
            <p className="text-[11px] text-muted">Wealth creation, micro-SIPs & guaranteed bank RDs</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("portfolio")}
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "portfolio"
              ? "bg-accent text-white border-accent shadow-accentGlow"
              : "bg-card border-line text-muted hover:text-textLight"
          }`}
        >
          <span>💼</span>
          <span>Portfolio</span>
        </button>
      </div>

      <div className="px-[20px] pt-3">
        {/* Navigation Tabs (Best SIPs, High Growth, Daily RD, Daily SIP ₹10, Portfolio) */}
        <div className="grid grid-cols-5 gap-1 mb-4 bg-card p-1 rounded-2xl border border-line text-center">
          {[
            { key: "bestsip", label: "Best SIPs", icon: "⭐" },
            { key: "growth", label: "Growth", icon: "🚀" },
            { key: "dailyrd", label: "Daily RD", icon: "🏦" },
            { key: "dailysip10", label: "₹10 SIP", icon: "☕" },
            { key: "portfolio", label: "Portfolio", icon: "📈" },
          ].map((tab) => {
            const isSel = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSuccessBanner(null);
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
        {successBanner && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 animate-fadeUp">
            <h4 className="font-extrabold text-sm mb-1">{successBanner.title}</h4>
            <p className="text-xs text-textLight">{successBanner.message}</p>
            {successBanner.txnRef && (
              <div className="mt-3 pt-2.5 border-t border-emerald-500/30 flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400">Ref: {successBanner.txnRef}</span>
                <button
                  type="button"
                  onClick={() => handleDownloadReceipt(successBanner.txnRef)}
                  className="px-3 py-1.5 rounded-xl bg-accent text-white text-[11px] font-extrabold hover:opacity-90 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>📥</span> Download PDF Receipt
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 1: BEST SIP FUNDS ===================== */}
        {activeTab === "bestsip" && (
          <div className="space-y-4 animate-fadeUp">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                ⭐ Top 5★ Rated Mutual Funds
              </span>
              <span className="text-[10px] text-muted">Direct Plans &bull; 0% Commission</span>
            </div>

            <div className="space-y-3">
              {BEST_SIP_FUNDS.map((f) => (
                <Card key={f.id} className="p-4 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-textLight">{f.name}</h4>
                        <Badge color="#22C55E" size={9}>{f.tag}</Badge>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{f.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold font-mono text-emerald-400">{f.cagr3Y}</p>
                      <p className="text-[9px] text-muted">3-Year CAGR</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-line/40 text-xs my-2">
                    <div>
                      <span className="text-[10px] text-muted block">Min SIP</span>
                      <span className="font-bold text-textLight font-mono">{fmt(f.minSip)}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted block">5Y CAGR</span>
                      <span className="font-bold text-emerald-400">{f.cagr5Y}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted block">AUM</span>
                      <span className="font-bold text-textLight">{f.aum}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-[10px] text-muted">Risk: {f.risk}</span>
                    <Btn
                      variant="primary"
                      className="py-1.5 px-4 text-xs font-bold"
                      onClick={() => handleTriggerSip(f)}
                    >
                      Start SIP ({fmt(f.minSip)})
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>

            {/* SIP Returns Calculator Card */}
            <Card className="p-4 border-line bg-gradient-to-br from-card to-surf">
              <span className="text-xs font-bold text-accent uppercase tracking-wider block mb-2">
                📊 SIP Compounding Calculator
              </span>
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-muted">Monthly Investment</span>
                  <span className="text-sm font-extrabold font-mono text-textLight">{fmt(calcMonthly)} / mo</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={25000}
                  step={500}
                  value={calcMonthly}
                  onChange={(e) => setCalcMonthly(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-muted">Time Horizon</span>
                  <span className="text-sm font-bold text-textLight">{calcTenureYears} Years</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 3, 5, 10].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setCalcTenureYears(y)}
                      className={`py-1 rounded-xl border text-xs font-bold transition-all ${
                        calcTenureYears === y
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-surf border-line text-muted"
                      }`}
                    >
                      {y} Yrs
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-surf border border-line space-y-1.5 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Total Amount Invested</span>
                  <span className="font-mono font-bold text-textLight">{fmt(sipCalculation.invested)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Estimated Wealth Gain (@15%)</span>
                  <span className="font-mono font-bold text-emerald-400">+{fmt(sipCalculation.gains)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-line/40 text-sm font-extrabold">
                  <span className="text-textLight">Expected Future Value</span>
                  <span className="font-mono text-accent">{fmt(sipCalculation.futureVal)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ===================== TAB 2: HIGH GROWTH FUNDS ===================== */}
        {activeTab === "growth" && (
          <div className="space-y-4 animate-fadeUp">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                🚀 High Momentum & Alpha Growth Funds
              </span>
            </div>

            <div className="space-y-3">
              {HIGH_GROWTH_FUNDS.map((f) => (
                <Card key={f.id} className="p-4 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-textLight">{f.name}</h4>
                        <Badge color="#A855F7" size={9}>{f.tag}</Badge>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{f.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold font-mono text-purple-400">{f.cagr3Y}</p>
                      <p className="text-[9px] text-muted">3-Yr Return</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 border-y border-line/40 text-xs my-2">
                    <div>
                      <span className="text-[10px] text-muted block">1-Year Surge</span>
                      <span className="font-bold text-emerald-400">{f.cagr1Y}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted block">Min Start</span>
                      <span className="font-bold text-textLight font-mono">{fmt(f.minSip)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-[10px] text-muted">{f.risk}</span>
                    <Btn
                      variant="primary"
                      className="py-1.5 px-4 text-xs font-bold"
                      onClick={() => handleTriggerSip(f)}
                    >
                      Invest in Growth
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: DAILY RD (RECURRING DEPOSIT) ===================== */}
        {activeTab === "dailyrd" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏦</span> Daily Recurring Deposit (RD)
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  8.1% p.a. Guaranteed
                </span>
              </div>

              <p className="text-xs text-muted mb-4">
                Save a fixed amount every single day automatically from your wallet. 100% safe, bank-insured with guaranteed high returns.
              </p>

              {/* Choose Daily Amount */}
              <div className="mb-4">
                <span className="text-xs font-bold text-muted block mb-1.5">Daily Deposit Amount</span>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRdDaily(amt)}
                      className={`py-2 rounded-xl border text-xs font-extrabold font-mono transition-all ${
                        rdDaily === amt
                          ? "bg-amber-500/20 border-amber-400 text-amber-400 shadow-sm"
                          : "bg-surf border-line text-muted hover:text-textLight"
                      }`}
                    >
                      ₹{amt}/day
                    </button>
                  ))}
                </div>
              </div>

              {/* Choose Tenure */}
              <div className="mb-4">
                <span className="text-xs font-bold text-muted block mb-1.5">Deposit Duration</span>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 6, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRdTenureMonths(m)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        rdTenureMonths === m
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-surf border-line text-muted hover:text-textLight"
                      }`}
                    >
                      {m} Months
                    </button>
                  ))}
                </div>
              </div>

              {/* Maturity Summary Card */}
              <div className="p-3.5 rounded-2xl bg-surf border border-line space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Total Principal Deposited</span>
                  <span className="font-bold text-textLight font-mono">{fmt(rdCalculation.totalDeposited)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Guaranteed Interest Earned</span>
                  <span className="font-bold text-emerald-400 font-mono">+{fmt(rdCalculation.interest)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-line/40">
                  <span className="text-xs font-bold text-textLight">Total Maturity Payout</span>
                  <span className="text-lg font-extrabold font-mono text-amber-400">{fmt(rdCalculation.maturity)}</span>
                </div>
              </div>

              <Btn
                variant="primary"
                className="w-full py-3 text-xs font-extrabold flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
                onClick={handleTriggerDailyRd}
              >
                <span>🏦</span>
                <span>Start Daily RD (₹{rdDaily}/day)</span>
              </Btn>
            </Card>
          </div>
        )}

        {/* ===================== TAB 4: DAILY SIP ₹10 ===================== */}
        {activeTab === "dailysip10" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-5 border-accent/40 bg-gradient-to-b from-accent/[0.08] to-card text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 text-accent flex items-center justify-center text-3xl mx-auto mb-3">
                ☕
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-accent block mb-1">
                RenoPay Micro-Investing
              </span>
              <h3 className="text-2xl font-extrabold text-textLight font-mono">Daily SIP ₹10</h3>
              <p className="text-xs text-muted max-w-[280px] mx-auto mt-2 leading-relaxed">
                Skip one cup of chai a day. Invest ₹10 daily into India&apos;s 50 biggest companies (Nifty 50 Index).
              </p>

              {/* Compounding Chart Box */}
              <div className="p-4 rounded-2xl bg-surf/80 border border-line my-4 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Daily Commitment</span>
                  <span className="font-extrabold font-mono text-textLight">₹10 / day (₹300/mo)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">In 5 Years (@14% CAGR)</span>
                  <span className="font-bold font-mono text-emerald-400">₹26,100</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">In 10 Years (@14% CAGR)</span>
                  <span className="font-bold font-mono text-emerald-400">₹81,500</span>
                </div>
                <div className="flex justify-between text-xs pt-1.5 border-t border-line/40">
                  <span className="font-bold text-textLight">In 15 Years (@14% CAGR)</span>
                  <span className="text-base font-extrabold font-mono text-accent">₹2,02,000+</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-4 text-[10px] text-muted">
                <span>🛡️ Zero lock-in</span>
                <span>&bull;</span>
                <span>⚡ Pause anytime</span>
                <span>&bull;</span>
                <span>📈 100% Equity Index</span>
              </div>

              <Btn
                variant="primary"
                className="w-full py-3 text-xs font-extrabold flex items-center justify-center gap-2"
                onClick={handleTriggerDailySip10}
              >
                <span>🚀</span>
                <span>Start Daily SIP of ₹10 Now</span>
              </Btn>
            </Card>
          </div>
        )}

        {/* ===================== TAB 5: MY PORTFOLIO ===================== */}
        {activeTab === "portfolio" && (
          <div className="space-y-4 animate-fadeUp">
            {/* Portfolio Summary Card */}
            <Card className="p-4 border-line bg-card">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted">Total Invested</span>
                  <p className="text-xl font-extrabold font-mono text-textLight">{fmt(portfolio.totalInvested)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-muted">Current Value</span>
                  <p className="text-xl font-extrabold font-mono text-emerald-400">{fmt(portfolio.currentValue)}</p>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex justify-between items-center text-xs">
                <span className="text-muted">Overall Returns</span>
                <span className="font-extrabold font-mono text-emerald-400">
                  +{fmt(portfolio.overallGain)} ({portfolio.gainPercent}%)
                </span>
              </div>
            </Card>

            {/* Active SIPs List */}
            <div>
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 px-1">
                Active Mutual Fund SIPs ({portfolio.sips.length})
              </h4>
              <div className="space-y-2">
                {portfolio.sips.map((s) => (
                  <Card key={s.id} className="p-3.5 border-line">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-extrabold text-xs text-textLight">{s.fundName}</h5>
                        <p className="text-[10px] text-muted">{s.category}</p>
                      </div>
                      <Badge color="#22C55E" size={9}>Active</Badge>
                    </div>
                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-line/40 text-xs">
                      <div>
                        <span className="text-[9px] text-muted block">Contribution</span>
                        <span className="font-mono font-bold text-textLight">
                          {s.dailyAmount ? `₹${s.dailyAmount}/day` : `${fmt(s.monthlyAmount)}/mo`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-muted block">Next Scheduled Debit</span>
                        <span className="font-semibold text-accent">{s.nextDebitDate}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Active Recurring Deposits List */}
            <div>
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 px-1">
                Active Recurring Deposits ({portfolio.rds.length})
              </h4>
              <div className="space-y-2">
                {portfolio.rds.map((r) => (
                  <Card key={r.id} className="p-3.5 border-line">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-extrabold text-xs text-textLight">{r.bank}</h5>
                        <p className="text-[10px] text-muted">{r.tenureMonths} Months Plan</p>
                      </div>
                      <Badge color="#F59E0B" size={9}>Active RD</Badge>
                    </div>
                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-line/40 text-xs">
                      <div>
                        <span className="text-[9px] text-muted block">Daily Debit</span>
                        <span className="font-mono font-bold text-textLight">₹{r.dailyAmount}/day</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-muted block">Maturity Payout</span>
                        <span className="font-mono font-extrabold text-amber-400">{fmt(r.maturityAmount)}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Confirmation & PIN Modal (Normal Pay vs Advance Pay) */}
      <PaymentMethodModal
        isOpen={!!investModal}
        onClose={() => {
          setInvestModal(null);
          setModalError("");
        }}
        title={investModal?.title || "Confirm Investment"}
        subtitle={investModal?.fundName}
        amount={investModal?.amount || 0}
        recipient={investModal?.recipient || investModal?.fundName}
        accountBalance={profile?.account?.balance ?? 0}
        onAddMoney={() => {
          setInvestModal(null);
          onNavigate?.("addmoney");
        }}
        onConfirm={async (enteredPin, mode) => {
          await handleConfirmInvestment(enteredPin, mode);
        }}
        loading={submitting}
        error={modalError}
      />
    </div>
  );
}
