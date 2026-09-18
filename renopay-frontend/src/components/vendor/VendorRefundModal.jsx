import React, { useState } from "react";
import { getTranslation } from "./VendorTranslations";

export function VendorRefundModal({
  isOpen,
  transaction,
  currentLang = "hi",
  onClose,
  onProcessRefund,
}) {
  const t = getTranslation(currentLang);
  const [refundType, setRefundType] = useState("full"); // "full" | "partial"
  const [refundAmount, setRefundAmount] = useState(
    transaction ? String(transaction.amount) : "0"
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = Number(refundAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (amt > transaction.amount) {
      setError(`Cannot refund more than original amount (₹${transaction.amount})`);
      return;
    }

    const refundData = {
      refund_id: `ref_${Date.now()}`,
      original_txn_id: transaction.id || transaction.qr_id || `txn_${Date.now()}`,
      amount: amt,
      customer_name: transaction.customer_name || "Customer",
      reason: reason.trim() || "Customer requested refund",
      status: "COMPLETED",
      created_at: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    onProcessRefund(refundData);
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] bg-[#1a1614] border border-red-500/30 rounded-2xl p-5 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-base">
              ↩️
            </div>
            <div>
              <h3 className="text-white font-bold text-base">{t.refund_modal_title}</h3>
              <p className="text-[11px] text-neutral-400">
                Original Txn: ₹{transaction.amount} ({transaction.customer_name || "Customer"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Full vs Partial Toggle */}
          <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setRefundType("full");
                setRefundAmount(String(transaction.amount));
              }}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                refundType === "full" ? "bg-red-500 text-white" : "text-neutral-400"
              }`}
            >
              {t.refund_type_full} (₹{transaction.amount})
            </button>
            <button
              type="button"
              onClick={() => {
                setRefundType("partial");
                setRefundAmount("");
              }}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                refundType === "partial" ? "bg-red-500 text-white" : "text-neutral-400"
              }`}
            >
              {t.refund_type_partial}
            </button>
          </div>

          {refundType === "partial" && (
            <div>
              <label className="block text-neutral-300 font-medium mb-1">
                {t.refund_amount_label}
              </label>
              <input
                type="number"
                max={transaction.amount}
                value={refundAmount}
                onChange={(e) => {
                  setError("");
                  setRefundAmount(e.target.value);
                }}
                placeholder="Enter refund amount"
                className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white font-bold text-base focus:outline-none focus:border-red-500"
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              {t.refund_reason_label}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Returned item, extra payment"
              className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg flex items-center justify-center gap-1.5"
            >
              <span>↩️</span>
              <span>{t.confirm_refund}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
