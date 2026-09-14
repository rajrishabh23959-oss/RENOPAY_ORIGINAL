import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { FinancialServices } from "../lib/financialServices";
import { PaymentAPI, FinancialAPI } from "../lib/api";
import { fmt } from "../lib/format";
import { Card, Btn, Badge } from "../components/ui";
import { PaymentMethodModal } from "../components/PaymentMethodModal";

const POPULAR_PLANS = [
  { id: "P1", price: 299, validity: "28 Days", data: "1.5 GB/day", calls: "Unlimited", desc: "Hero Unlimited &bull; 100 SMS/day", tag: "Best Seller" },
  { id: "P2", price: 349, validity: "28 Days", data: "2.5 GB/day", calls: "Unlimited", desc: "True 5G Unlimited &bull; Disney+ Hotstar Mobile 3M", tag: "True 5G" },
  { id: "P3", price: 719, validity: "84 Days", data: "1.5 GB/day", calls: "Unlimited", desc: "Long Validity &bull; 100 SMS/day &bull; 5G Ready", tag: "Popular" },
  { id: "P4", price: 859, validity: "84 Days", data: "2.0 GB/day", calls: "Unlimited", desc: "True 5G Unlimited &bull; JioCinema Premium", tag: "Heavy Data" },
  { id: "P5", price: 2999, validity: "365 Days", data: "2.5 GB/day", calls: "Unlimited", desc: "Annual Pack &bull; 912.5 GB total &bull; 5G Unlimited", tag: "Annual" },
  { id: "P6", price: 19, validity: "Active Base", data: "1.0 GB", calls: "Data Only", desc: "Instant high-speed booster pack", tag: "Add-on" },
  { id: "P7", price: 29, validity: "Active Base", data: "2.0 GB", calls: "Data Only", desc: "Data top-up for live streaming", tag: "Add-on" },
];

export function RechargeScreen({ onBack, onNavigate, initialTab = "mobile" }) {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // "mobile" | "electricity" | "tuition" | "loan_emi"

  // Mobile Recharge State
  const [mobileNum, setMobileNum] = useState("9876543210");
  const [operator, setOperator] = useState("Jio Telecom");
  const [recipientName, setRecipientName] = useState(profile?.full_name || "Self");
  const [planCategory, setPlanCategory] = useState("All");
  const [selectedPlan, setSelectedPlan] = useState(POPULAR_PLANS[0]);

  // Tuition Fee State
  const [teachers, setTeachers] = useState([]);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherUpi, setTeacherUpi] = useState("");
  const [studentName, setStudentName] = useState(profile?.full_name || "");
  const [teacherFee, setTeacherFee] = useState(2500);
  const [teacherDueDay, setTeacherDueDay] = useState(5);

  // Electricity Bill State
  const [stateName, setStateName] = useState("Bihar");
  const [selectedBoard, setSelectedBoard] = useState("North Bihar Power (NBPDCL)");
  const [consumerNo, setConsumerNo] = useState("108492049281");
  const [billAmount, setBillAmount] = useState(1480);

  // Active Loans for EMI repayment
  const [loans, setLoans] = useState([]);

  // Payment Confirmation Modal State
  const [paymentModal, setPaymentModal] = useState(null); // { type, title, amount, meta, onConfirm }
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [receiptModal, setReceiptModal] = useState(null);

  const loadData = async () => {
    setTeachers(FinancialServices.getTeachers());
    try {
      const backendLoans = await FinancialAPI.getLoans();
      if (backendLoans && backendLoans.length > 0) {
        setLoans(backendLoans);
        return;
      }
    } catch (_) {}
    setLoans(FinancialServices.getLoans());
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

  // Filter plans
  const filteredPlans = useMemo(() => {
    if (planCategory === "All") return POPULAR_PLANS;
    if (planCategory === "5G") return POPULAR_PLANS.filter((p) => p.tag === "True 5G");
    if (planCategory === "Addon") return POPULAR_PLANS.filter((p) => p.tag === "Add-on");
    if (planCategory === "Annual") return POPULAR_PLANS.filter((p) => p.tag === "Annual");
    return POPULAR_PLANS;
  }, [planCategory]);

  // Handle Mobile Recharge Submission
  const initiateMobileRecharge = () => {
    if (!mobileNum || mobileNum.trim().length < 10) {
      alert("Please enter a valid 10-digit mobile number");
      return;
    }
    setPaymentModal({
      type: "mobile_recharge",
      title: "Mobile Prepaid Recharge",
      amount: selectedPlan.price,
      meta: `${operator} • ${mobileNum} (${recipientName}) • ${selectedPlan.validity}`,
      recipient: `${operator} Prepaid`,
      onConfirm: async (enteredPin) => {
        // Real Backend Debit & Transaction
        const res = await FinancialAPI.payBill({
          bill_type: "mobile_recharge",
          operator,
          consumer_number: mobileNum,
          recipient_name: recipientName,
          plan_details: `${selectedPlan.desc} (${selectedPlan.validity})`,
          amount: selectedPlan.price,
          pin: enteredPin || undefined,
        });

        // Record in local cache
        FinancialServices.recordRecharge({
          type: "Mobile Recharge",
          operator,
          mobileNum,
          recipient: recipientName,
          amount: selectedPlan.price,
          plan: selectedPlan.desc,
          txnRef: res.txn_ref,
        });

        await refreshProfile?.();
        setPaymentModal(null);
        setReceiptModal({
          title: "Recharge Successful! ⚡",
          subtitle: `${operator} Mobile Recharge for ${mobileNum}`,
          amount: selectedPlan.price,
          txnId: res.txn_ref,
          txnRef: res.txn_ref,
          details: [
            { label: "Mobile Number", val: mobileNum },
            { label: "Recipient", val: recipientName },
            { label: "Operator", val: operator },
            { label: "Plan Benefits", val: `${selectedPlan.data} • ${selectedPlan.validity}` },
            { label: "Payment Source", val: "RenoPay Main Account" },
          ],
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Handle Tuition Fee Submission
  const initiateTuitionFee = (t) => {
    setPaymentModal({
      type: "tuition_fee",
      title: "Pay Monthly Tuition Fee",
      amount: t.monthlyFee,
      meta: `${t.name} • UPI: ${t.upiId} • Student: ${t.studentName}`,
      recipient: t.name,
      onConfirm: async (enteredPin) => {
        const res = await FinancialAPI.payBill({
          bill_type: "tuition_fee",
          operator: t.name,
          consumer_number: t.upiId,
          recipient_name: t.studentName,
          plan_details: t.subject,
          amount: t.monthlyFee,
          pin: enteredPin || undefined,
        });

        FinancialServices.payTeacherFee(t.id);

        await refreshProfile?.();
        loadData();
        setPaymentModal(null);
        setReceiptModal({
          title: "Tuition Fee Paid! 🎓",
          subtitle: `Payment transferred to ${t.name}`,
          amount: t.monthlyFee,
          txnId: res.txn_ref,
          txnRef: res.txn_ref,
          details: [
            { label: "Teacher / Coaching", val: t.name },
            { label: "Teacher UPI VPA", val: t.upiId },
            { label: "Course / Subject", val: t.subject },
            { label: "Student Name", val: t.studentName },
            { label: "Payment Status", val: "Instant Settlement" },
          ],
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Handle Add Teacher
  const handleSaveTeacher = (e) => {
    e.preventDefault();
    if (!teacherName || !teacherUpi) {
      alert("Please fill Teacher Name and UPI ID");
      return;
    }
    FinancialServices.addTeacher({
      name: teacherName.trim(),
      subject: teacherSubject.trim() || "Coaching Classes",
      upiId: teacherUpi.trim(),
      studentName: studentName.trim() || "Student",
      monthlyFee: Number(teacherFee) || 2000,
      dueDay: Number(teacherDueDay) || 5,
    });
    loadData();
    setShowAddTeacherModal(false);
    setTeacherName("");
    setTeacherSubject("");
    setTeacherUpi("");
  };

  // Handle Electricity Bill Submission
  const initiateElectricityBill = () => {
    setPaymentModal({
      type: "electricity_bill",
      title: "Pay Electricity Bill",
      amount: billAmount,
      meta: `${selectedBoard} • Consumer ID: ${consumerNo}`,
      recipient: selectedBoard,
      onConfirm: async (enteredPin) => {
        const res = await FinancialAPI.payBill({
          bill_type: "electricity_bill",
          operator: selectedBoard,
          consumer_number: consumerNo,
          amount: billAmount,
          pin: enteredPin || undefined,
        });

        FinancialServices.recordRecharge({
          type: "Electricity Bill",
          operator: selectedBoard,
          consumerNo,
          amount: billAmount,
          txnRef: res.txn_ref,
        });

        await refreshProfile?.();
        setPaymentModal(null);
        setReceiptModal({
          title: "Electricity Bill Paid! 💡",
          subtitle: `${selectedBoard} Bill Settled`,
          amount: billAmount,
          txnId: res.txn_ref,
          txnRef: res.txn_ref,
          details: [
            { label: "Electricity Board", val: selectedBoard },
            { label: "Consumer / CA No", val: consumerNo },
            { label: "Billing State", val: stateName },
            { label: "Payment Channel", val: "BBPS Bharat BillPay" },
            { label: "Status", val: "SUCCESS / Paid" },
          ],
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Handle Loan EMI Repayment
  const initiateLoanRepay = (loan) => {
    setPaymentModal({
      type: "loan_repay",
      title: "Monthly EMI Repayment",
      amount: loan.monthlyEmi,
      meta: `${loan.type} (${loan.id || loan.loan_code}) • ${loan.lender}`,
      recipient: loan.lender || "RenoPay Capital",
      onConfirm: async (enteredPin) => {
        const res = await FinancialAPI.repayLoan({
          loan_code: loan.loan_code || loan.id,
          amount: loan.monthlyEmi,
          pin: enteredPin || undefined,
        });

        const updatedLoan = FinancialServices.repayLoanEmi(loan.id);

        await refreshProfile?.();
        loadData();
        setPaymentModal(null);
        setReceiptModal({
          title: "EMI Payment Successful! 💳",
          subtitle: `EMI cleared for ${loan.type}`,
          amount: loan.monthlyEmi,
          txnId: res.txn_ref,
          txnRef: res.txn_ref,
          details: [
            { label: "Loan ID", val: loan.loan_code || loan.id },
            { label: "Loan Type", val: loan.type },
            { label: "Lender", val: loan.lender },
            { label: "Remaining Balance", val: fmt(updatedLoan ? updatedLoan.remainingAmount : 0) },
            { label: "Status", val: "EMI Succeeded" },
          ],
        });
      },
    });
    setPin("");
    setModalError("");
  };

  // Submit Modal Action
  const handleExecutePayment = async (enteredPin, payMode = "normal") => {
    if (profile?.has_upi_pin && !enteredPin) {
      setModalError("Please enter your 6-digit UPI PIN");
      return;
    }

    if ((profile?.account?.balance ?? 0) < (paymentModal?.amount || 0)) {
      setModalError("Insufficient wallet balance. Please add money to RenoPay wallet.");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      if (paymentModal?.onConfirm) {
        await paymentModal.onConfirm(enteredPin, payMode);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "Payment execution failed";
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
            <h2 className="text-[19px] font-extrabold text-textLight leading-tight">Recharge & Bills</h2>
            <p className="text-[11px] text-muted">Mobile, Tuition via UPI, Power & Loan EMIs</p>
          </div>
        </div>

        <span className="text-[11px] font-mono font-extrabold bg-accent/15 text-accent border border-accent/30 px-2.5 py-1 rounded-xl">
          BBPS &bull; RenoPay
        </span>
      </div>

      <div className="px-[20px] pt-3">
        {/* Navigation Tabs (Mobile, Tuition, Electricity, Loan Repay) */}
        <div className="grid grid-cols-4 gap-1.5 mb-4 bg-card p-1.5 rounded-2xl border border-line text-center">
          {[
            { key: "mobile", label: "Mobile", icon: "📱" },
            { key: "tuition", label: "Tuition", icon: "🎓" },
            { key: "electricity", label: "Electricity", icon: "💡" },
            { key: "loan", label: "Loan Repay", icon: "💳" },
          ].map((tab) => {
            const isSel = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isSel ? "bg-accent text-white shadow-accentGlow scale-[1.02]" : "text-muted hover:text-textLight"
                }`}
              >
                <span className="text-base mb-0.5">{tab.icon}</span>
                <span className={`text-[10px] font-bold ${isSel ? "text-white" : ""}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===================== TAB 1: MOBILE RECHARGE ===================== */}
        {activeTab === "mobile" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <span className="text-xs font-bold text-accent uppercase tracking-wider block mb-3">
                📱 Prepaid Mobile Recharge
              </span>

              {/* Recipient / Mobile number */}
              <div className="space-y-3 mb-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase font-bold text-muted">Mobile Number</label>
                    <div className="flex gap-1">
                      {["Self", "Mom", "Dad", "Sibling"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setRecipientName(`${tag} (${mobileNum.slice(-4)})`)}
                          className="text-[9px] bg-surf hover:bg-accent/20 border border-line px-1.5 py-0.5 rounded text-textLight/70"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobileNum}
                    onChange={(e) => setMobileNum(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-sm font-mono font-bold text-textLight outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted block mb-1">Operator</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs font-semibold text-textLight outline-none focus:border-accent"
                    >
                      <option value="Jio">Jio Prepaid</option>
                      <option value="Airtel">Airtel</option>
                      <option value="Vi">Vodafone Idea (Vi)</option>
                      <option value="BSNL">BSNL Prepaid</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted block mb-1">Circle</label>
                    <select
                      value={circle}
                      onChange={(e) => setCircle(e.target.value)}
                      className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs font-semibold text-textLight outline-none focus:border-accent"
                    >
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Bihar & Jharkhand">Bihar & Jharkhand</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Maharashtra & Goa">Maharashtra & Goa</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Uttar Pradesh (East)">UP East</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 text-[10px] no-scrollbar">
                {["All", "5G", "Popular", "Addon", "Annual"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPlanCategory(c)}
                    className={`px-3 py-1 rounded-lg border font-bold transition-all whitespace-nowrap cursor-pointer ${
                      planCategory === c
                        ? "bg-accent text-white border-accent shadow-sm"
                        : "bg-surf border-line text-muted hover:text-textLight"
                    }`}
                  >
                    {c === "All" ? "All Plans" : c === "5G" ? "True 5G" : c === "Addon" ? "Data Add-ons" : c}
                  </button>
                ))}
              </div>

              {/* Plans List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredPlans.map((p) => {
                  const isSel = selectedPlan.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlan(p)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSel
                          ? "bg-accent/15 border-accent shadow-sm"
                          : "bg-surf hover:bg-surf/80 border-line text-muted"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold font-mono text-textLight">₹{p.price}</span>
                          <span className="text-[10px] bg-accent/20 text-accent font-bold px-1.5 py-0.5 rounded">
                            {p.validity}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400">{p.data}</span>
                      </div>
                      <p className="text-[11px] text-textLight/90 font-medium">{p.desc}</p>
                    </div>
                  );
                })}
              </div>

              <Btn
                variant="primary"
                className="w-full mt-4 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5"
                onClick={initiateMobileRecharge}
              >
                <span>⚡</span>
                <span>Recharge {fmt(selectedPlan.price)} Now</span>
              </Btn>
            </Card>
          </div>
        )}

        {/* ===================== TAB 2: TUITION FEE VIA UPI ===================== */}
        {activeTab === "tuition" && (
          <div className="space-y-4 animate-fadeUp">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Tuition Fees & Coaching</h3>
                <p className="text-[10px] text-muted">Pay teachers directly via their UPI App ID</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(true)}
                className="px-2.5 py-1 rounded-xl bg-accent text-white text-[11px] font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
              >
                <span>+</span> Add Teacher
              </button>
            </div>

            {teachers.length === 0 ? (
              <Card className="p-6 text-center border-line">
                <span className="text-3xl mb-2 block">🎓</span>
                <h4 className="font-extrabold text-sm text-textLight">No Teachers Added Yet</h4>
                <p className="text-xs text-muted mt-1">
                  Add your home tutor, coaching institute, or school teacher with their UPI ID to send fees monthly.
                </p>
                <Btn
                  variant="primary"
                  className="mt-4 py-2 px-4 text-xs font-bold"
                  onClick={() => setShowAddTeacherModal(true)}
                >
                  + Add First Teacher
                </Btn>
              </Card>
            ) : (
              teachers.map((t) => (
                <Card key={t.id} className="p-4 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-textLight">{t.name}</span>
                        <Badge color="#38BDF8" size={9}>UPI VPA</Badge>
                      </div>
                      <p className="text-[11px] text-accent font-mono mt-0.5">{t.upiId}</p>
                      <p className="text-[10px] text-muted">{t.subject} &bull; Student: {t.studentName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold font-mono text-textLight">{fmt(t.monthlyFee)}</p>
                      <p className="text-[9px] text-muted">Monthly Due: Day {t.dueDay}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line/40 text-xs mt-3">
                    <span className="text-[10px] text-muted">
                      {t.lastPaidDate ? `Last Paid: ${t.lastPaidDate}` : "Payment Due"}
                    </span>
                    <Btn
                      variant="teal"
                      className="py-1.5 px-4 text-xs font-bold"
                      onClick={() => initiateTuitionFee(t)}
                    >
                      Pay Monthly Fee ({fmt(t.monthlyFee)})
                    </Btn>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ===================== TAB 3: ELECTRICITY BILL ===================== */}
        {activeTab === "electricity" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-3">
                💡 Electricity Bill Payment
              </span>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">State</label>
                  <select
                    value={stateName}
                    onChange={(e) => {
                      setStateName(e.target.value);
                      setSelectedBoard(ELECTRICITY_BOARDS[e.target.value]?.[0] || "");
                    }}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs font-semibold text-textLight outline-none focus:border-accent"
                  >
                    {Object.keys(ELECTRICITY_BOARDS).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Electricity Distribution Board</label>
                  <select
                    value={selectedBoard}
                    onChange={(e) => setSelectedBoard(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs font-semibold text-textLight outline-none focus:border-accent"
                  >
                    {(ELECTRICITY_BOARDS[stateName] || []).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Consumer / CA Number</label>
                  <input
                    type="text"
                    value={consumerNo}
                    onChange={(e) => setConsumerNo(e.target.value)}
                    placeholder="e.g. 10298451"
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs font-mono font-bold text-textLight outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Bill Preview Card */}
              {billFetched && (
                <div className="p-3.5 rounded-2xl bg-surf border border-line mb-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Consumer Name</span>
                    <span className="font-bold text-textLight">{profile?.full_name || "Account Holder"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Bill Due Date</span>
                    <span className="font-bold text-amber-400">24th September 2026</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-line/40">
                    <span className="text-xs font-bold text-muted">Amount Due</span>
                    <span className="text-lg font-extrabold font-mono text-accent">{fmt(billAmount)}</span>
                  </div>
                </div>
              )}

              <Btn
                variant="primary"
                className="w-full py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5"
                onClick={initiateElectricityBill}
              >
                <span>💡</span>
                <span>Pay Bill ({fmt(billAmount)})</span>
              </Btn>
            </Card>
          </div>
        )}

        {/* ===================== TAB 4: LOAN REPAYMENT ===================== */}
        {activeTab === "loan" && (
          <div className="space-y-4 animate-fadeUp">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Active Loan Repayments</h3>
                <p className="text-[10px] text-muted">Paying decreases remaining loan balance automatically</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("loans")}
                className="text-[11px] text-accent font-bold hover:underline"
              >
                + Borrow More
              </button>
            </div>

            {loans.length === 0 ? (
              <Card className="p-6 text-center border-line">
                <span className="text-3xl mb-2 block">🎉</span>
                <h4 className="font-extrabold text-sm text-textLight">No Active Loan EMIs</h4>
                <p className="text-xs text-muted mt-1">
                  You have no pending loan installments. Take a quick personal loan with instant wallet disbursal.
                </p>
                <Btn
                  variant="primary"
                  className="mt-4 py-2 px-4 text-xs font-bold"
                  onClick={() => onNavigate?.("loans")}
                >
                  Explore Loans
                </Btn>
              </Card>
            ) : (
              loans.map((l) => {
                const isClosed = l.status === "CLOSED" || l.remainingAmount <= 0;
                return (
                  <Card key={l.id} className="p-4 border-line hover:border-accent/40 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-textLight">{l.type}</span>
                          <Badge color={isClosed ? "#22C55E" : "#FF6A1A"} size={9}>{l.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted font-mono">{l.id} &bull; {l.lender}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-extrabold font-mono text-accent">{fmt(l.monthlyEmi)}</p>
                        <p className="text-[9px] text-muted">Monthly EMI</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-y border-line/40 text-xs my-2">
                      <div>
                        <span className="text-[10px] text-muted block">Remaining Principal</span>
                        <span className="font-bold text-textLight font-mono">
                          {isClosed ? "₹0 (Paid Off)" : fmt(l.remainingAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted block">Next Due Date</span>
                        <span className="font-bold text-textLight">{isClosed ? "None" : l.nextDueDate}</span>
                      </div>
                    </div>

                    {!isClosed && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted">EMIs: {l.emisPaid || 0} / {l.tenureMonths}</span>
                        <Btn
                          variant="teal"
                          className="py-1.5 px-4 text-xs font-bold"
                          onClick={() => initiateLoanRepay(l)}
                        >
                          Pay Monthly EMI ({fmt(l.monthlyEmi)})
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

      {/* Add Teacher Modal */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-fadeUp">
          <div className="w-full max-w-sm bg-card border border-line rounded-3xl p-5 shadow-2xl">
            <h3 className="text-base font-extrabold text-textLight mb-1">Add Teacher / Coaching Institute</h3>
            <p className="text-xs text-muted mb-3">Set up teacher details & UPI ID for effortless monthly tuition fees.</p>

            <form onSubmit={handleSaveTeacher} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">Teacher / Institute Name</label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Amit Sharma Sir, Allen Coaching"
                  className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs font-semibold text-textLight outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">Teacher UPI ID / VPA</label>
                <input
                  type="text"
                  required
                  value={teacherUpi}
                  onChange={(e) => setTeacherUpi(e.target.value)}
                  placeholder="e.g. teachername@okaxis or 9876543210@paytm"
                  className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs font-mono font-bold text-textLight outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Subject / Class</label>
                  <input
                    type="text"
                    value={teacherSubject}
                    onChange={(e) => setTeacherSubject(e.target.value)}
                    placeholder="Maths / Class 12"
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs text-textLight outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Student Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Aarav"
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs text-textLight outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Monthly Fee (₹)</label>
                  <input
                    type="number"
                    value={teacherFee}
                    onChange={(e) => setTeacherFee(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-textLight outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Due Day of Month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={teacherDueDay}
                    onChange={(e) => setTeacherDueDay(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-textLight outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-line text-xs font-bold text-muted"
                >
                  Cancel
                </button>
                <Btn variant="primary" type="submit" className="flex-1 py-2.5 text-xs font-extrabold">
                  Save Teacher
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Confirmation & PIN Modal (Normal Pay vs Advance Pay) */}
      <PaymentMethodModal
        isOpen={!!paymentModal}
        onClose={() => {
          setPaymentModal(null);
          setModalError("");
        }}
        title={paymentModal?.title || "Confirm Payment"}
        subtitle={paymentModal?.meta}
        amount={paymentModal?.amount || 0}
        recipient={paymentModal?.recipient || paymentModal?.title}
        accountBalance={profile?.account?.balance ?? 0}
        onAddMoney={() => {
          setPaymentModal(null);
          onNavigate?.("addmoney");
        }}
        onConfirm={async (enteredPin, mode) => {
          await handleExecutePayment(enteredPin, mode);
        }}
        loading={submitting}
        error={modalError}
      />

      {/* Digital Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeUp">
          <div className="w-full max-w-sm bg-card border border-line rounded-3xl p-5 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-3">
              ✓
            </div>
            <h3 className="text-base font-extrabold text-textLight">{receiptModal.title}</h3>
            <p className="text-xs text-muted mb-3">{receiptModal.subtitle}</p>

            <div className="p-3.5 rounded-2xl bg-surf border border-line text-left space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-line/50">
                <span className="text-muted">Transaction ID</span>
                <span className="font-mono font-bold text-accent text-[11px]">{receiptModal.txnId}</span>
              </div>
              {receiptModal.details.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-muted">{d.label}</span>
                  <span className="font-bold text-textLight">{d.val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-line/50">
                <span className="font-bold text-xs text-textLight">Total Paid</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">{fmt(receiptModal.amount)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDownloadReceipt(receiptModal.txnRef || receiptModal.txnId)}
                className="flex-1 py-2.5 rounded-xl bg-surf border border-line text-xs font-bold text-accent hover:border-accent flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>📥</span> PDF Receipt
              </button>
              <Btn
                variant="primary"
                className="flex-1 py-2.5 text-xs font-bold"
                onClick={() => setReceiptModal(null)}
              >
                Done
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
