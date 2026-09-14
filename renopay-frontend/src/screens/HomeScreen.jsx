import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useRenoSocket } from "../hooks/useRenoSocket";
import { PaymentAPI, AnalyticsAPI, RequestAPI, RewardAPI } from "../lib/api";
import { CashBalanceCard } from "../components/CashBalanceCard";
import { HeartbeatGauge } from "../components/HeartbeatGauge";
import { Badge, TrustBadge, Card } from "../components/ui";
import { fmt, ago } from "../lib/format";

import iconPay from "../assets/actions/pay.png";
import iconRequests from "../assets/actions/requests.png";
import iconSplit from "../assets/actions/split.png";
import iconSubs from "../assets/actions/subscriptions.png";
import iconSavings from "../assets/actions/savings.png";
import iconAddMoney from "../assets/actions/addmoney.png";
import iconExpenses from "../assets/actions/expenses.png";
import iconRewards from "../assets/actions/rewards.png";
import iconHistory from "../assets/actions/history.png";
import iconUpilite from "../assets/actions/upilite.png";
import iconGold from "../assets/actions/gold.png";
import iconLedger from "../assets/actions/ledger.png";
import iconVaults from "../assets/actions/vaults.png";
import { FlightIcon, BusIcon, TrainIcon, HotelIcon } from "../components/TravelIcons";

const QUICK_ACTIONS_1 = [
  { icon: iconPay, l: "Pay", s: "pay" },
  { icon: iconRequests, l: "Request", s: "requests" },
  { icon: iconSplit, l: "Split", s: "split" },
  { icon: iconSubs, l: "Subs", s: "subscriptions" },
  { icon: iconSavings, l: "Goals", s: "savings" },
];
const QUICK_ACTIONS_2 = [
  { icon: iconAddMoney, l: "Add ₹", s: "addmoney" },
  { icon: iconExpenses, l: "Tracker", s: "expenses" },
  { icon: iconRewards, l: "Rewards", s: "rewards" },
  { icon: iconHistory, l: "History", s: "history" },
  { icon: iconUpilite, l: "UPI Lite", s: "upilite" },
];
const QUICK_ACTIONS_3 = [
  { icon: iconGold, l: "Gold", s: "gold" },
  { icon: iconLedger, l: "Reports", s: "ledger" },
  { icon: iconVaults, l: "Vaults", s: "vaults" },
];

export function HomeScreen({ onNavigate }) {
  const { profile, refreshProfile, logout } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    refreshProfile?.();
  }, [refreshProfile]);
  const [balance, setBalance] = useState(profile?.account?.balance ?? 0);
  const [denominations, setDenominations] = useState(profile?.account?.cash_denominations ?? null);
  const [digitalGold, setDigitalGold] = useState(profile?.account?.digital_gold ?? 0);
  const [recent, setRecent] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unscratched, setUnscratched] = useState(0);
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goldPotPct, setGoldPotPct] = useState(0);

  const loadAll = useCallback(() => {
    Promise.allSettled([
      PaymentAPI.getTransactions(3, 0),
      AnalyticsAPI.budgetPrediction(),
      RequestAPI.inbox(),
      RewardAPI.listScratchCards(),
      AnalyticsAPI.expenses("month"),
    ]).then((results) => {
      const [txns, pred, inbox, cards, expSummary] = results.map(r => r.status === 'fulfilled' ? r.value : null);
      if (txns) setRecent(txns);
      if (pred) setPrediction(pred);
      if (inbox) setPendingRequests(inbox.filter((r) => r.status === "pending").length);
      if (cards) setUnscratched(cards.filter((c) => !c.scratched).length);
      if (expSummary) setExpenses(expSummary);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (profile) {
      setBalance(profile.account.balance);
      setDenominations(profile.account.cash_denominations);
      setDigitalGold(profile.account.digital_gold);
      loadAll();
    }
  }, [profile, loadAll]);

  // Real-time push replaces the mock's setInterval(...,1000) poll.
  useRenoSocket((evt) => {
    if (evt.type === "balance_update") {
      setBalance(evt.data.balance);
      if (evt.data.denominations) setDenominations(evt.data.denominations);
      if (evt.data.digital_gold !== undefined) setDigitalGold(evt.data.digital_gold);
      loadAll();
    }
    if (evt.type === "gold_pot_update") {
      setGoldPotPct(evt.data.pot_progress_pct ?? 0);
      if (evt.data.purchased) setDigitalGold((g) => g + (evt.data.grams_bought ?? 0));
    }
  });

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accent"></div>
      </div>
    );
  }

  const spent = expenses?.total_spent ?? 0;
  const BUDGET = expenses?.budget ?? 15000;
  const budgetPct = expenses?.budget_used_percent ?? 0;
  const spendScore = Math.min(100, Math.floor((spent / BUDGET) * 60 + recent.length * 3));

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {/* Header with glow */}
      <div className="px-[22px] pt-[50px] pb-[18px] relative glow-hero">
        <div className="flex justify-between items-center relative z-10">
          <div>
            <p className="text-muted text-[11px] tracking-[2px] font-semibold uppercase">Good Day,</p>
            <h2 className="text-[26px] font-extrabold mt-0.5 text-textLight">{profile.full_name.split(" ")[0]} 👋</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn w-[40px] h-[40px] rounded-xl border border-line bg-card flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 transition-colors"
              title="Log Out / Switch Account"
              onClick={async () => {
                await logout();
                onNavigate("login");
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
            <button
              className="btn w-[46px] h-[46px] rounded-full overflow-hidden border-2 border-accent/[.33] p-0 flex items-center justify-center bg-gradient-to-br from-accent to-[#B8420E] text-lg font-extrabold"
              onClick={() => onNavigate("profile")}
            >
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : profile.full_name[0]}
            </button>
          </div>
        </div>
      </div>

      <div className="px-[22px] flex flex-col gap-4">
        {!profile.has_upi_pin && (
          <Card className="p-3.5 bg-accent/[.08] border-accent/[.25] flex justify-between items-center cursor-pointer" onClick={() => onNavigate("profile")}>
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🔐</span>
              <p className="text-[12.5px] font-bold text-accent">Set your UPI PIN to start paying</p>
            </div>
            <span className="text-accent text-sm font-bold">→</span>
          </Card>
        )}
        <CashBalanceCard
          balance={balance}
          vpa={profile.account.vpa}
          bank={profile.account.linked_bank_name}
          show={show}
          onToggle={(val) => setShow(typeof val === "boolean" ? val : !show)}
          denominations={denominations || profile.account.cash_denominations}
        />

        {digitalGold > 0 && (
          <button className="btn w-full text-left" onClick={() => onNavigate("gold")}>
            <Card className="px-[18px] py-3 border-accent/[.27] bg-accent/[.03]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-[22px]">🪙</span>
                  <div><p className="font-bold text-[13px] text-accent">Digital Gold Vault</p><p className="text-muted text-[10px]">Round-up savings</p></div>
                </div>
                <p className="font-mono text-base font-bold text-accent">{fmt(digitalGold)}</p>
              </div>
              {goldPotPct > 0 && (
                <div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2A2320" }}>
                    <div className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${goldPotPct}%`, background: "linear-gradient(90deg,#B8420E,#FF6A1A,#FFA352)" }} />
                  </div>
                  <p className="text-[9px] text-muted mt-1">Pot: {goldPotPct.toFixed(0)}% → ₹200 trigger</p>
                </div>
              )}
            </Card>
          </button>
        )}


        {prediction && prediction.status !== "safe" && (
          <Card
            className="p-[18px]"
            style={{ border: `1.5px solid ${prediction.status === "critical" ? "#ff3d6066" : "#FFA00066"}`, background: prediction.status === "critical" ? "#ff3d600a" : "#FFA0000a" }}
          >
            <div className="flex justify-between items-start mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">{prediction.status === "critical" ? "🚨" : "⚠️"}</span>
                <h3 className="text-sm font-extrabold" style={{ color: prediction.status === "critical" ? "#ff3d60" : "#FFA000" }}>SENTINAI PREDICTION</h3>
              </div>
              <Badge color={prediction.status === "critical" ? "#ff3d60" : "#FFA000"} size={9}>{prediction.level} Risk</Badge>
            </div>
            <p className="text-[13px] leading-relaxed font-medium text-textLight">{prediction.message}</p>
            <div className="mt-3 flex justify-between items-center">
              <div><p className="text-muted text-[10px]">Daily Burn Rate</p><p className="font-bold text-sm text-textLight">{fmt(prediction.daily_burn_rate)}/day</p></div>
            </div>
          </Card>
        )}

        <HeartbeatGauge spendScore={spendScore} />

        {(pendingRequests > 0 || unscratched > 0) && (
          <div className="flex gap-2 flex-wrap">
            {pendingRequests > 0 && (
              <button className="btn flex-1 py-2.5 px-3.5 rounded-xl bg-warn/[.08] border border-warn/[.27] text-warn text-xs font-bold flex items-center justify-center gap-1.5" onClick={() => onNavigate("requests")}>
                <span>💌</span>{pendingRequests} Money Request{pendingRequests > 1 ? "s" : ""}
              </button>
            )}
            {unscratched > 0 && (
              <button className="btn flex-1 py-2.5 px-3.5 rounded-xl bg-accent/[.08] border border-accent/[.27] text-accent text-xs font-bold flex items-center justify-center gap-1.5" onClick={() => onNavigate("rewards")}>
                <span>🎰</span>{unscratched} Scratch Card{unscratched > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        <Card className="p-[18px]" style={{ border: `1px solid ${budgetPct > 80 ? "#ff3d6033" : "#2A2320"}` }}>
          <div className="flex justify-between mb-2.5">
            <p className="text-[13px] font-bold text-textLight">Monthly Budget</p>
            <p className="font-mono text-[11px]" style={{ color: budgetPct > 80 ? "#ff3d60" : budgetPct > 60 ? "#FFA000" : "#22C55E" }}>{fmt(spent)} / {fmt(BUDGET)}</p>
          </div>
          <div className="bg-bg rounded-lg h-2 overflow-hidden">
            <div className="h-full rounded-lg transition-[width] duration-700" style={{ width: `${budgetPct}%`, background: budgetPct > 80 ? "#ff3d60" : budgetPct > 60 ? "#FFA000" : "#22C55E" }} />
          </div>
          <p className="text-muted text-[11px] mt-[7px]">
            {budgetPct > 80 ? "⚠ Approaching limit!" : budgetPct > 60 ? "📊 Moderate spending" : "✅ On track"} · {(100 - budgetPct).toFixed(0)}% remaining
          </p>
        </Card>

        {/* Glow divider before quick actions */}
        <div className="glow-divider my-1"></div>

        <div className="grid grid-cols-5 gap-2">
          {QUICK_ACTIONS_1.map((a) => (
            <button key={a.s} className="group btn bg-card border border-line rounded-[20px] py-2.5 px-1 flex flex-col items-center gap-1.5 hover:border-accent/40 hover:bg-card/80 transition-all active:scale-95 cursor-pointer" onClick={() => onNavigate(a.s)}>
              <img src={a.icon} alt={a.l} className="w-[38px] h-[38px] object-contain drop-shadow-md transition-transform group-hover:scale-105" />
              <span className="text-[10px] text-textLight font-semibold tracking-tight">{a.l}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_ACTIONS_2.map((a) => (
            <button key={a.s} className="group btn bg-card border border-line rounded-[20px] py-2.5 px-1 flex flex-col items-center gap-1.5 hover:border-accent/40 hover:bg-card/80 transition-all active:scale-95 cursor-pointer" onClick={() => onNavigate(a.s)}>
              <img src={a.icon} alt={a.l} className="w-[38px] h-[38px] object-contain drop-shadow-md transition-transform group-hover:scale-105" />
              <span className="text-[10px] text-textLight font-semibold tracking-tight">{a.l}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS_3.map((a) => (
            <button key={a.s} className="group btn bg-card border border-line rounded-[20px] py-2.5 px-1 flex flex-col items-center gap-1.5 hover:border-accent/40 hover:bg-card/80 transition-all active:scale-95 cursor-pointer" onClick={() => onNavigate(a.s)}>
              <img src={a.icon} alt={a.l} className="w-[38px] h-[38px] object-contain drop-shadow-md transition-transform group-hover:scale-105" />
              <span className="text-[10px] text-textLight font-semibold tracking-tight">{a.l}</span>
            </button>
          ))}
        </div>

        {/* Travel & Transit Section matching reference screenshot */}
        <div className="mt-2 mb-1">
          <div className="flex justify-between items-center mb-2.5 px-0.5">
            <h3 className="text-base font-extrabold text-textLight">Travel & Transit</h3>
            <button
              onClick={() => onNavigate("travel", { tab: "train" })}
              className="text-accent text-xs font-semibold hover:underline"
            >
              Bookings →
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {[
              { id: "flight", label: "Flight", icon: FlightIcon },
              { id: "bus", label: "Bus", icon: BusIcon },
              { id: "train", label: "Train", icon: TrainIcon },
              { id: "hotel", label: "Hotel", icon: HotelIcon },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate("travel", { tab: item.id })}
                  className="group flex flex-col items-center justify-center p-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <div className="w-[68px] h-[54px] rounded-2xl bg-[#201c19] border border-line/70 hover:border-accent/50 flex items-center justify-center mb-1.5 transition-all group-hover:scale-105 group-hover:shadow-accentGlow shadow-sm">
                    <Icon className="w-9 h-9 object-contain drop-shadow-sm" />
                  </div>
                  <span className="text-[11px] font-semibold text-textLight tracking-tight group-hover:text-accent transition-colors">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-textLight">Recent</h3>
            <button className="btn text-accent bg-transparent text-xs font-semibold w-auto" onClick={() => onNavigate("history")}>See all →</button>
          </div>
          {recent.map((t) => (
            <div key={t.txn_ref} className="animate-fadeUp bg-card border border-line rounded-[20px] p-3.5 mb-2.5 flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-[13px] bg-accent/20 flex items-center justify-center text-lg shrink-0 glow-icon">💳</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate text-textLight">{t.description}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <TrustBadge score={t.trust_score} />
                  <p className="text-muted text-[10px]">{ago(t.created_at)}</p>
                  {t.round_up > 0 && <Badge color="#FF6A1A" size={9}>+{fmt(t.round_up)} gold</Badge>}
                </div>
              </div>
              <p className="font-mono font-bold text-[13px] shrink-0" style={{ color: t.type === "credit" ? "#22C55E" : "#ff3d60" }}>
                {t.type === "credit" ? "+" : "-"}{fmt(t.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
