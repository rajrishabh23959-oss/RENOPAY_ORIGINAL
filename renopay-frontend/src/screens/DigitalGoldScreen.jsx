import { useState, useEffect, useRef } from "react";
import { GoldAPI, AccountAPI } from "../lib/api";
import { useRenoSocket } from "../hooks/useRenoSocket";
import { Card, Btn, Badge } from "../components/ui";
import { fmt } from "../lib/format";

/**
 * DigitalGoldScreen — The Gold Vault.
 *
 * Dark premium redesign: near-black surfaces, orange accent,
 * radial glow effects, warm typography.
 */

function ConfettiBurst({ active }) {
  const PIECES = 20;
  const colors = ["#FF6A1A", "#22C55E", "#FFA352", "#B8420E", "#F5F3F0", "#FFA000"];
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {Array.from({ length: PIECES }).map((_, i) => {
        const color = colors[i % colors.length];
        const left = `${5 + Math.random() * 90}%`;
        const delay = `${Math.random() * 0.4}s`;
        const size = Math.floor(Math.random() * 8 + 6);
        return (
          <div
            key={i}
            className="absolute top-0"
            style={{
              left,
              width: size,
              height: size,
              background: color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              animation: `confettiFall ${1.2 + Math.random() * 0.8}s ease-in forwards`,
              animationDelay: delay,
            }}
          />
        );
      })}
    </div>
  );
}

function GoldPotProgress({ potBalance, threshold, progressPct, glowing }) {
  return (
    <div className="relative">
      {/* Outer track */}
      <div className="h-5 rounded-full overflow-hidden" style={{ background: "#0A0908", border: "1.5px solid #2A2320" }}>
        <div
          className="h-full rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(.4,0,.2,1)] relative overflow-hidden"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, #B8420E 0%, #FF6A1A 50%, #FFA352 100%)",
            boxShadow: glowing ? "0 0 16px rgba(255,106,26,.8)" : "none",
          }}
        >
          {/* Shimmer */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,.3) 50%,transparent 100%)",
              animation: "goldShimmer 1.8s linear infinite",
              backgroundSize: "200% 100%",
            }}
          />
        </div>
      </div>
      <div className="flex justify-between mt-1.5">
        <p className="text-[10px] text-muted">₹{potBalance.toFixed(2)} saved</p>
        <p className="text-[10px] text-muted">₹{threshold} needed</p>
      </div>
    </div>
  );
}

export function DigitalGoldScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roundUpEnabled, setRoundUpEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const prevPotRef = useRef(null);

  const load = async () => {
    try {
      const data = await GoldAPI.getSummary();
      setSummary(data);
      prevPotRef.current = data.pot_balance_paise;
    } catch { /* silent */ }
    setLoading(false);
  };

  const loadProfile = async () => {
    try {
      const profile = await AccountAPI.me();
      setRoundUpEnabled(profile?.account?.round_up_enabled ?? false);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    loadProfile();
  }, []);

  // Real-time pot updates
  useRenoSocket((evt) => {
    if (evt.type === "gold_pot_update") {
      const d = evt.data;
      setSummary((prev) => prev ? {
        ...prev,
        pot_balance: d.pot_balance,
        pot_balance_paise: d.pot_balance_paise,
        pot_progress_pct: d.pot_progress_pct,
      } : prev);

      // Glow pulse when pot increments
      setGlowing(true);
      setTimeout(() => setGlowing(false), 2000);

      // Confetti if purchase fired
      if (d.purchased) {
        setConfetti(true);
        setTimeout(() => { setConfetti(false); load(); }, 2500);
      }
    }
  });

  const handleToggleRoundUp = async () => {
    setToggling(true);
    try {
      const res = await GoldAPI.toggleRoundUp();
      setRoundUpEnabled(res.round_up_enabled);
    } finally {
      setToggling(false);
    }
  };

  const gramsValue = summary ? (summary.total_grams * summary.gold_rate_per_gram).toFixed(2) : "0.00";

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes goldPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,106,26,0.4); }
          50% { box-shadow: 0 0 24px 8px rgba(255,106,26,0.2); }
        }
        @keyframes goldShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <ConfettiBurst active={confetti} />

      <div className="min-h-screen bg-bg pb-[100px]">
        {/* Header */}
        <div className="pt-[50px] pb-4 px-[22px] flex items-center gap-3">
          <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
          <h2 className="text-[22px] font-extrabold text-textLight">Digital Gold 🪙</h2>
          <Badge color="#FF6A1A" size={9} className="ml-auto">Round-Up</Badge>
        </div>

        <div className="px-[22px] flex flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Hero Gold Vault Card */}
              <div
                className="rounded-[22px] overflow-hidden p-6 relative glow-hero"
                style={{
                  background: "linear-gradient(135deg, #151210 0%, #1a1512 60%, #201a14 100%)",
                  border: "1.5px solid rgba(255,106,26,.35)",
                  boxShadow: glowing ? "0 0 40px rgba(255,106,26,.3), 0 8px 32px rgba(0,0,0,.3)" : "0 8px 32px rgba(0,0,0,.2)",
                  animation: glowing ? "goldPulse 1.5s ease" : "none",
                }}
              >
                {/* Decorative gold coins */}
                <div className="absolute right-4 top-4 text-[42px] opacity-20 select-none">🪙</div>
                <div className="absolute right-12 bottom-4 text-[28px] opacity-15 select-none">✨</div>

                <p className="text-[10px] font-bold tracking-widest text-muted mb-1 relative z-10">DIGITAL GOLD VAULT</p>
                <div className="flex items-end gap-3 mb-1 relative z-10">
                  <p className="text-[38px] font-extrabold font-mono text-textLight leading-none">
                    {summary?.total_grams?.toFixed(4) ?? "0.0000"}
                  </p>
                  <p className="text-accent font-semibold pb-1">grams</p>
                </div>
                <p className="text-muted text-xs mb-5 relative z-10">≈ ₹{gramsValue} at current rate (₹{summary?.gold_rate_per_gram?.toLocaleString()}/g)</p>

                <p className="text-[10px] font-bold tracking-widest text-accent/70 mb-2 relative z-10">SPARE CHANGE POT</p>
                <div className="relative z-10">
                  <GoldPotProgress
                    potBalance={summary?.pot_balance ?? 0}
                    threshold={summary?.threshold ?? 200}
                    progressPct={summary?.pot_progress_pct ?? 0}
                    glowing={glowing}
                  />
                </div>

                {(summary?.pot_progress_pct ?? 0) >= 100 && (
                  <p className="text-accent text-xs font-bold text-center mt-2 animate-pulse relative z-10">🎉 Purchase triggered!</p>
                )}
              </div>

              {/* Round-Up Toggle */}
              <Card className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-textLight">Spare Change Round-Up</p>
                  <p className="text-muted text-[11px] mt-0.5">Round every payment to nearest ₹10, invest the difference</p>
                </div>
                <button
                  className="btn relative w-14 h-7 rounded-full transition-colors duration-300"
                  style={{ background: roundUpEnabled ? "#FF6A1A" : "#5C564F44" }}
                  onClick={handleToggleRoundUp}
                  disabled={toggling}
                >
                  <div
                    className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-[left] duration-300"
                    style={{ left: roundUpEnabled ? "calc(100% - 26px)" : 2 }}
                  />
                </button>
              </Card>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 text-center">
                  <p className="text-[10px] text-muted font-bold tracking-widest mb-1">TOTAL SAVED</p>
                  <p className="text-[22px] font-extrabold text-accent font-mono">{fmt(summary?.total_accumulated ?? 0)}</p>
                  <p className="text-[10px] text-muted mt-0.5">via round-ups</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-[10px] text-muted font-bold tracking-widest mb-1">NEXT PURCHASE AT</p>
                  <p className="text-[22px] font-extrabold text-accent font-mono">{fmt(summary?.threshold ?? 200)}</p>
                  <p className="text-[10px] text-muted mt-0.5">threshold</p>
                </Card>
              </div>

              {/* How it works */}
              <Card className="p-4 border-accent/20 bg-accent/[.03]">
                <p className="font-bold text-sm text-textLight mb-3">⚙️ How Round-Up Works</p>
                {[
                  { step: "1", text: "You pay ₹453 → rounds up to ₹460" },
                  { step: "2", text: "₹7 spare change goes into your Gold Pot" },
                  { step: "3", text: "Pot hits ₹200 → bulk gold purchase fires" },
                  { step: "4", text: "Gold grams credited to your vault 🎉" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3 mb-2 last:mb-0">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0 mt-0.5">{s.step}</div>
                    <p className="text-muted text-xs">{s.text}</p>
                  </div>
                ))}
              </Card>

              {/* Purchase Ledger */}
              {summary?.ledger?.length > 0 && (
                <div>
                  <p className="font-bold text-sm text-textLight mb-2">Purchase History</p>
                  {summary.ledger.map((e) => (
                    <Card key={e.id} className="p-3.5 flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-[12px] bg-accent/20 flex items-center justify-center text-lg shrink-0">🪙</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-textLight">{e.grams.toFixed(4)} g purchased</p>
                        <p className="text-muted text-[11px]">{new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <p className="font-mono text-sm font-bold text-accent">{fmt(e.amount)}</p>
                    </Card>
                  ))}
                </div>
              )}

              {summary?.ledger?.length === 0 && (
                <Card className="p-5 text-center border-dashed">
                  <p className="text-3xl mb-2">🪙</p>
                  <p className="text-textLight font-semibold text-sm">No gold purchased yet</p>
                  <p className="text-muted text-xs mt-1">Enable round-up and start transacting to fill your pot!</p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
