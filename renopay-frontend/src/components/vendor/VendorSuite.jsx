import React, { useState, useEffect } from "react";
import { LANGUAGES, getTranslation } from "./VendorTranslations";
import { soundbox } from "./VendorSoundbox";
import { VendorPaymentSuccessOverlay } from "./VendorPaymentSuccessOverlay";
import { VendorGroqSettingsModal } from "./VendorGroqSettingsModal";
import { VendorQRCollection } from "./VendorQRCollection";
import { VendorDashboard } from "./VendorDashboard";
import { VendorSettlement } from "./VendorSettlement";
import { VendorRefundModal } from "./VendorRefundModal";
import { VendorUdhaarKhata } from "./VendorUdhaarKhata";
import { VendorStaffAccess } from "./VendorStaffAccess";
import { VendorInventoryLite } from "./VendorInventoryLite";
import { VendorSupportDispute } from "./VendorSupportDispute";
import { VendorTrustGrowth } from "./VendorTrustGrowth";
import { VendorAPI } from "../../lib/api";

export function VendorSuite({
  profile,
  onOpenAdvancedAccounting,
}) {
  // Regional language selection (persisted)
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem("renopay_vendor_lang") || "ta";
  });

  // Font size accessibility (persisted)
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem("renopay_vendor_font_size") || "normal";
  });

  // Active Tab within Vendor Suite
  const [activeTab, setActiveTab] = useState("dashboard");

  // Active Role (Owner vs Staff)
  const [activeRole, setActiveRole] = useState("owner");

  // Transactions & Metrics
  const [dailyTotal, setDailyTotal] = useState(3450);
  const [monthlyTotal, setMonthlyTotal] = useState(48200);
  const [transactions, setTransactions] = useState([
    { id: "txn_01", amount: 50, customer_name: "Rahul S.", time: "10:14 AM", note: "Samosa x 2" },
    { id: "txn_02", amount: 120, customer_name: "Aakash V.", time: "09:42 AM", note: "Breakfast" },
    { id: "txn_03", amount: 35, customer_name: "Sunil K.", time: "09:05 AM", note: "Chai & Biscuits" },
    { id: "txn_04", amount: 200, customer_name: "Pooja D.", time: "08:18 AM", note: "Kirana items" },
  ]);
  const [refunds, setRefunds] = useState([]);

  // Modals & Overlays
  const [overlayPayment, setOverlayPayment] = useState(null);
  const [selectedRefundTxn, setSelectedRefundTxn] = useState(null);
  const [showGroqModal, setShowGroqModal] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine ?? true);

  const t = getTranslation(currentLang);

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch backend vendor profile & dashboard metrics on mount
  useEffect(() => {
    VendorAPI.getProfile()
      .then((res) => {
        if (res.language_code && LANGUAGES.some((l) => l.code === res.language_code)) {
          // If stored on backend profile, honor it unless user locally changed
          const local = localStorage.getItem("renopay_vendor_lang");
          if (!local) {
            setCurrentLang(res.language_code);
          }
        }
      })
      .catch(() => {});

    VendorAPI.getDashboard()
      .then((res) => {
        if (res.daily_total !== undefined) {
          setDailyTotal(res.daily_total);
          setMonthlyTotal(res.monthly_total);
          if (res.recent_transactions) {
            setTransactions(res.recent_transactions);
          }
          if (res.refunds) {
            setRefunds(res.refunds);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleLanguageChange = (langCode) => {
    setCurrentLang(langCode);
    localStorage.setItem("renopay_vendor_lang", langCode);
    VendorAPI.updateProfile({ language_code: langCode }).catch(() => {});
  };

  const handleFontSizeChange = (size) => {
    setFontSize(size);
    localStorage.setItem("renopay_vendor_font_size", size);
  };

  // Triggered when payment arrives (from QR or simulator)
  const handlePaymentReceived = async (payment) => {
    // 1. Play soundbox chime and speak voice announcement in the chosen language
    const spoken = soundbox.announcePayment(payment.amount, currentLang);

    // 2. Show big green tick overlay for 3.5 seconds
    setOverlayPayment({
      amount: payment.amount,
      customerName: payment.customer_name,
      spokenText: spoken,
    });

    // 3. Update totals & transaction history
    setDailyTotal((prev) => prev + Number(payment.amount));
    setMonthlyTotal((prev) => prev + Number(payment.amount));
    setTransactions((prev) => [
      {
        id: payment.qr_id || `txn_${Date.now()}`,
        amount: Number(payment.amount),
        customer_name: payment.customer_name || "Customer",
        time: payment.time || "Just now",
        note: payment.note || "UPI Payment",
      },
      ...prev,
    ]);

    // 4. Sync with backend simulation endpoint
    try {
      await VendorAPI.simulatePayment({
        amount_rupees: Number(payment.amount),
        customer_name: payment.customer_name || "Customer",
        note: payment.note,
        qr_type: payment.qr_type || "dynamic",
      });
    } catch {
      // Local state is preserved
    }
  };

  // Process refund
  const handleProcessRefund = async (refundData) => {
    setRefunds([refundData, ...refunds]);
    setDailyTotal((prev) => Math.max(0, prev - Number(refundData.amount)));
    setSelectedRefundTxn(null);

    const msg = t.refund_success_msg.replace("{amount}", refundData.amount);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);

    try {
      await VendorAPI.processRefund({
        original_txn_id: refundData.original_txn_id,
        customer_name: refundData.customer_name,
        amount_rupees: Number(refundData.amount),
        reason: refundData.reason,
      });
    } catch {
      // Local state preserved
    }
  };

  // Day End SMS Generator (Req 8)
  const handleDayEndSms = () => {
    const msg = t.day_end_sms_text
      .replace("{total}", dailyTotal.toLocaleString("en-IN"))
      .replace("{count}", transactions.length);
    const merchantPhone = profile?.phone || "9876543210";
    const smsUrl = `sms:${merchantPhone}?body=${encodeURIComponent(msg)}`;
    window.open(smsUrl, "_blank");
  };

  // Font size scaler wrapper class
  const fontClass =
    fontSize === "xl"
      ? "text-base tracking-wide"
      : fontSize === "large"
      ? "text-[14px]"
      : "text-xs";

  return (
    <div className={`flex flex-col gap-4 ${fontClass} transition-all`}>
      {/* Toast Alert */}
      {toastMsg && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center animate-fade-in shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Offline Alert Banner (Req 8) */}
      {!isOnline && (
        <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
          {t.offline_mode_banner}
        </div>
      )}

      {/* Top Header: Language Switcher & Accessibility Controls */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-[#211a16] to-[#161210] border border-[#ff6a1a]/25 shadow-lg space-y-3">
        {/* Language Switcher (5 Languages) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1">
              <span>🌐</span> <span>{t.select_language_hint}</span>
            </span>
            <button
              onClick={() => setShowGroqModal(true)}
              className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1 bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20"
            >
              <span>⚡</span> <span>{t.groq_voice_btn}</span>
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                  currentLang === lang.code
                    ? "bg-accent text-white shadow-md scale-105"
                    : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-sm leading-none">{lang.flag}</span>
                <span className="text-[11px] leading-tight font-semibold">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Soundbox Test & Font Size Adjuster */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          {/* Soundbox audio test button */}
          <button
            onClick={() => soundbox.announcePayment(50, currentLang)}
            className="py-1 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all"
          >
            <span>🔊</span>
            <span>{t.soundbox_test}</span>
          </button>

          {/* Accessibility Font Size Pills */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
            <span className="text-[10px] text-neutral-400 px-1">A</span>
            <button
              onClick={() => handleFontSizeChange("normal")}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                fontSize === "normal" ? "bg-accent text-white" : "text-neutral-400"
              }`}
            >
              {t.font_normal}
            </button>
            <button
              onClick={() => handleFontSizeChange("large")}
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                fontSize === "large" ? "bg-accent text-white" : "text-neutral-400"
              }`}
            >
              {t.font_large}
            </button>
            <button
              onClick={() => handleFontSizeChange("xl")}
              className={`px-1.5 py-0.5 rounded text-[12px] font-bold ${
                fontSize === "xl" ? "bg-accent text-white" : "text-neutral-400"
              }`}
            >
              {t.font_xl}
            </button>
          </div>
        </div>
      </div>

      {/* Main Vendor Tabs Navigation (Horizontally scrollable) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {[
          { id: "dashboard", label: t.tab_dashboard, icon: "📊" },
          { id: "qr", label: t.tab_qr, icon: "🏷️" },
          { id: "khata", label: t.tab_khata, icon: "📖" },
          { id: "settlement", label: t.tab_settlement, icon: "🏦" },
          { id: "inventory", label: t.tab_inventory, icon: "⚡" },
          { id: "staff", label: t.tab_staff, icon: "👥" },
          { id: "support", label: t.tab_support, icon: "🛠️" },
          { id: "trust", label: t.tab_trust, icon: "🛡️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-3 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === tab.id
                ? "bg-accent text-white shadow-md"
                : "bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Tab Views */}
      {activeTab === "dashboard" && (
        <VendorDashboard
          currentLang={currentLang}
          dailyTotal={dailyTotal}
          monthlyTotal={monthlyTotal}
          txnCount={transactions.length}
          comparisonDiff={200}
          isMoreThanYesterday={true}
          transactions={transactions}
          refunds={refunds}
          onOpenRefundModal={(txn) => setSelectedRefundTxn(txn)}
          onOpenAdvancedAccounting={onOpenAdvancedAccounting}
        />
      )}

      {activeTab === "qr" && (
        <VendorQRCollection
          profile={profile}
          currentLang={currentLang}
          onPaymentReceived={handlePaymentReceived}
        />
      )}

      {activeTab === "khata" && (
        <VendorUdhaarKhata
          currentLang={currentLang}
          merchantName={profile?.full_name || "RenoPay Merchant"}
          merchantVpa={profile?.account?.vpa || "merchant@renopay"}
        />
      )}

      {activeTab === "settlement" && (
        <VendorSettlement
          currentLang={currentLang}
          pendingSettlement={dailyTotal}
          settledToday={4200}
          merchantId={profile?.account?.id || "m_default_01"}
        />
      )}

      {activeTab === "inventory" && (
        <VendorInventoryLite
          currentLang={currentLang}
          onQuickBill={(price, itemName) => {
            // Switch to QR tab and pre-fill dynamic QR
            setActiveTab("qr");
          }}
        />
      )}

      {activeTab === "staff" && (
        <VendorStaffAccess
          currentLang={currentLang}
          activeRole={activeRole}
          onRoleChange={setActiveRole}
        />
      )}

      {activeTab === "support" && (
        <VendorSupportDispute
          currentLang={currentLang}
          merchantId={profile?.account?.id || "m_default_01"}
        />
      )}

      {activeTab === "trust" && (
        <VendorTrustGrowth
          currentLang={currentLang}
          merchantName={profile?.full_name || "RenoPay Kirana Store"}
        />
      )}

      {/* Day-End SMS Action (Req 8) */}
      <div className="pt-2">
        <button
          onClick={handleDayEndSms}
          className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-white/10"
        >
          <span>{t.day_end_sms_btn}</span>
        </button>
      </div>

      {/* Big Green Tick Payment Overlay (3-4 Seconds) */}
      {overlayPayment && (
        <VendorPaymentSuccessOverlay
          amount={overlayPayment.amount}
          customerName={overlayPayment.customerName}
          spokenText={overlayPayment.spokenText}
          duration={3800}
          onClose={() => setOverlayPayment(null)}
        />
      )}

      {/* Refund Processing Modal */}
      {selectedRefundTxn && (
        <VendorRefundModal
          isOpen={!!selectedRefundTxn}
          transaction={selectedRefundTxn}
          currentLang={currentLang}
          onClose={() => setSelectedRefundTxn(null)}
          onProcessRefund={handleProcessRefund}
        />
      )}

      {/* Groq API Key Settings Modal */}
      <VendorGroqSettingsModal
        isOpen={showGroqModal}
        onClose={() => setShowGroqModal(false)}
        currentLang={currentLang}
      />
    </div>
  );
}
