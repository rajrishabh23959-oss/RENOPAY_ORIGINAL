import React, { useEffect } from "react";

export function VendorPaymentSuccessOverlay({
  amount = 50,
  customerName = "Customer",
  spokenText = "",
  onClose,
  duration = 3800,
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-fade-in cursor-pointer select-none"
      role="dialog"
      aria-live="assertive"
    >
      {/* Background glow ripples */}
      <div className="absolute w-[280px] h-[280px] rounded-full bg-emerald-500/20 blur-3xl animate-pulse pointer-events-none" />

      {/* Large animated green checkmark circle */}
      <div className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-600 to-green-400 p-1 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.5)] mb-6 transform transition-transform hover:scale-105">
        <div className="w-full h-full rounded-full bg-[#0d1f14] flex items-center justify-center border-2 border-emerald-400/40">
          <svg
            className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>

      {/* Soundbox speaker animation wave */}
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
        <span className="text-base animate-bounce">🔊</span>
        <span>{spokenText || "Payment Received"}</span>
      </div>

      {/* Large amount */}
      <h1 className="text-5xl font-black text-white tracking-tight mb-2 drop-shadow-md">
        ₹{Number(amount).toLocaleString("en-IN")}
      </h1>

      <p className="text-emerald-300/90 text-sm font-medium mb-1">
        भुगतान प्राप्त हुआ • Payment Successful
      </p>

      {customerName && (
        <p className="text-neutral-400 text-xs mt-1">
          from <span className="text-white font-semibold">{customerName}</span>
        </p>
      )}

      <div className="mt-8 text-[11px] text-neutral-500 flex items-center gap-1">
        <span>स्क्रीन पर 3 सेकंड दिखेगा • Tap to dismiss</span>
      </div>
    </div>
  );
}
