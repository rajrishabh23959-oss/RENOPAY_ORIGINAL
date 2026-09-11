import { useState, useEffect, useRef, useCallback } from "react";
import { GoalAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt } from "../lib/format";

/* ── Confetti Celebration ─────────────────────────────────────────────────── */
function MilestoneCelebration({ milestone, onDone }) {
  const PIECES = 24;
  const colors = ["#FF6A1A","#22C55E","#FFA352","#B8420E","#F5F3F0","#FFA000"];
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none">
      {Array.from({ length: PIECES }).map((_, i) => (
        <div key={i} className="absolute"
          style={{
            left: `${5 + Math.random() * 90}%`,
            top: 0,
            width: Math.floor(Math.random() * 10 + 5),
            height: Math.floor(Math.random() * 10 + 5),
            background: colors[i % colors.length],
            borderRadius: Math.random() > 0.4 ? "50%" : "3px",
            animation: `cFall ${1.5 + Math.random() * 1}s ease-in forwards`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        />
      ))}
      <div className="bg-card/95 rounded-2xl px-8 py-6 text-center shadow-2xl pointer-events-auto"
        style={{ border: "2px solid #FF6A1A" }}>
        <p className="text-4xl mb-2">🎉</p>
        <p className="text-xl font-extrabold text-textLight">Milestone!</p>
        <p className="text-sm text-muted mt-1">{milestone}</p>
      </div>
    </div>
  );
}

/* ── SVG Treasure Map ────────────────────────────────────────────────────── */
const MAP_WAYPOINTS = [
  { x: 30,  y: 130, item: "🌿", label: "Start" },
  { x: 100, y: 90,  item: "🏕️", label: "Camp" },
  { x: 175, y: 110, item: "🌊", label: "River" },
  { x: 240, y: 75,  item: "🌋", label: "Volcano" },
  { x: 305, y: 95,  item: "🏔️", label: "Peak" },
  { x: 365, y: 65,  item: "🌈", label: "Rainbow" },
  { x: 320, y: 130, item: "⭐", label: "Star" },
  { x: 380, y: 150, item: "💎", label: "Gem" },
  { x: 410, y: 110, item: "💰", label: "Treasure!" },
];

// Build a smooth polyline path string
function buildPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cy1 = prev.y;
    const cx2 = prev.x + (curr.x - prev.x) * 0.6;
    const cy2 = curr.y;
    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function TreasureMapSVG({ progress }) {
  // progress: 0.0 to 1.0
  const filled = Math.max(0, Math.min(1, progress));
  // Interpolate avatar position between two waypoints
  const baseIdx = Math.floor(filled * (MAP_WAYPOINTS.length - 1));
  const nextIdx = Math.min(baseIdx + 1, MAP_WAYPOINTS.length - 1);
  const frac = (filled * (MAP_WAYPOINTS.length - 1)) - baseIdx;
  const avatarX = MAP_WAYPOINTS[baseIdx].x + (MAP_WAYPOINTS[nextIdx].x - MAP_WAYPOINTS[baseIdx].x) * frac;
  const avatarY = MAP_WAYPOINTS[baseIdx].y + (MAP_WAYPOINTS[nextIdx].y - MAP_WAYPOINTS[baseIdx].y) * frac;

  const fullPath = buildPath(MAP_WAYPOINTS);
  const SVG_W = 440;
  const SVG_H = 180;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: 160 }}>
      {/* Background — dark */}
      <rect width={SVG_W} height={SVG_H} rx="12" fill="#0A0908" />
      {/* Dashed trail – unfilled */}
      <path d={fullPath} fill="none" stroke="#2A2320" strokeWidth="3" strokeDasharray="8 6" />
      {/* Filled trail */}
      <path
        d={fullPath}
        fill="none"
        stroke="#FF6A1A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2000"
        strokeDashoffset={`${(1 - filled) * 2000}`}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
      />
      {/* Waypoints */}
      {MAP_WAYPOINTS.map((pt, i) => {
        const reached = i / (MAP_WAYPOINTS.length - 1) <= filled + 0.01;
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={16}
              fill={reached ? "#FF6A1A33" : "#2A232033"}
              stroke={reached ? "#FF6A1A" : "#2A2320"}
              strokeWidth="1.5"
            />
            <text x={pt.x} y={pt.y + 5} textAnchor="middle" fontSize="14"
              style={{ filter: reached ? "none" : "grayscale(100%) opacity(0.4)" }}>
              {pt.item}
            </text>
          </g>
        );
      })}
      {/* Avatar */}
      <g style={{ transition: "transform 1.2s cubic-bezier(.4,0,.2,1)", transform: `translate(${avatarX}px, ${avatarY}px)` }}>
        <circle cx={0} cy={-22} r={12} fill="#151210" stroke="#FF6A1A" strokeWidth="2" />
        <text x={0} y={-17} textAnchor="middle" fontSize="13">🧭</text>
        <circle cx={0} cy={-22} r={16} fill="transparent" stroke="#FF6A1A"
          strokeWidth="1.5" opacity="0.5"
          style={{ animation: "mapPulse 1.8s ease infinite" }}
        />
      </g>
    </svg>
  );
}

/* ── Treasure Map Card ────────────────────────────────────────────────────── */
function TreasureMap({ goal, onAddSavings }) {
  const pct = Math.min(100, (goal.saved / goal.target) * 100);
  const [adding, setAdding] = useState(false);
  const [addAmt, setAddAmt] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState("");
  const [autoAmt, setAutoAmt] = useState(goal.auto_save_amount > 0 ? String(goal.auto_save_amount) : "");
  const [autoEnabled, setAutoEnabled] = useState(goal.auto_save_enabled);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const prevPct = useRef(pct);
  const [celebration, setCelebration] = useState(null);

  // Check milestone on progress change
  useEffect(() => {
    const milestonesPct = [25, 50, 75, 100];
    for (const mPct of milestonesPct) {
      if (pct >= mPct && prevPct.current < mPct) {
        setCelebration(`${mPct}% Milestone — ${goal.name}!`);
        break;
      }
    }
    prevPct.current = pct;
  }, [pct, goal.name]);

  const startAdd = () => {
    if (!Number(addAmt) || Number(addAmt) < 1) { setErr("Enter valid amount"); return; }
    setErr(""); setShowPin(true);
  };

  const confirmPin = async (pin) => {
    try {
      await onAddSavings(goal.id, Number(addAmt), pin);
      setAdding(false); setAddAmt(""); setErr(""); setShowPin(false);
    } catch {
      setErr("Insufficient balance or incorrect PIN");
      setShowPin(false);
    }
  };

  const handleAutoToggle = async () => {
    setTogglingAuto(true);
    try {
      await GoalAPI.setAutoSave(goal.id, !autoEnabled, Number(autoAmt) || 0);
      setAutoEnabled(!autoEnabled);
    } finally {
      setTogglingAuto(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes cFall { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(540deg);opacity:0} }
        @keyframes mapPulse { 0%,100%{r:16;opacity:.5} 50%{r:20;opacity:.2} }
      `}</style>

      {celebration && <MilestoneCelebration milestone={celebration} onDone={() => setCelebration(null)} />}

      <Card className="p-[18px] border-accent/[.27] overflow-hidden mb-4">
        {/* PIN Modal */}
        {showPin && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-6">
            <Card className="p-6 max-w-[320px] w-full border-accent/[.33]">
              <p className="text-center text-muted text-xs mb-4">Enter your UPI PIN to save {fmt(Number(addAmt))}</p>
              <PINPad onComplete={confirmPin} label="6-digit PIN" accent="#FF6A1A" />
              <button className="btn w-full mt-4 text-muted text-xs" onClick={() => setShowPin(false)}>Cancel</button>
            </Card>
          </div>
        )}

        {/* Goal Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-extrabold text-base text-textLight">{goal.icon} {goal.name}</p>
            <p className="text-muted text-[11px]">{fmt(goal.saved)} of {fmt(goal.target)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge color="#FF6A1A" size={10}>{pct.toFixed(0)}%</Badge>
            {autoEnabled && <Badge color="#22C55E" size={9}>Auto ✓</Badge>}
          </div>
        </div>

        {/* SVG Treasure Map */}
        <div className="mb-3 rounded-xl overflow-hidden border border-line" style={{ background: "#0A0908" }}>
          <TreasureMapSVG progress={pct / 100} />
        </div>

        {/* Progress bar */}
        <div className="bg-bg rounded-lg h-2 overflow-hidden mb-2.5">
          <div
            className="h-full rounded-lg transition-[width] duration-1000"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg,#B8420E,#FF6A1A,#FFA352)" }}
          />
        </div>

        {/* Milestones */}
        {goal.milestones.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {goal.milestones.map((m, i) => (
              <Badge key={i} color={goal.saved >= m ? "#FF6A1A" : "#5C564F"} size={9}>
                {goal.saved >= m ? "✓" : ""} {fmt(m)}
              </Badge>
            ))}
          </div>
        )}

        {/* Auto-save toggle */}
        <div className="bg-bg rounded-xl p-3 mb-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-textLight text-xs font-semibold">Daily Auto-Save</p>
            <input
              type="number"
              placeholder="Amount (₹/day)"
              value={autoAmt}
              onChange={(e) => setAutoAmt(e.target.value)}
              className="mt-1 text-xs py-1.5 px-2.5 rounded-lg"
            />
          </div>
          <button
            className="btn relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0"
            style={{ background: autoEnabled ? "#FF6A1A" : "#5C564F44" }}
            onClick={handleAutoToggle}
            disabled={togglingAuto}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] duration-300"
              style={{ left: autoEnabled ? "calc(100% - 22px)" : 2 }}
            />
          </button>
        </div>

        {/* Manual save */}
        {adding ? (
          <div>
            <div className="flex gap-2 items-center mb-2">
              <span className="text-accent text-xl">₹</span>
              <input type="number" placeholder="Amount to save" value={addAmt}
                onChange={(e) => setAddAmt(e.target.value)} className="flex-1 text-base font-semibold" />
            </div>
            {err && <p className="text-danger text-[11px] mb-1.5">{err}</p>}
            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1 py-2.5" onClick={() => setAdding(false)}>Cancel</Btn>
              <Btn className="flex-1 py-2.5" onClick={startAdd}>Save →</Btn>
            </div>
          </div>
        ) : (
          <Btn className="py-2.5" onClick={() => setAdding(true)}>+ Add Savings</Btn>
        )}
      </Card>
    </>
  );
}

/* ── Main SavingsScreen ───────────────────────────────────────────────────── */
export function SavingsScreen({ onBack, onNavigate }) {
  const [goals, setGoals] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "🎯", target: "" });
  const [err, setErr] = useState("");

  const load = useCallback(() =>
    GoalAPI.list().then((res) => setGoals(res.data || res)).catch(console.error),
  []);
  useEffect(() => { load(); }, [load]);

  const addGoal = async () => {
    if (!form.name || !Number(form.target)) { setErr("Fill all fields"); return; }
    setErr("");
    await GoalAPI.create(form.name, form.icon, Number(form.target));
    await load();
    setShowNew(false);
    setForm({ name: "", icon: "🎯", target: "" });
  };

  const handleAdd = async (goalId, amount, pin) => {
    await GoalAPI.addSavings(goalId, amount, pin);
    await load();
  };

  const ICONS2 = ["📱","✈️","🚗","🏠","💻","📷","🎸","🎓","🌴","🎯"];

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Savings Goals 🗺️</h2>
        {onNavigate && (
          <button className="btn ml-auto text-accent text-xs font-semibold" onClick={() => onNavigate("vaults")}>
            Shared Vaults 🏖️ →
          </button>
        )}
      </div>
      <div className="px-[22px]">
        {goals.map((g) => <TreasureMap key={g.id} goal={g} onAddSavings={handleAdd} />)}
        {goals.length === 0 && !showNew && (
          <div className="py-12 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-textLight font-semibold text-lg">No goals yet</p>
            <p className="text-muted text-sm mt-1">Create your first savings goal and watch your avatar travel the map!</p>
          </div>
        )}
        {showNew ? (
          <Card className="p-[18px] mt-3 border-accent/[.27]">
            <p className="font-bold text-accent text-sm mb-3.5">🗺️ New Savings Goal</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ICONS2.map((ic) => (
                <button key={ic} className="btn p-2 rounded-[10px] text-lg"
                  style={{ background: form.icon === ic ? "#FF6A1A22" : "#151210", border: `1px solid ${form.icon === ic ? "#FF6A1A" : "#2A2320"}` }}
                  onClick={() => setForm((f) => ({ ...f, icon: ic }))}>
                  {ic}
                </button>
              ))}
            </div>
            <input placeholder="Goal name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mb-2.5" />
            <input type="number" placeholder="Target amount (₹)" value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} className="mb-2.5" />
            {err && <p className="text-danger text-xs mb-2">{err}</p>}
            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={addGoal}>Create Goal</Btn>
            </div>
          </Card>
        ) : (
          <button
            className="btn w-full py-[13px] rounded-[14px] bg-transparent border-[1.5px] border-dashed border-accent/[.33] text-accent text-[13px] font-semibold mt-3"
            onClick={() => setShowNew(true)}>
            + New Savings Goal
          </button>
        )}
      </div>
    </div>
  );
}
