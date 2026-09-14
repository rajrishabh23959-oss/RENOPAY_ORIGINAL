import { useState, useEffect } from "react";
import { fmt } from "../lib/format";
import { Btn } from "./ui";

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
  const [pin, setPin] = useState("");

  const numAmount = Number(amount) || 0;
  const hasInsufficientBalance = accountBalance < numAmount;

  useEffect(() => {
    if (isOpen) {
      setPin("");
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (hasInsufficientBalance || loading) return;
    if (pin.length !== 6) return;
    onConfirm(pin, "normal");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-line rounded-3xl p-5 shadow-2xl relative overflow-hidden">
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
        <div className="bg-surf/80 rounded-2xl p-3.5 border border-line mb-3.5 flex items-center justify-between">
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
          <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold mb-2">
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
              className="mt-2.5 w-full py-2 px-3 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm hover:brightness-110 cursor-pointer"
            >
              + Add Money to Account →
            </button>
          </div>
        ) : (
          /* Clean Direct UPI PIN Verification Block */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] uppercase font-bold text-muted block mb-1.5 text-center tracking-wider">
                Enter 6-Digit UPI PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                autoFocus
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full bg-bg border border-accent/40 rounded-2xl px-4 py-3 text-center text-2xl tracking-[10px] font-mono text-textLight font-bold outline-none focus:border-accent shadow-inner transition-colors"
              />
            </div>

            {error && (
              <p className="text-danger text-xs font-semibold bg-danger/10 border border-danger/30 p-2 rounded-xl text-center">
                {error}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <Btn variant="dark" type="button" onClick={onClose} disabled={loading} className="flex-1 py-3 text-xs font-semibold">
                Cancel
              </Btn>
              <Btn
                variant="primary"
                type="submit"
                disabled={loading || pin.length !== 6}
                className="flex-1 py-3 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                {loading ? "Processing..." : `Pay ${fmt(numAmount)}`}
              </Btn>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted pt-1">
              <span>🔒</span>
              <span>Protected by RenoPay SentinAI & NPCI 256-bit Encryption</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
