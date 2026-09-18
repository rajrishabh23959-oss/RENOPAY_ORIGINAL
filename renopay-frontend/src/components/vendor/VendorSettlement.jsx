import React, { useState } from "react";
import { getTranslation } from "./VendorTranslations";

export function VendorSettlement({
  currentLang = "hi",
  pendingSettlement = 3450,
  settledToday = 4200,
  merchantId = "m_default_01",
}) {
  const t = getTranslation(currentLang);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [instantSettling, setInstantSettling] = useState(false);
  const [instantSettled, setInstantSettled] = useState(false);

  // Settlement records
  const settlements = [
    {
      settlement_id: "set_8841",
      merchant_id: merchantId,
      amount: pendingSettlement,
      status: instantSettled ? "SETTLED" : "PENDING",
      expected_time: instantSettled
        ? "Just now (Instant IMPS)"
        : t.expected_sample_time,
      utr_ref: "UTR938472910382",
      cycle: "Daily Auto-Settlement (T+1)",
      bank_account: "HDFC Bank •••• 4120",
    },
    {
      settlement_id: "set_8840",
      merchant_id: merchantId,
      amount: settledToday,
      status: "SETTLED",
      expected_time: "Today at 08:30 AM",
      utr_ref: "UTR829104817263",
      cycle: "Daily Auto-Settlement (T+1)",
      bank_account: "HDFC Bank •••• 4120",
    },
  ];

  const handleInstantSettle = () => {
    setInstantSettling(true);
    setTimeout(() => {
      setInstantSettling(false);
      setInstantSettled(true);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Settlement Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1c241e] via-[#141d17] to-[#0f1511] border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
            {t.settlement_heading}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 ${
              instantSettled
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}
          >
            <span>{instantSettled ? "✅" : "⏳"}</span>
            <span>{instantSettled ? t.status_settled : t.status_pending}</span>
          </span>
        </div>

        {/* Amount to be settled */}
        <div className="my-2">
          <span className="text-neutral-400 text-xs block mb-1">
            {instantSettled ? "Settled Amount" : "Next Payout Amount"}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-400">₹</span>
            <span className="text-4xl font-black text-white tracking-tight">
              {Number(pendingSettlement).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Expected arrival time */}
        <div className="mt-3 p-3 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2.5">
          <span className="text-lg">⏰</span>
          <div>
            <span className="text-neutral-400 text-[10px] block">{t.expected_time}</span>
            <span className="text-white font-semibold text-xs">
              {instantSettled
                ? "Paisa Bank mein aa gaya hai (IMPS Success)"
                : t.expected_sample_time}
            </span>
          </div>
        </div>

        {/* Instant Settle Button */}
        {!instantSettled && (
          <button
            onClick={handleInstantSettle}
            disabled={instantSettling}
            className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <span>{instantSettling ? "Processing Bank IMPS..." : t.instant_settle_btn}</span>
          </button>
        )}
      </div>

      {/* More Info Collapsible Accordion */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <button
          onClick={() => setShowMoreInfo(!showMoreInfo)}
          className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-neutral-300 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span>{t.more_info}</span>
          </div>
          <span className={`transform transition-transform ${showMoreInfo ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>

        {showMoreInfo && (
          <div className="p-4 pt-0 border-t border-white/5 space-y-3 text-xs">
            {settlements.map((item) => (
              <div
                key={item.settlement_id}
                className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">₹{item.amount}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.status === "SETTLED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {item.status === "SETTLED" ? `✅ ${t.status_settled}` : `⏳ ${t.status_pending}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-neutral-400">
                  <div>
                    <span className="block text-[10px] text-neutral-500">{t.settled_to}</span>
                    <span className="text-neutral-200">{item.bank_account}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-neutral-500">{t.utr_number}</span>
                    <span className="text-neutral-200 font-mono text-[10px]">{item.utr_ref}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] text-neutral-500">{t.cycle}</span>
                    <span className="text-neutral-200">{item.cycle}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
