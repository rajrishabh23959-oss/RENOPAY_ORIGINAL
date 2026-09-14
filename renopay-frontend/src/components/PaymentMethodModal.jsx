import { useEffect } from "react";
import { fmt } from "../lib/format";
import { PINPad } from "./PINPad";

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
  const numAmount = Number(amount) || 0;
  const hasInsufficientBalance = accountBalance < numAmount;

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-sm bg-card border border-line rounded-3xl p-5 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 pb-2.5 border-b border-line">
          <div className="pr-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-accent">RenoPay Checkout</span>
            <h3 className="text-base font-extrabold text-textLight leading-snug">{title}</h3>
            {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-full bg-surf flex items-center justify-center text-muted hover:text-white cursor-pointer text-xs shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Amount Summary */}
        <div className="bg-surf/80 rounded-2xl p-3 border border-line mb-3 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] uppercase font-bold text-muted">Amount Payable</p>
            {recipient && <p className="text-xs font-semibold text-textLight truncate">{recipient}</p>}
          </div>
          <div className="text-right shrink-0">
            <span className="text-xl font-mono font-extrabold text-accent">{fmt(numAmount)}</span>
          </div>
        </div>

        {/* Balance Warning if insufficient */}
        {hasInsufficientBalance ? (
          <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold mb-2">
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
              className="mt-3 w-full py-2.5 px-3 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm hover:brightness-110 active:scale-95 cursor-pointer transition-all"
            >
              + Add Money to Account →
            </button>
          </div>
        ) : (
          /* Clean, Native RenoPay PINPad for 100% Mobile Compatibility */
          <div className="relative">
            {error && (
              <p className="text-danger text-xs font-semibold bg-danger/10 border border-danger/30 p-2 rounded-xl text-center mb-3">
                {error}
              </p>
            )}

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-9 h-9 border-3 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-textLight">Processing Payment...</p>
                <p className="text-[11px] text-muted">Please do not press back or refresh</p>
              </div>
            ) : (
              <>
                <PINPad
                  label="Enter 6-digit UPI PIN"
                  actionLabel="Pay"
                  actionType="pay"
                  onComplete={(enteredPin) => onConfirm(enteredPin, "normal")}
                />

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-line/40">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-bold text-muted hover:text-textLight py-1 px-3 rounded-lg hover:bg-surf transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-1 text-[10px] text-muted">
                    <span>🔒</span>
                    <span>256-bit NPCI Secure</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
