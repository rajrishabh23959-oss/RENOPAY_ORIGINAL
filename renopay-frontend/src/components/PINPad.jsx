import { useState, useEffect } from "react";

export function PINPad({ onComplete, label, accent = "#FF6A1A", shuffled = false }) {
  const [pin, setPin] = useState("");
  const baseOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const [order, setOrder] = useState(baseOrder);

  useEffect(() => {
    setOrder(shuffled ? [...baseOrder].sort(() => Math.random() - 0.5) : baseOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffled]);

  const add = (d) => {
    if (pin.length >= 6) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 6) setTimeout(() => { onComplete(np); setPin(""); }, 180);
  };
  const del = () => setPin((p) => p.slice(0, -1));

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
              borderColor: i < pin.length ? accent : "#5C564F",
              boxShadow: i < pin.length ? `0 0 8px ${accent}66` : "none",
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5 max-w-[270px] mx-auto">
        {order.map((d) => (
          <button
            key={d} className="btn py-[15px] rounded-[13px] bg-surf border border-line text-textLight text-xl font-mono font-bold hover:bg-[#1a1714] active:bg-accent/20 transition-colors"
            onClick={() => add(String(d))}
            aria-label={`Digit ${d}`}
          >
            {d}
          </button>
        ))}
        <div />
        <button className="btn py-[15px] rounded-[13px] bg-surf border border-line text-textLight text-xl font-mono font-bold hover:bg-[#1a1714] active:bg-accent/20 transition-colors" onClick={() => add("0")} aria-label="Digit 0">0</button>
        <button className="btn py-[15px] rounded-[13px] bg-surf border border-line text-warn text-lg hover:bg-[#1a1714] transition-colors" onClick={del} aria-label="Backspace">⌫</button>
      </div>
    </div>
  );
}
