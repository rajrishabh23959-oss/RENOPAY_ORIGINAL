import { useState, useMemo } from "react";
import "./cashBalanceCard.css";
import { fmt } from "../lib/format";

// Real currency photograph assets
import note500Img from "../assets/currency/note_500.png";
import note200Img from "../assets/currency/note_200.png";
import note100Img from "../assets/currency/note_100.png";
import note50Img from "../assets/currency/note_50.png";
import note20Img from "../assets/currency/note_20.png";
import note10Img from "../assets/currency/note_10.png";
import coin2Img from "../assets/currency/coin_2.png";
import coin1Img from "../assets/currency/coin_1.png";

const NOTE_SPECS = [
  { value: 500, label: "₹ 500", img: note500Img },
  { value: 200, label: "₹ 200", img: note200Img },
  { value: 100, label: "₹ 100", img: note100Img },
  { value: 50,  label: "₹ 50",  img: note50Img },
  { value: 20,  label: "₹ 20",  img: note20Img },
  { value: 10,  label: "₹ 10",  img: note10Img },
  { value: 5,   label: "₹ 5",   img: null },
];

const COIN_SPECS = [
  { value: 2, label: "₹ 2", img: coin2Img },
  { value: 1, label: "₹ 1", img: coin1Img },
];

// Helper to compute a clean breakdown if backend denominations not provided
function calculateFallbackDenominations(amount) {
  const denoms = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  let rem = Math.max(0, Math.floor(amount));
  const counts = {};
  for (const d of denoms) {
    counts[d] = Math.floor(rem / d);
    rem %= d;
  }
  return counts;
}

export function CashBalanceCard({
  balance = 0,
  vpa = "user@renopay",
  bank = "RenoPay Bank",
  show = true,
  onToggle,
  denominations = null,
}) {
  const [viewMode, setViewMode] = useState("normal"); // "normal" | "advanced"

  // Use live denominations from backend or compute fallback
  const counts = useMemo(() => {
    if (denominations && Object.keys(denominations).length > 0) {
      return denominations;
    }
    return calculateFallbackDenominations(balance);
  }, [denominations, balance]);

  // Compute total cash from notes + coins
  const totalCashAmount = useMemo(() => {
    let total = 0;
    for (const [val, count] of Object.entries(counts)) {
      total += Number(val) * Number(count || 0);
    }
    return total > 0 ? total : balance;
  }, [counts, balance]);

  return (
    <div className="cbc-card">
      {/* ── Segmented Toggle (Normal View | Advanced View) ── */}
      <div className="cbc-toggle-bar">
        <button
          className={`cbc-toggle-tab ${viewMode === "normal" ? "active" : ""}`}
          onClick={() => setViewMode("normal")}
          type="button"
        >
          <span>💳</span> Normal View
        </button>
        <button
          className={`cbc-toggle-tab ${viewMode === "advanced" ? "active" : ""}`}
          onClick={() => setViewMode("advanced")}
          type="button"
        >
          <span>💵</span> Advanced View
        </button>
      </div>

      {/* ════════════════════════════════════════════════
         VIEW CONTAINER
         ════════════════════════════════════════════════ */}
      <div className="cbc-view-wrap">
        {viewMode === "normal" ? (
          /* ── NORMAL VIEW: Clean Amount Focus ── */
          <div className="cbc-normal-box">
            <div className="cbc-acc-meta">
              <div className="cbc-bank-badge">
                <span className="cbc-bank-icon">🏛️</span>
                <span>{bank}</span>
              </div>
              <span className="cbc-vpa-pill">{vpa}</span>
            </div>

            <div className="cbc-balance-header">
              <span className="cbc-balance-caption">Available Balance</span>
              <button
                className="cbc-eye-toggle"
                onClick={onToggle}
                type="button"
                title={show ? "Hide balance" : "Show balance"}
              >
                {show ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>

            <div className="cbc-amount-display">
              {show ? (
                <>
                  <span className="rupee">₹</span>
                  {Number(balance).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </>
              ) : (
                "••••••••"
              )}
            </div>

            <div className="cbc-normal-footer">
              <div className="cbc-status-tag">
                <div className="cbc-status-dot" />
                <span>Active & Verified</span>
              </div>
              <button
                className="cbc-switch-hint"
                onClick={() => setViewMode("advanced")}
                type="button"
              >
                View Cash Breakdown →
              </button>
            </div>
          </div>
        ) : (
          /* ── ADVANCED VIEW: Detailed Denomination Table ── */
          <div className="cbc-advanced-box">
            <div className="cbc-adv-header">
              <div className="cbc-adv-title">
                <span>🧾</span> Cash Breakdown
              </div>
              <div className="cbc-adv-total-chip">
                {show ? fmt(totalCashAmount) : "••••"}
              </div>
            </div>

            {/* ── By Denomination (Notes) ── */}
            <div className="cbc-table-section-title">
              <span>💵</span> By Denomination (Notes)
            </div>

            <div className="cbc-table-head">
              <span className="cbc-th-denom">Denomination</span>
              <span className="cbc-th-count">Count</span>
              <span className="cbc-th-total">Total Amount</span>
            </div>

            <div className="cbc-table-body">
              {NOTE_SPECS.map((n) => {
                const count = Number(counts[n.value] || counts[String(n.value)] || 0);
                const rowTotal = count * n.value;
                return (
                  <div key={n.value} className="cbc-row">
                    <div className="cbc-cell-denom">
                      {n.img ? (
                        <img
                          src={n.img}
                          alt={n.label}
                          className="cbc-note-thumb"
                          draggable={false}
                        />
                      ) : (
                        <div className="cbc-note-fallback">₹5</div>
                      )}
                      <span className="cbc-denom-name">{n.label}</span>
                    </div>
                    <div className="cbc-cell-count">{count}</div>
                    <div className="cbc-cell-total">₹ {rowTotal.toLocaleString("en-IN")}</div>
                  </div>
                );
              })}
            </div>

            {/* ── Coins Table ── */}
            <div className="cbc-table-section-title" style={{ marginTop: 14 }}>
              <span>🪙</span> Coins
            </div>

            <div className="cbc-table-head">
              <span className="cbc-th-denom">Denomination</span>
              <span className="cbc-th-count">Count</span>
              <span className="cbc-th-total">Total Amount</span>
            </div>

            <div className="cbc-table-body">
              {COIN_SPECS.map((c) => {
                const count = Number(counts[c.value] || counts[String(c.value)] || 0);
                const rowTotal = count * c.value;
                return (
                  <div key={c.value} className="cbc-row">
                    <div className="cbc-cell-denom">
                      {c.img ? (
                        <img
                          src={c.img}
                          alt={c.label}
                          className="cbc-coin-thumb"
                          draggable={false}
                        />
                      ) : (
                        <span style={{ fontSize: 16 }}>🪙</span>
                      )}
                      <span className="cbc-denom-name">{c.label}</span>
                    </div>
                    <div className="cbc-cell-count">{count}</div>
                    <div className="cbc-cell-total">₹ {rowTotal.toLocaleString("en-IN")}</div>
                  </div>
                );
              })}
            </div>

            {/* ── Highlighted Total Cash Row ── */}
            <div className="cbc-total-row">
              <div className="cbc-total-label">
                <span>💰</span> Total Cash
              </div>
              <div className="cbc-total-amount">
                ₹ {Number(totalCashAmount).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
