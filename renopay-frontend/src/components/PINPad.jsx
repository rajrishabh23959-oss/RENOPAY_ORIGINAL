import { useState, useEffect } from "react";

export function PINPad({
  onComplete,
  label,
  accent = "#FF6A1A",
  shuffled = false,
  actionType = "pay", // "pay" | "check"
  actionLabel,
}) {
  const [pin, setPin] = useState("");
  const baseOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const [order, setOrder] = useState(baseOrder);

  useEffect(() => {
    setOrder(shuffled ? [...baseOrder].sort(() => Math.random() - 0.5) : baseOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffled]);

  const add = (d) => {
    if (pin.length >= 6) return;
    setPin((prev) => prev + d);
  };

  const del = () => setPin((p) => p.slice(0, -1));

  const resolvedAction = actionLabel || (actionType === "check" ? "Check" : actionType === "withdraw" ? "Withdraw" : "Pay");

  const handleAction = () => {
    if (pin.length === 6 && onComplete) {
      const pinToSubmit = pin;
      setPin("");
      onComplete(pinToSubmit);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        add(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        del();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin]);

  return (
    <div className="text-center">
      {shuffled && <p className="text-warn text-[11px] mb-2 animate-pulseScale">⚠ Anti-peek mode: keypad shuffled</p>}
      <p className="text-muted mb-4 text-[13px]">{label}</p>
      <div className="flex justify-center gap-2.5 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-[13px] h-[13px] rounded-full border-2 transition-all"
            style={{
              background: i < pin.length ? accent : "transparent",
              borderColor: i < pin.length ? accent : "rgb(var(--color-line))",
              boxShadow: i < pin.length ? `0 0 8px ${accent}66` : "none",
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5 max-w-[270px] mx-auto select-none">
        {order.map((d) => (
          <button
            key={d}
            type="button"
            className="btn py-[14px] rounded-[14px] bg-surf border border-line text-textLight text-2xl font-mono font-bold hover:bg-bg hover:border-accent/40 active:bg-accent/20 active:scale-95 focus:outline-none transition-all duration-150 cursor-pointer shadow-xs"
            onClick={() => add(String(d))}
            aria-label={`Digit ${d}`}
          >
            {d}
          </button>
        ))}

        {/* 0 ke left me: Cross symbol ✕ for delete/backspace */}
        <button
          type="button"
          className="btn py-[14px] rounded-[14px] bg-surf border border-line text-warn hover:bg-bg hover:border-warn/40 active:bg-warn/15 active:scale-95 focus:outline-none text-lg font-bold transition-all duration-150 flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-xs"
          onClick={del}
          disabled={pin.length === 0}
          aria-label="Delete digit"
        >
          ✕
        </button>

        {/* 0 in center */}
        <button
          type="button"
          className="btn py-[14px] rounded-[14px] bg-surf border border-line text-textLight text-2xl font-mono font-bold hover:bg-bg hover:border-accent/40 active:bg-accent/20 active:scale-95 focus:outline-none transition-all duration-150 cursor-pointer shadow-xs"
          onClick={() => add("0")}
          aria-label="Digit 0"
        >
          0
        </button>

        {/* 0 ke right me: Check or Pay button */}
        <button
          type="button"
          className={`btn py-[14px] rounded-[14px] border text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center ${
            pin.length === 6
              ? "bg-accent border-accent text-white shadow-accentGlow hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
              : "bg-surf border-line text-muted/40 cursor-not-allowed"
          }`}
          onClick={handleAction}
          disabled={pin.length !== 6}
          aria-label={resolvedAction}
        >
          {resolvedAction}
        </button>
      </div>
    </div>
  );
}

