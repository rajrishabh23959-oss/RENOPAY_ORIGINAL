import React, { useState } from "react";
import { getTranslation } from "./VendorTranslations";

export function VendorDashboard({
  currentLang = "hi",
  dailyTotal = 3450,
  monthlyTotal = 48200,
  txnCount = 24,
  comparisonDiff = 200,
  isMoreThanYesterday = true,
  transactions = [],
  refunds = [],
  onOpenRefundModal,
  onOpenAdvancedAccounting,
}) {
  const t = getTranslation(currentLang);
  const [activeListTab, setActiveListTab] = useState("sales"); // "sales" | "refunds"

  const days = t.days_of_week || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
  const weekData = [
    { day: days[0], amt: 2800 },
    { day: days[1], amt: 3100 },
    { day: days[2], amt: 2400 },
    { day: days[3], amt: 3900 },
    { day: days[4], amt: 3250 },
    { day: days[5], amt: 4800 },
    { day: days[6], amt: dailyTotal },
  ];
  const maxAmt = Math.max(...weekData.map((d) => d.amt), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Main Metric: Aaj Ka Total & Is Mahine Ka Total */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#291b15] via-[#1c1512] to-[#120e0c] border border-[#ff6a1a]/30 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
            {t.today_total}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent font-bold text-[11px]">
            {txnCount} {t.payments_count_label}
          </span>
        </div>

        {/* Big bold number */}
        <div className="my-2.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[#ff8c42]">₹</span>
          <span className="text-4xl font-black text-white tracking-tight">
            {Number(dailyTotal).toLocaleString("en-IN")}
          </span>
        </div>

        {/* Bottom row: Month total & Comparison pill */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
          <div>
            <span className="text-neutral-400 block text-[10px]">{t.month_total}</span>
            <span className="text-white font-bold text-sm">
              ₹{Number(monthlyTotal).toLocaleString("en-IN")}
            </span>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              isMoreThanYesterday
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            <span>{isMoreThanYesterday ? "▲" : "▼"}</span>
            <span>
              {isMoreThanYesterday
                ? t.compared_to_yesterday.replace("{diff}", comparisonDiff)
                : t.compared_to_yesterday_less.replace("{diff}", comparisonDiff)}
            </span>
          </div>
        </div>
      </div>

      {/* Past 7 Days Simple Bar Graph */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-neutral-200">{t.last_7_days}</h4>
          <span className="text-[10px] text-neutral-400">7 Days Trend</span>
        </div>

        <div className="h-28 flex items-end justify-between gap-2 pt-2 px-1">
          {weekData.map((item, idx) => {
            const heightPct = Math.round((item.amt / maxAmt) * 100);
            const isToday = idx === weekData.length - 1;
            return (
              <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-neutral-400 font-mono">
                  ₹{item.amt >= 1000 ? `${(item.amt / 1000).toFixed(1)}k` : item.amt}
                </span>
                <div className="w-full max-w-[28px] bg-white/10 rounded-t-lg relative overflow-hidden flex items-end" style={{ height: "65%" }}>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      isToday
                        ? "bg-gradient-to-t from-[#ff6a1a] to-[#ff9e54] shadow-[0_0_12px_rgba(255,106,26,0.5)]"
                        : "bg-gradient-to-t from-emerald-600/80 to-emerald-400/90"
                    }`}
                    style={{ height: `${Math.max(heightPct, 12)}%` }}
                  />
                </div>
                <span className={`text-[10px] ${isToday ? "text-accent font-bold" : "text-neutral-400"}`}>
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction List & Refund History Tabs */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveListTab("sales")}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                activeListTab === "sales"
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {t.recent_transactions} ({transactions.length})
            </button>
            <button
              onClick={() => setActiveListTab("refunds")}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                activeListTab === "refunds"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {t.refund_history_tab} ({refunds.length})
            </button>
          </div>
        </div>

        {/* Sales Transactions */}
        {activeListTab === "sales" && (
          <div className="divide-y divide-white/5 mt-2">
            {transactions.length === 0 ? (
              <p className="text-center text-xs text-neutral-400 py-6">
                {t.no_txns_today}
              </p>
            ) : (
              transactions.map((txn) => (
                <div
                  key={txn.id || txn.qr_id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      ↓
                    </div>
                    <div>
                      <p className="text-white font-semibold">{txn.customer_name || "Customer"}</p>
                      <p className="text-neutral-400 text-[10px]">
                        {txn.time || "Just now"} • {txn.note || "UPI Payment"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold text-sm">
                      +₹{txn.amount}
                    </span>
                    <button
                      onClick={() => onOpenRefundModal(txn)}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-red-500/20 text-neutral-300 hover:text-red-400 text-[10px] font-semibold transition-colors"
                    >
                      {t.refund_btn}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Refund History */}
        {activeListTab === "refunds" && (
          <div className="divide-y divide-white/5 mt-2">
            {refunds.length === 0 ? (
              <p className="text-center text-xs text-neutral-400 py-6">
                No refunds issued yet
              </p>
            ) : (
              refunds.map((ref) => (
                <div
                  key={ref.refund_id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-sm">
                      ↩
                    </div>
                    <div>
                      <p className="text-white font-semibold">{ref.customer_name || "Customer"}</p>
                      <p className="text-neutral-400 text-[10px]">
                        {ref.time || "Today"} • {ref.reason}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-red-400 font-bold text-sm">
                      -₹{ref.amount}
                    </span>
                    <span className="block text-[10px] text-neutral-400">Refunded</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Optional "Advanced View" for Accounting Ledgers */}
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-neutral-200">
            {t.switch_to_accounting}
          </h4>
          <p className="text-[10px] text-neutral-400">
            Ledger, P&amp;L, Trial Balance &amp; GST compliance
          </p>
        </div>
        <button
          onClick={onOpenAdvancedAccounting}
          className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-accent font-bold text-xs transition-all flex items-center gap-1"
        >
          <span>Open</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
