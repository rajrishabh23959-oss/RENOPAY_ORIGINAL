import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "./noteSlider.css";

// Original currency photograph assets provided by user
import note500Img from "../assets/currency/note_500.webp";
import note200Img from "../assets/currency/note_200.webp";
import note100Img from "../assets/currency/note_100.webp";
import note50Img from "../assets/currency/note_50.webp";
import note20Img from "../assets/currency/note_20.webp";
import note10Img from "../assets/currency/note_10.webp";

import coin5Img from "../assets/currency/coin_5.webp";
import coin2Img from "../assets/currency/coin_2.webp";
import coin1Img from "../assets/currency/coin_1.webp";

/* ──────────────────────────────────────────────────
   Currency Denominations using original photographs
   ────────────────────────────────────────────────── */
const NOTES = [
  { value: 500, label: "₹500", img: note500Img, name: "Five Hundred Rupee Note" },
  { value: 200, label: "₹200", img: note200Img, name: "Two Hundred Rupee Note" },
  { value: 100, label: "₹100", img: note100Img, name: "One Hundred Rupee Note" },
  { value: 50,  label: "₹50",  img: note50Img,  name: "Fifty Rupee Note" },
  { value: 20,  label: "₹20",  img: note20Img,  name: "Twenty Rupee Note" },
  { value: 10,  label: "₹10",  img: note10Img,  name: "Ten Rupee Note" },
];

const COINS = [
  { value: 5, label: "₹5", img: coin5Img, name: "Five Rupee Coin" },
  { value: 2, label: "₹2", img: coin2Img, name: "Two Rupee Coin" },
  { value: 1, label: "₹1", img: coin1Img, name: "One Rupee Coin" },
];

/* ──────────────────────────────────────────────────
   Sub-component: NoteCard (Real Currency Photograph)
   ────────────────────────────────────────────────── */
function NoteCard({ note, onPointerDown, isDimmed, noteFilter, style }) {
  return (
    <div
      className={`ns-note ${isDimmed ? "ns-dimmed" : ""}`}
      style={{ filter: noteFilter, ...style }}
      onPointerDown={onPointerDown}
      title={note.name}
    >
      <img
        src={note.img}
        alt={note.name}
        className="ns-note-img"
        draggable={false}
      />
      <span className="ns-note-badge">{note.label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Sub-component: CoinButton (Real Coin Photograph)
   ────────────────────────────────────────────────── */
function CoinButton({ coin, onTap }) {
  const [bouncing, setBouncing] = useState(false);

  const handleTap = () => {
    onTap(coin.value);
    setBouncing(true);
    try { navigator.vibrate?.(12); } catch { /* unsupported */ }
    setTimeout(() => setBouncing(false), 300);
  };

  return (
    <button
      className={`ns-coin ${bouncing ? "ns-coin-bounce" : ""}`}
      onClick={handleTap}
      type="button"
      title={coin.name}
    >
      <img
        src={coin.img}
        alt={coin.name}
        className="ns-coin-img"
        draggable={false}
      />
      <span className="ns-coin-badge">{coin.label}</span>
    </button>
  );
}

/* ══════════════════════════════════════════════════
   NoteSlider — main component
   ══════════════════════════════════════════════════ */
export function NoteSlider({ onAmountChange, recipientName, recipientVpa }) {
  /* ── state ─────────────────────────────────────── */
  const [denomCounts, setDenomCounts] = useState({});
  const [history, setHistory] = useState([]);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isNearDrop, setIsNearDrop] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [shaking, setShaking] = useState(false);

  /* ── refs (for stable access inside event listeners) */
  const dropZoneRef = useRef(null);
  const activeDragRef = useRef(null);
  const isNearDropRef = useRef(false);
  const prevTotalRef = useRef(0);

  /* ── derived ───────────────────────────────────── */
  const total = useMemo(
    () => Object.entries(denomCounts).reduce((s, [v, c]) => s + Number(v) * c, 0),
    [denomCounts],
  );

  const anxietyLevel = Math.min(1, Math.max(0, (total - 5000) / 5000));
  const isAnxious = total > 5000;

  /* ── sync total → parent ───────────────────────── */
  useEffect(() => {
    onAmountChange(total);
  }, [total, onAmountChange]);

  /* ── haptic helper ─────────────────────────────── */
  const vibrate = useCallback((ms) => {
    try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
  }, []);

  /* ── add denomination ──────────────────────────── */
  const addDenom = useCallback(
    (value) => {
      setDenomCounts((prev) => ({ ...prev, [value]: (prev[value] || 0) + 1 }));
      setHistory((prev) => [...prev, value]);

      // Haptic scales with accumulated total
      const newTotal = prevTotalRef.current + value;
      const hapticMs = Math.min(200, 15 + newTotal / 40);
      vibrate(Math.round(hapticMs));

      // Trigger anxiety shake on first crossing ₹5,000
      if (prevTotalRef.current <= 5000 && newTotal > 5000) {
        setShaking(true);
        setTimeout(() => setShaking(false), 420);
      }
    },
    [vibrate],
  );

  // keep prevTotalRef in sync
  useEffect(() => { prevTotalRef.current = total; }, [total]);

  /* ── float-up "+₹X" ────────────────────────────── */
  const addFloater = useCallback((value) => {
    const id = Date.now() + Math.random();
    setFloaters((prev) => [...prev, { id, value }]);
    setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== id)), 800);
  }, []);

  /* ── undo last ─────────────────────────────────── */
  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setDenomCounts((prev) => {
      const next = { ...prev };
      next[last] = Math.max(0, (next[last] || 0) - 1);
      if (next[last] === 0) delete next[last];
      return next;
    });
    setHistory((prev) => prev.slice(0, -1));
  }, [history]);

  /* ── clear all ─────────────────────────────────── */
  const clearAll = useCallback(() => {
    setDenomCounts({});
    setHistory([]);
  }, []);

  /* ════════════════════════════════════════════════
     Drag handling — pointer events (works touch + mouse)
     ════════════════════════════════════════════════ */
  const handleNotePointerDown = useCallback((e, noteValue) => {
    e.preventDefault();
    const info = { value: noteValue, startX: e.clientX, startY: e.clientY };
    setActiveDrag(info);
    activeDragRef.current = info;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!activeDrag) return;

    const handleMove = (e) => {
      e.preventDefault();
      setDragPos({ x: e.clientX, y: e.clientY });

      if (dropZoneRef.current) {
        const rect = dropZoneRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        const near = dist < 90;
        isNearDropRef.current = near;
        setIsNearDrop(near);
      }
    };

    const handleUp = (e) => {
      if (activeDragRef.current) {
        const startX = activeDragRef.current.startX ?? e.clientX;
        const startY = activeDragRef.current.startY ?? e.clientY;
        const distMoved = Math.hypot((e.clientX ?? startX) - startX, (e.clientY ?? startY) - startY);
        // Dropped near recipient zone OR quick tap without dragging
        if (isNearDropRef.current || distMoved < 10) {
          addDenom(activeDragRef.current.value);
          addFloater(activeDragRef.current.value);
        }
      }
      activeDragRef.current = null;
      isNearDropRef.current = false;
      setActiveDrag(null);
      setIsNearDrop(false);
    };

    document.addEventListener("pointermove", handleMove, { passive: false });
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);

    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };
  }, [activeDrag, addDenom, addFloater]);

  /* ── visual anxiety helpers ────────────────────── */
  // Visual anxiety: real currency notes fade & shift towards dark red
  const noteFilter = isAnxious
    ? `hue-rotate(${-anxietyLevel * 30}deg) saturate(${1 - anxietyLevel * 0.35}) brightness(${1 - anxietyLevel * 0.15})`
    : "none";

  // Interpolate accent orange → danger red
  const r = Math.round(255 - anxietyLevel * 35);   // 255 → 220
  const g = Math.round(106 - anxietyLevel * 68);   // 106 → 38
  const b = Math.round(26  + anxietyLevel * 12);   //  26 → 38
  const totalColor = `rgb(${r}, ${g}, ${b})`;

  /* ── sorted breakdown ──────────────────────────── */
  const activeDenoms = Object.entries(denomCounts)
    .filter(([, c]) => c > 0)
    .sort(([a], [b_]) => Number(b_) - Number(a));

  /* ════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════ */
  return (
    <div className="ns-container">
      {/* ── Total display ─────────────────────────── */}
      <div
        className={`ns-total-card bg-card border border-line ${isAnxious ? "ns-anxious" : "ns-normal"} ${shaking ? "ns-shake" : ""}`}
      >
        <div className="ns-total-amount" style={{ color: totalColor }}>
          ₹{total.toLocaleString("en-IN")}
        </div>
        <div className="ns-total-label">
          {total === 0 ? "Drag notes or tap coins to add" : `Paying ${recipientName}`}
        </div>
        {total > 10000 && (
          <div className="ns-high-spend-hint">
            💡 Consider using Keypad for large amounts
          </div>
        )}
      </div>

      {/* ── Denomination breakdown ────────────────── */}
      {activeDenoms.length > 0 && (
        <div className="ns-breakdown">
          {activeDenoms.map(([val, count]) => (
            <span key={val} className="ns-badge">
              {count}×₹{val}
            </span>
          ))}
        </div>
      )}

      {/* ── Drop zone ─────────────────────────────── */}
      <div
        ref={dropZoneRef}
        className={`ns-drop-zone ${isNearDrop ? "ns-drop-active" : ""}`}
      >
        <div className="ns-drop-avatar">👤</div>
        <div className="ns-drop-text">
          {isNearDrop ? "Release to add!" : "Drag notes here to pay"}
        </div>
        <div className="ns-drop-text" style={{ fontSize: 10, marginTop: 2 }}>
          {recipientName} · {recipientVpa}
        </div>

        {/* Floating "+₹X" texts */}
        <div className="ns-floater-container">
          {floaters.map((f) => (
            <div key={f.id} className="ns-floater">
              +₹{f.value}
            </div>
          ))}
        </div>
      </div>

      {/* ── Note wallet (draggable / tappable) ──── */}
      <p className="ns-section-label">💵 Notes — drag to recipient or tap</p>
      <div className="ns-note-grid">
        {NOTES.map((note, i) => (
          <NoteCard
            key={note.value}
            note={note}
            isDimmed={!!activeDrag && activeDrag.value !== note.value}
            noteFilter={noteFilter}
            onPointerDown={(e) => handleNotePointerDown(e, note.value)}
            style={{ animationDelay: `${i * 0.04}s` }}
          />
        ))}
      </div>

      {/* ── Coin tray (tappable) ──────────────────── */}
      <p className="ns-section-label">🪙 Coins — tap to add</p>
      <div className="ns-coin-tray">
        {COINS.map((coin) => (
          <CoinButton
            key={coin.value}
            coin={coin}
            onTap={(value) => {
              addDenom(value);
              addFloater(value);
            }}
          />
        ))}
      </div>

      {/* ── Undo / Clear controls ─────────────────── */}
      <div className="ns-controls">
        <button
          type="button"
          className="ns-ctrl-btn"
          onClick={undoLast}
          disabled={history.length === 0}
        >
          ↩ Undo
        </button>
        <button
          type="button"
          className="ns-ctrl-btn"
          onClick={clearAll}
          disabled={history.length === 0}
        >
          ✕ Clear All
        </button>
      </div>

      {/* ── Drag ghost (follows pointer) ──────────── */}
      {activeDrag && (() => {
        const note = NOTES.find((n) => n.value === activeDrag.value);
        if (!note) return null;
        return (
          <div
            className={`ns-note ns-ghost ${isNearDrop ? "ns-ghost-near" : ""}`}
            style={{
              left: dragPos.x - 65,
              top: dragPos.y - 32,
              width: 130,
              height: 60,
              filter: noteFilter,
            }}
          >
            <img
              src={note.img}
              alt={note.name}
              className="ns-note-img"
              draggable={false}
            />
            <span className="ns-note-badge">{note.label}</span>
          </div>
        );
      })()}
    </div>
  );
}
