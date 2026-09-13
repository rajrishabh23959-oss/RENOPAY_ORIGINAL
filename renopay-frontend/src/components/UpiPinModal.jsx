import { useState, useEffect, useRef } from "react";
import { AuthAPI } from "../lib/api";

/**
 * UpiPinModal
 *
 * Secure banking-grade UPI PIN modal.
 * Used when revealing account balance or cash denomination breakdown.
 */
export function UpiPinModal({
  isOpen,
  onClose,
  onSuccess,
  vpa = "user@renopay",
  bank = "RenoPay Virtual Bank",
}) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError("");
      setLoading(false);
      setShake(false);
    }
  }, [isOpen]);

  // Physical keyboard support for desktop users
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pin.length === 6 && !loading) {
          handleSubmit(pin);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pin, loading]);

  const handleDigit = (digit) => {
    if (loading) return;
    setError("");
    if (pin.length < 6) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 6) {
        handleSubmit(next);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setPin("");
    setError("");
  };

  const handleSubmit = async (pinValue) => {
    const pinToTest = pinValue || pin;
    if (pinToTest.length < 4) {
      setError("Please enter complete UPI PIN");
      triggerShake();
      return;
    }

    setLoading(true);
    setError("");
    try {
      await AuthAPI.verifyPin(pinToTest);
      setLoading(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("PIN verification error:", err);
      let msg = "Incorrect UPI PIN. Please try again.";
      if (err?.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
      setLoading(false);
      setPin("");
      triggerShake();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Container */}
      <div
        ref={modalRef}
        className={`w-full max-w-[380px] bg-[#121110] border border-[#2A2320] rounded-[24px] overflow-hidden shadow-2xl transition-all ${
          shake ? "animate-shake" : ""
        }`}
        style={{
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 106, 26, 0.15)",
        }}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-[#2A2320]/80 bg-gradient-to-b from-[#1C1815] to-[#121110]">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#201B17] border border-[#302823] text-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">🏛️</span>
            <span className="text-[13px] font-bold text-accent tracking-wide">{bank}</span>
          </div>

          <h3 className="text-[18px] font-extrabold text-white">Enter UPI PIN</h3>
          <p className="text-[11px] text-muted mt-0.5">
            Authenticate to view available balance & cash breakdown
          </p>
          <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent text-[10px] font-mono font-semibold">
            VPA: {vpa}
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="px-6 py-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3.5 my-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isFilled
                      ? "bg-accent scale-110 shadow-[0_0_12px_rgba(255,106,26,0.7)]"
                      : "bg-[#2A2320] border border-[#3A322D]"
                  }`}
                />
              );
            })}
          </div>

          {/* Loading / Error status */}
          <div className="min-h-[24px] mt-2 flex items-center justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-accent text-xs font-semibold">
                <span className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span>Verifying UPI PIN…</span>
              </div>
            ) : error ? (
              <p className="text-[#FF4A4A] text-xs font-semibold text-center">{error}</p>
            ) : (
              <p className="text-[11px] text-muted">Never share your UPI PIN with anyone</p>
            )}
          </div>
        </div>

        {/* On-screen Keypad */}
        <div className="px-6 pb-6 pt-1 bg-[#151210]/60 border-t border-[#2A2320]/60">
          <div className="grid grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                disabled={loading}
                onClick={() => handleDigit(String(num))}
                className="h-12 rounded-xl bg-[#1D1916] hover:bg-[#28221D] active:scale-95 border border-[#2D2622] text-white text-[18px] font-bold transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              disabled={loading || pin.length === 0}
              onClick={handleClear}
              className="h-12 rounded-xl bg-[#1A1614] hover:bg-[#241F1B] active:scale-95 border border-[#2D2622] text-muted hover:text-white text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
            >
              Clear
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleDigit("0")}
              className="h-12 rounded-xl bg-[#1D1916] hover:bg-[#28221D] active:scale-95 border border-[#2D2622] text-white text-[18px] font-bold transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:opacity-40"
            >
              0
            </button>

            <button
              type="button"
              disabled={loading || pin.length === 0}
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-[#1A1614] hover:bg-[#241F1B] active:scale-95 border border-[#2D2622] text-white text-[16px] transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
            >
              ⌫
            </button>
          </div>

          <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[10px] text-muted">
            <span>🔒</span>
            <span>NPCI / RenoPay 256-bit Secure Encryption</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
