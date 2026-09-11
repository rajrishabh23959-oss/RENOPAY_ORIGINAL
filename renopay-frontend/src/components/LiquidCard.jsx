import { useState, useEffect, useRef } from "react";
import { fmt } from "../lib/format";

/**
 * LiquidCard – Premium animated liquid tank balance card.
 *
 * Two SVG sine-wave paths animate independently via CSS @keyframes
 * to produce a realistic water-sloshing effect. Colour interpolates
 * smoothly between three states based on balance percentage.
 *
 * Dark premium redesign: near-black container, orange wave palette,
 * warm glow shadow, off-white text.
 */
export function LiquidCard({ balance, maxBalance = 25000, vpa, bank, onToggle, show }) {
  const pct = Math.min(100, Math.max(3, (balance / maxBalance) * 100));
  const [animPct, setAnimPct] = useState(pct);
  const prevPct = useRef(pct);

  useEffect(() => {
    const t = setTimeout(() => {
      setAnimPct(pct);
      prevPct.current = pct;
    }, 80);
    return () => clearTimeout(t);
  }, [pct]);

  const liquidColor =
    animPct > 50
      ? "rgba(255, 106, 26, 0.75)"   // orange – healthy
      : animPct > 30
      ? "rgba(255, 160, 0, 0.75)"    // amber – moderate
      : "rgba(184, 66, 14, 0.80)";   // rust – low

  const waveFill =
    animPct > 50 ? "#FF6A1A" : animPct > 30 ? "#FFA000" : "#B8420E";

  const glowColor =
    animPct > 50 ? "rgba(255,106,26,0.25)" : animPct > 30 ? "rgba(255,160,0,0.25)" : "rgba(184,66,14,0.25)";

  const label = animPct > 50 ? "Healthy" : animPct > 30 ? "Moderate" : "Low";

  return (
    <>
      <style>{`
        @keyframes wave1 {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes wave2 {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .lc-wave1 { animation: wave1 3.2s linear infinite; }
        .lc-wave2 { animation: wave2 4.8s linear infinite; }
      `}</style>

      <div
        className="relative rounded-[22px] overflow-hidden h-44 border border-line"
        style={{
          background: "#0A0908",
          boxShadow: `0 8px 32px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Liquid fill layer */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-[1400ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ height: `${animPct}%` }}
        >
          {/* Wave 1 – dominant */}
          <div className="lc-wave1 absolute -top-[28px] left-0 w-[200%]">
            <svg viewBox="0 0 800 40" preserveAspectRatio="none" className="w-full h-8" style={{ opacity: 0.9 }}>
              <path
                d="M0,20 C80,5 160,35 240,20 C320,5 400,35 480,20 C560,5 640,35 720,20 C760,12 780,25 800,20 L800,40 L0,40 Z"
                fill={waveFill}
              />
            </svg>
          </div>
          {/* Wave 2 – subtle counter-wave */}
          <div className="lc-wave2 absolute -top-[20px] left-0 w-[200%]">
            <svg viewBox="0 0 800 30" preserveAspectRatio="none" className="w-full h-6" style={{ opacity: 0.45 }}>
              <path
                d="M0,15 C100,3 200,27 300,15 C400,3 500,27 600,15 C700,3 750,22 800,15 L800,30 L0,30 Z"
                fill={waveFill}
              />
            </svg>
          </div>
          {/* Solid fill below waves */}
          <div className="absolute top-4 left-0 right-0 bottom-0" style={{ background: liquidColor }} />
        </div>

        {/* Glass overlay gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, transparent 60%)" }}
        />

        {/* Content layer */}
        <div className="relative z-10 h-full flex flex-col justify-between px-[22px] py-[18px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[#5C564F] text-[10px] tracking-[2.5px] font-semibold">AVAILABLE BALANCE</p>
              <div className="flex items-center gap-2.5 mt-1.5">
                <p
                  className="font-mono text-[30px] font-bold leading-none"
                  style={{ color: "#F5F3F0", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}
                >
                  {show ? fmt(balance) : "₹ ••••••"}
                </p>
                <button
                  className="btn bg-white/10 border border-white/15 rounded-full w-7 h-7 text-[13px] flex items-center justify-center backdrop-blur-sm"
                  onClick={onToggle}
                >
                  {show ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1"
                style={{ background: waveFill + "33", color: waveFill, border: `1px solid ${waveFill}55` }}
              >
                {label}
              </div>
              <p className="text-[#5C564F] text-[9px]">{animPct.toFixed(0)}% of max</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: waveFill }} />
              <p className="text-[#9A938C] text-[11px] font-medium tracking-wide">{vpa}</p>
            </div>
            <p className="text-[#5C564F] text-[10px]">{bank}</p>
          </div>
        </div>
      </div>
    </>
  );
}
