import { useState, useRef, useEffect, useMemo } from "react";
import { fmt } from "../lib/format";
import { Btn } from "./ui";

import note500Img from "../assets/currency/note_500.png";
import note200Img from "../assets/currency/note_200.png";
import note100Img from "../assets/currency/note_100.png";
import note50Img from "../assets/currency/note_50.png";
import note20Img from "../assets/currency/note_20.png";
import note10Img from "../assets/currency/note_10.png";
import coin5Img from "../assets/currency/coin_5.png";
import coin2Img from "../assets/currency/coin_2.png";
import coin1Img from "../assets/currency/coin_1.png";

const DENOM_IMAGES = {
  500: note500Img,
  200: note200Img,
  100: note100Img,
  50: note50Img,
  20: note20Img,
  10: note10Img,
  5: coin5Img,
  2: coin2Img,
  1: coin1Img,
};

function calculateDenominations(amount) {
  let rem = Math.round(Number(amount) || 0);
  const denoms = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  const breakdown = [];
  for (const d of denoms) {
    if (rem >= d) {
      const count = Math.floor(rem / d);
      rem %= d;
      breakdown.push({ value: d, count, img: DENOM_IMAGES[d] });
    }
  }
  return breakdown;
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  title = "Confirm Payment",
  subtitle,
  amount = 0,
  recipient,
  accountBalance = 0,
  onAddMoney,
  onConfirm,
  loading = false,
  error = "",
}) {
  const [payMode, setPayMode] = useState("normal"); // "normal" | "advance"
  const [pin, setPin] = useState("");
  const [slideProgress, setSlideProgress] = useState(0); // 0 to 100
  const [isSliding, setIsSliding] = useState(false);
  const [isSlideComplete, setIsSlideComplete] = useState(false);
  const sliderTrackRef = useRef(null);

  const numAmount = Number(amount) || 0;
  const hasInsufficientBalance = accountBalance < numAmount;
  const breakdowns = useMemo(() => calculateDenominations(numAmount), [numAmount]);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setSlideProgress(0);
      setIsSlideComplete(false);
      setPayMode("normal");
    }
  }, [isOpen]);

  const handlePointerDown = (e) => {
    if (isSlideComplete || loading) return;
    setIsSliding(true);
    updateSlideFromEvent(e);
  };

  const updateSlideFromEvent = (e) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const offsetX = clientX - rect.left;
    const progress = Math.min(100, Math.max(0, (offsetX / rect.width) * 100));
    setSlideProgress(progress);

    if (progress >= 90 && !isSlideComplete) {
      setIsSlideComplete(true);
      setSlideProgress(100);
      try { navigator.vibrate?.([40, 60, 40]); } catch {}
    }
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isSliding) return;
      updateSlideFromEvent(e);
    };
    const handlePointerUp = () => {
      if (!isSliding) return;
      setIsSliding(false);
      if (slideProgress < 90) {
        setSlideProgress(0);
        setIsSlideComplete(false);
      }
    };

    if (isSliding) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("touchmove", handlePointerMove);
      window.addEventListener("touchend", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isSliding, slideProgress]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (hasInsufficientBalance || loading) return;
    if (pin.length !== 6) return;
    onConfirm(pin, payMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-line rounded-3xl p-5 shadow-2xl relative overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 pb-2 border-b border-line">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-accent">RenoPay Checkout</span>
            <h3 className="text-base font-extrabold text-textLight">{title}</h3>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-full bg-surf flex items-center justify-center text-muted hover:text-white cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Amount Summary */}
        <div className="bg-surf/80 rounded-2xl p-3.5 border border-line mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted">Amount Payable</p>
            {recipient && <p className="text-xs font-semibold text-textLight">{recipient}</p>}
          </div>
          <div className="text-right">
            <span className="text-xl font-mono font-extrabold text-accent">{fmt(numAmount)}</span>
          </div>
        </div>

        {/* Balance Warning if insufficient */}
        {hasInsufficientBalance ? (
          <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold mb-4">
            <div className="flex items-center gap-1.5 mb-1 font-bold">
              <span>⚠️</span>
              <span>Insufficient Balance</span>
            </div>
            <p className="text-[11px] text-muted">
              RenoPay Balance: <strong className="text-textLight font-mono">{fmt(accountBalance)}</strong>. Required: <strong className="text-accent font-mono">{fmt(numAmount)}</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddMoney?.();
              }}
              className="mt-2.5 w-full py-2 px-3 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm hover:brightness-110"
            >
              + Add Money to Account →
            </button>
          </div>
        ) : (
          <>
            {/* Mode Selection Tabs: Normal Pay vs Advance Pay */}
            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-muted block mb-1.5">Select Payment Mode</label>
              <div className="grid grid-cols-2 gap-2 bg-surf/90 p-1.5 rounded-2xl border border-line">
                <button
                  type="button"
                  onClick={() => setPayMode("normal")}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    payMode === "normal"
                      ? "bg-accent text-white shadow-accentGlow"
                      : "text-muted hover:text-textLight"
                  }`}
                >
                  <span>⚡</span>
                  <span>Normal Pay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMode("advance")}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    payMode === "advance"
                      ? "bg-accent text-white shadow-accentGlow"
                      : "text-muted hover:text-textLight"
                  }`}
                >
                  <span>🚀</span>
                  <span>Advance Pay</span>
                </button>
              </div>
              <p className="text-[10px] text-muted mt-1.5 text-center">
                {payMode === "normal"
                  ? "⚡ Normal Pay: Direct amount verification + 6-digit UPI PIN"
                  : "🚀 Advance Pay: RenoPay physical currency notes slide & touch + UPI PIN"}
              </p>
            </div>

            {/* Advance Pay Note & Coin Breakdown Experience */}
            {payMode === "advance" && (
              <div className="bg-surf/60 rounded-2xl p-3 border border-line mb-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-muted">Currency Denomination Stack</span>
                  <span className="text-[10px] font-mono text-accent font-bold">Total: {fmt(numAmount)}</span>
                </div>

                {/* Stack of realistic notes */}
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
                  {breakdowns.map((b) => (
                    <div
                      key={b.value}
                      className="shrink-0 flex flex-col items-center bg-card border border-line rounded-xl p-1.5 relative shadow-sm"
                      style={{ minWidth: b.value >= 10 ? 76 : 52 }}
                    >
                      <img
                        src={b.img}
                        alt={`₹${b.value}`}
                        className="object-contain rounded-md"
                        style={{ height: b.value >= 10 ? 34 : 28 }}
                      />
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-bold">
                        <span className="text-textLight font-mono">₹{b.value}</span>
                        <span className="bg-accent/20 text-accent px-1 rounded-full text-[9px]">×{b.count}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interactive Slide to Authorize Note Track */}
                <div className="mt-3">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1.5 flex items-center justify-between">
                    <span>Slide Note to Authorize</span>
                    {isSlideComplete && <span className="text-emerald-400 font-bold">✓ Authorized</span>}
                  </p>
                  <div
                    ref={sliderTrackRef}
                    onPointerDown={handlePointerDown}
                    className={`relative h-12 rounded-2xl border flex items-center px-2 select-none cursor-pointer transition-colors overflow-hidden ${
                      isSlideComplete
                        ? "bg-emerald-500/20 border-emerald-500"
                        : "bg-bg border-line hover:border-accent/50"
                    }`}
                  >
                    {/* Fill background bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 transition-all ${
                        isSlideComplete ? "bg-emerald-500/30 w-full" : "bg-accent/20"
                      }`}
                      style={{ width: `${slideProgress}%` }}
                    />

                    {/* Draggable Note Thumb */}
                    <div
                      className={`relative z-10 w-16 h-8 rounded-lg shadow-md flex items-center justify-center gap-1 border transition-transform ${
                        isSlideComplete
                          ? "bg-emerald-500 text-white border-emerald-400"
                          : "bg-card border-accent/40 text-textLight"
                      }`}
                      style={{
                        transform: `translateX(${(slideProgress / 100) * (sliderTrackRef.current ? sliderTrackRef.current.clientWidth - 80 : 200)}px)`,
                      }}
                    >
                      <span className="text-xs">💵</span>
                      <span className="text-[10px] font-bold font-mono">Slide</span>
                    </div>

                    {/* Hint text */}
                    {!isSlideComplete && (
                      <span className="absolute right-3 text-[10px] font-bold text-muted pointer-events-none">
                        Slide note right ➔
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* UPI PIN Input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                  Enter 6-Digit UPI PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  autoFocus
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full bg-bg border border-line rounded-xl px-3 py-2.5 text-center text-lg tracking-[8px] font-mono text-textLight font-bold outline-none focus:border-accent"
                />
              </div>

              {error && (
                <p className="text-danger text-xs font-semibold bg-danger/10 border border-danger/30 p-2 rounded-xl">
                  {error}
                </p>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-1">
                <Btn variant="dark" type="button" onClick={onClose} disabled={loading} className="flex-1 py-2.5 text-xs">
                  Cancel
                </Btn>
                <Btn
                  variant="primary"
                  type="submit"
                  disabled={loading || pin.length !== 6 || (payMode === "advance" && !isSlideComplete)}
                  className="flex-1 py-2.5 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    "Processing..."
                  ) : payMode === "advance" && !isSlideComplete ? (
                    "Slide Note to Enable Pay"
                  ) : (
                    `Pay ${fmt(numAmount)}`
                  )}
                </Btn>
              </div>

              <div className="flex items-center justify-center gap-1 text-[10px] text-muted pt-1">
                <span>🔒</span>
                <span>Protected by RenoPay SentinAI & NPCI 256-bit Encryption</span>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
