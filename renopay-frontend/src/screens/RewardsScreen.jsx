import { useState, useEffect, useRef } from "react";
import { RewardAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Badge, Btn } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt } from "../lib/format";

function formatIST(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}

function InteractiveScratchCard({ card, onScratch }) {
  const [done, setDone] = useState(card.scratched);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (done) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#2A2320";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Shimmer pattern
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#2A2320");
    grad.addColorStop(0.5, "#3D2E1E");
    grad.addColorStop(1, "#2A2320");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,106,26,0.4)";
    ctx.font = "bold 13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH TO REVEAL", canvas.width / 2, canvas.height / 2 - 8);
    ctx.fillText("YOUR REWARD →", canvas.width / 2, canvas.height / 2 + 12);
  }, [done]);

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const cl = e.touches ? e.touches[0] : e;
    return { x: cl.clientX - r.left, y: cl.clientY - r.top };
  };

  const scratch = (e) => {
    if (done || !isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 128) transparent++;
    }
    if (transparent / (canvas.width * canvas.height) > 0.52 && !done) {
      setDone(true);
      onScratch(card.id);
    }
  };

  return (
    <Card
      className="p-5 text-center relative overflow-hidden mb-3.5 border-accent/40 hover:border-accent/70 transition-all shadow-md"
      style={{ border: `1.5px solid ${done ? "#FF6A1A66" : "#FF6A1A55"}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">
          {card.reward_type === "cashback" ? "Cashback Reward" : "Digital Gold Reward"}
        </p>
        <span className="text-[10px] text-muted">{formatIST(card.created_at)}</span>
      </div>

      <div className="relative rounded-xl overflow-hidden h-[110px] flex items-center justify-center bg-bg border border-line shadow-inner">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-[#241a15] to-[#161210]">
          <span className="text-3xl animate-bounce">{card.reward_type === "cashback" ? "💰" : "🪙"}</span>
          <p className="font-mono font-extrabold text-2xl text-accent tracking-wide">{card.label}</p>
          <p className="text-[11px] text-muted">
            {card.reward_type === "cashback"
              ? card.is_withdrawn
                ? "Withdrawn to Bank Balance"
                : "Unlocked • Ready to Withdraw"
              : "Deposited to Gold"}
          </p>
        </div>

        {!done && (
          <canvas
            ref={canvasRef}
            width={320}
            height={110}
            className="absolute inset-0 w-full h-full cursor-crosshair rounded-xl touch-none"
            onMouseDown={(e) => {
              isDrawing.current = true;
              scratch(e);
            }}
            onMouseMove={scratch}
            onMouseUp={() => (isDrawing.current = false)}
            onTouchStart={(e) => {
              isDrawing.current = true;
              scratch(e);
            }}
            onTouchMove={scratch}
            onTouchEnd={() => (isDrawing.current = false)}
          />
        )}
      </div>

      {done ? (
        <p className="text-accent font-bold text-xs mt-2.5 flex items-center justify-center gap-1.5">
          <span>✨</span>
          {card.reward_type === "cashback"
            ? card.is_withdrawn
              ? "Already transferred to your main bank balance"
              : "Added to Available Rewards! Click Withdraw to transfer to Bank."
            : "Deposited to your Digital Gold vault"}
        </p>
      ) : (
        <p className="text-muted text-[11px] mt-2 animate-pulse">👆 Drag or swipe your finger across to scratch!</p>
      )}
    </Card>
  );
}

export function RewardsScreen({ onBack }) {
  const { profile, refreshProfile } = useAuth();
  const [summary, setSummary] = useState({
    total_received: 0,
    available_balance: 0,
    withdrawn_total: 0,
    unscratched_count: 0,
    cards: [],
  });
  const [loading, setLoading] = useState(true);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // all | unscratched | available | withdrawn

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await RewardAPI.summary();
      setSummary(res);
    } catch (e) {
      console.warn("Could not load reward summary:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const doScratch = async (cardId) => {
    try {
      await RewardAPI.scratch(cardId);
      await loadSummary();
      await refreshProfile?.();
    } catch (e) {
      console.error("Scratch error:", e);
    }
  };

  const handleWithdrawPinSubmit = async (pin) => {
    setWithdrawError("");
    setWithdrawing(true);
    try {
      const res = await RewardAPI.withdraw(pin);
      setWithdrawModalOpen(false);
      setSuccessModal({
        amount: res.withdrawn_amount,
        newBalance: res.new_balance,
        message: res.message || `₹${res.withdrawn_amount} added to your main balance!`,
      });
      await loadSummary();
      await refreshProfile?.();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Incorrect UPI PIN or withdrawal failed";
      setWithdrawError(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
    } finally {
      setWithdrawing(false);
    }
  };

  const unscratchedCards = summary.cards.filter((c) => !c.scratched);
  const availableCards = summary.cards.filter((c) => c.scratched && !c.is_withdrawn && c.reward_type === "cashback");
  const withdrawnCards = summary.cards.filter((c) => c.scratched && c.is_withdrawn);

  const displayedCards =
    activeTab === "unscratched"
      ? unscratchedCards
      : activeTab === "available"
      ? availableCards
      : activeTab === "withdrawn"
      ? withdrawnCards
      : summary.cards;

  return (
    <div className="min-h-screen bg-bg pb-[100px] text-textLight">
      {/* Top App Bar */}
      <div className="pt-[50px] pb-[16px] px-[22px] flex items-center justify-between border-b border-line bg-bg/95 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2 text-base hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
            onClick={onBack}
          >
            ←
          </button>
          <div>
            <h2 className="text-[20px] font-extrabold text-textLight leading-tight flex items-center gap-1.5">
              Rewards & Cashback <span>🎰</span>
            </h2>
            <p className="text-[11px] text-muted">Earn 1%–2% up to ₹5 on payments of ₹100+</p>
          </div>
        </div>
      </div>

      <div className="px-[20px] pt-4">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          {/* Total Reward Received */}
          <Card className="p-3.5 border-accent/30 bg-card dark:bg-gradient-to-br dark:from-[#271d17] dark:to-[#1a1512]">
            <p className="text-muted text-[10px] uppercase font-bold tracking-wider mb-1">Total Received</p>
            <p className="font-mono text-xl font-extrabold text-[#FF8542]">
              {fmt(summary.total_received)}
            </p>
            <p className="text-[10px] text-muted mt-1">All-time cashback earned</p>
          </Card>

          {/* Withdrawn to Bank */}
          <Card className="p-3.5 border-line bg-card">
            <p className="text-muted text-[10px] uppercase font-bold tracking-wider mb-1">Transferred to Bank</p>
            <p className="font-mono text-xl font-extrabold text-success">
              {fmt(summary.withdrawn_total)}
            </p>
            <p className="text-[10px] text-muted mt-1">Added to main balance</p>
          </Card>
        </div>

        {/* Digital Gold Info */}
        <div className="p-3 mb-3.5 rounded-2xl bg-card border border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🪙</span>
            <div>
              <p className="font-bold text-textLight text-xs">Digital Gold Vault</p>
              <p className="text-muted text-[10px]">Auto-saved & gold rewards</p>
            </div>
          </div>
          <span className="font-mono font-bold text-accent text-sm">
            {fmt(profile?.account?.digital_gold ?? 0)}
          </span>
        </div>

        {/* Available to Withdraw Banner & Action Card */}
        <Card className="p-4 sm:p-5 mb-5 border-accent bg-card dark:bg-gradient-to-b dark:from-[#2E1E14] dark:via-[#211611] dark:to-[#1A120E] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span className="text-xs font-extrabold uppercase tracking-wide text-textLight">Available to Withdraw</span>
            </div>
            {summary.available_balance > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/20 text-success border border-success/30 animate-pulse">
                Ready to Bank
              </span>
            )}
          </div>

          <div className="my-2">
            <span className="text-3xl sm:text-4xl font-mono font-black text-textLight tracking-tight">
              {fmt(summary.available_balance)}
            </span>
            <p className="text-[11px] text-muted mt-1">
              Unlocked rewards that can be withdrawn into your primary bank balance.
            </p>
          </div>

          <div className="mt-4">
            <button
              type="button"
              disabled={summary.available_balance <= 0 || withdrawing}
              onClick={() => {
                setWithdrawError("");
                setWithdrawModalOpen(true);
              }}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                summary.available_balance > 0
                  ? "bg-accent hover:brightness-110 text-white shadow-accentGlow active:scale-[0.98]"
                  : "bg-surf border border-line text-muted/50 cursor-not-allowed"
              }`}
            >
              <span>💸</span>
              <span>Withdraw Rewards to Main Balance</span>
            </button>
          </div>

          {summary.available_balance <= 0 && (
            <p className="text-center text-[10px] text-muted mt-2">
              Make a payment of ₹100 or more to get 1%–2% reward scratch cards!
            </p>
          )}
        </Card>

        {/* Unscratched Cards Section */}
        {unscratchedCards.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-textLight flex items-center gap-1.5">
                <span>🎁</span> Unscratched Cards ({unscratchedCards.length})
              </h3>
              <span className="text-[11px] text-accent font-semibold animate-pulse">Scratch now!</span>
            </div>
            {unscratchedCards.map((c) => (
              <InteractiveScratchCard key={c.id} card={c} onScratch={doScratch} />
            ))}
          </div>
        )}

        {/* All Reward Transactions & History */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-textLight flex items-center gap-2">
              <span>📋</span> All Reward Transactions
            </h3>
            <span className="text-xs text-muted font-mono">{summary.cards.length} Total</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 p-1 bg-card rounded-xl border border-line mb-3.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: `All (${summary.cards.length})` },
              { id: "available", label: `Ready (${availableCards.length})` },
              { id: "withdrawn", label: `Withdrawn (${withdrawnCards.length})` },
              { id: "unscratched", label: `Unscratched (${unscratchedCards.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === t.id
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-textLight"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Cards List */}
          {displayedCards.length === 0 ? (
            <Card className="p-8 text-center text-muted">
              <p className="text-3xl mb-2">🎰</p>
              <p className="text-xs font-bold text-textLight">No transactions in this category</p>
              <p className="text-[11px] text-muted mt-1">
                Pay ₹100 or more on any transaction to earn instant rewards!
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {displayedCards.map((card) => {
                const isCashback = card.reward_type === "cashback";
                const isWithdrawn = card.is_withdrawn;
                const isScratched = card.scratched;

                return (
                  <Card
                    key={card.id}
                    className="p-3.5 flex items-center justify-between gap-3 border-line hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          isWithdrawn
                            ? "bg-success/20 border border-success/30 text-success"
                            : isScratched
                            ? "bg-accent/20 border border-accent/30 text-accent"
                            : "bg-warn/20 border border-warn/30 text-warn"
                        }`}
                      >
                        {isWithdrawn ? "💸" : isCashback ? "💰" : "🪙"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-textLight truncate">
                          {card.label || (isCashback ? "Cashback Reward" : "Gold Reward")}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">
                          {formatIST(card.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`font-mono font-bold text-sm ${
                          isWithdrawn ? "text-success" : "text-accent"
                        }`}
                      >
                        +{fmt(card.reward_amount)}
                      </p>
                      <div className="mt-1">
                        {!isScratched ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-warn/20 text-warn border border-warn/30">
                            Unscratched
                          </span>
                        ) : isWithdrawn ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-success/20 text-success border border-success/30">
                            Withdrawn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-accent/20 text-accent border border-accent/30">
                            Available
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Modal with UPI PIN Pad */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeUp">
          <div className="bg-card border border-accent/40 rounded-3xl p-5 w-full max-w-sm relative shadow-2xl">
            <button
              type="button"
              className="absolute top-4 right-4 text-muted hover:text-textLight text-lg cursor-pointer"
              onClick={() => {
                setWithdrawModalOpen(false);
                setWithdrawError("");
              }}
            >
              ✕
            </button>

            <div className="text-center mb-4">
              <span className="text-3xl">🏧</span>
              <h3 className="text-lg font-extrabold text-textLight mt-1">Withdraw Rewards</h3>
              <p className="text-xs text-muted">
                Transferring <span className="font-mono font-bold text-accent">{fmt(summary.available_balance)}</span> directly to your main balance
              </p>
            </div>

            {withdrawError && (
              <div className="p-3 mb-4 rounded-xl bg-danger/20 border border-danger/40 text-danger text-xs text-center font-bold animate-shake">
                {withdrawError}
              </div>
            )}

            <PINPad
              label="Enter your 6-digit UPI PIN to confirm withdrawal"
              actionType="withdraw"
              actionLabel={withdrawing ? "Processing…" : "Withdraw"}
              onComplete={handleWithdrawPinSubmit}
            />

            <button
              type="button"
              className="w-full mt-3 py-2 text-xs font-semibold text-muted hover:text-textLight cursor-pointer"
              onClick={() => {
                setWithdrawModalOpen(false);
                setWithdrawError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success Celebration Modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeUp">
          <div className="bg-card border border-success/40 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-success/20 border border-success/40 flex items-center justify-center text-3xl mx-auto mb-3 animate-bounce">
              ✓
            </div>
            <h3 className="text-xl font-black text-textLight">Withdrawal Successful!</h3>
            <p className="text-2xl font-mono font-black text-success my-2">
              +{fmt(successModal.amount)}
            </p>
            <p className="text-xs text-textLight px-2 mb-4">
              {successModal.message}
            </p>
            <div className="p-3 bg-surf rounded-xl border border-line mb-5 text-xs text-muted flex justify-between">
              <span>Updated Main Balance:</span>
              <span className="font-mono font-bold text-textLight">{fmt(successModal.newBalance)}</span>
            </div>
            <Btn
              onClick={() => setSuccessModal(null)}
              className="w-full bg-accent text-white font-bold"
            >
              Done
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
