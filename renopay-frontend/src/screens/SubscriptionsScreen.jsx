import { useState, useEffect } from "react";
import { MandateAPI } from "../lib/api";
import { Btn, Card, Badge } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt } from "../lib/format";
import { useTheme } from "../context/ThemeContext";

/* ── 18+ Popular Subscription Services Catalog ────────────────────────────── */
const POPULAR_APPS = [
  {
    id: "netflix",
    name: "Netflix",
    icon: "🎬",
    color: "#E50914",
    category: "OTT",
    merchant_vpa: "netflix.pay@hdfcbank",
    plans: [
      { name: "Mobile (480p, 1 device)", amount: 149, frequency: "monthly" },
      { name: "Basic (720p HD, 1 screen)", amount: 199, frequency: "monthly" },
      { name: "Standard (1080p FHD, 2 screens)", amount: 499, frequency: "monthly" },
      { name: "Premium (4K Ultra HD, 4 screens)", amount: 649, frequency: "monthly" },
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎵",
    color: "#1DB954",
    category: "Music",
    merchant_vpa: "spotify@axisbank",
    plans: [
      { name: "Individual (Ad-free offline)", amount: 119, frequency: "monthly" },
      { name: "Duo (2 Premium accounts)", amount: 149, frequency: "monthly" },
      { name: "Family (6 Premium accounts)", amount: 179, frequency: "monthly" },
      { name: "Student Special", amount: 66, frequency: "monthly" },
      { name: "Premium Annual Plan", amount: 1189, frequency: "yearly" },
    ],
  },
  {
    id: "hotstar",
    name: "Disney+ Hotstar",
    icon: "⭐",
    color: "#0C2461",
    category: "OTT",
    merchant_vpa: "hotstar@paytm",
    plans: [
      { name: "Super (Full HD, 2 devices) - 3 Months", amount: 299, frequency: "quarterly" },
      { name: "Super (Full HD, 2 devices) - 1 Year", amount: 899, frequency: "yearly" },
      { name: "Premium (4K Ultra HD, 4 devices) - Monthly", amount: 299, frequency: "monthly" },
      { name: "Premium (4K Ultra HD, 4 devices) - 1 Year", amount: 1499, frequency: "yearly" },
    ],
  },
  {
    id: "prime",
    name: "Amazon Prime",
    icon: "📦",
    color: "#00A8E1",
    category: "OTT",
    merchant_vpa: "amazonpay.prime@icici",
    plans: [
      { name: "Prime Monthly", amount: 299, frequency: "monthly" },
      { name: "Prime Quarterly", amount: 599, frequency: "quarterly" },
      { name: "Prime Annual (Video + Free Delivery)", amount: 1499, frequency: "yearly" },
      { name: "Prime Shopping Edition (Annual)", amount: 799, frequency: "yearly" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube Premium",
    icon: "▶️",
    color: "#FF0000",
    category: "OTT",
    merchant_vpa: "googleplay.youtube@icici",
    plans: [
      { name: "Individual (Ad-free & Background)", amount: 149, frequency: "monthly" },
      { name: "Student (Ad-free + YT Music)", amount: 79, frequency: "monthly" },
      { name: "Family (Up to 5 members)", amount: 299, frequency: "monthly" },
      { name: "Individual Prepaid Annual", amount: 1490, frequency: "yearly" },
    ],
  },
  {
    id: "jiocinema",
    name: "JioCinema",
    icon: "🍿",
    color: "#E11D48",
    category: "OTT",
    merchant_vpa: "jiocinema@jio",
    plans: [
      { name: "Premium Monthly (4K, 1 screen)", amount: 29, frequency: "monthly" },
      { name: "Family Monthly (4K, 4 screens)", amount: 89, frequency: "monthly" },
      { name: "Premium Annual (Best Value)", amount: 299, frequency: "yearly" },
    ],
  },
  {
    id: "sonyliv",
    name: "SonyLIV",
    icon: "📺",
    color: "#2563EB",
    category: "OTT",
    merchant_vpa: "sonyliv@yesbank",
    plans: [
      { name: "LIV Mobile Only (Annual)", amount: 599, frequency: "yearly" },
      { name: "Premium Monthly", amount: 399, frequency: "monthly" },
      { name: "Premium 6 Months", amount: 699, frequency: "quarterly" },
      { name: "Premium Annual (All Access)", amount: 999, frequency: "yearly" },
    ],
  },
  {
    id: "zee5",
    name: "Zee5",
    icon: "✨",
    color: "#9333EA",
    category: "OTT",
    merchant_vpa: "zee5@icici",
    plans: [
      { name: "All Access Monthly", amount: 99, frequency: "monthly" },
      { name: "Premium HD Annual", amount: 699, frequency: "yearly" },
      { name: "Premium 4K Ultra Annual", amount: 899, frequency: "yearly" },
    ],
  },
  {
    id: "apple",
    name: "Apple One / Music",
    icon: "🍎",
    color: "#475569",
    category: "Music",
    merchant_vpa: "apple.services@citibank",
    plans: [
      { name: "Apple Music Individual", amount: 99, frequency: "monthly" },
      { name: "Apple Music Family", amount: 149, frequency: "monthly" },
      { name: "Apple One Individual (Music+TV+50GB)", amount: 195, frequency: "monthly" },
      { name: "Apple One Family (Up to 5 members)", amount: 365, frequency: "monthly" },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT Plus",
    icon: "🤖",
    color: "#10A37F",
    category: "Tech",
    merchant_vpa: "openai.subscription@stripe",
    plans: [
      { name: "ChatGPT Plus (GPT-4o, o1, Voice)", amount: 1999, frequency: "monthly" },
      { name: "ChatGPT Team (Per user)", amount: 2499, frequency: "monthly" },
    ],
  },
  {
    id: "swiggy",
    name: "Swiggy One",
    icon: "🍔",
    color: "#FC8019",
    category: "Food",
    merchant_vpa: "swiggy@icici",
    plans: [
      { name: "Swiggy One 3-Months (Free Delivery)", amount: 299, frequency: "quarterly" },
      { name: "Swiggy One Annual (Food + Instamart)", amount: 899, frequency: "yearly" },
    ],
  },
  {
    id: "zomato",
    name: "Zomato Gold",
    icon: "🍕",
    color: "#E23744",
    category: "Food",
    merchant_vpa: "zomato@hdfcbank",
    plans: [
      { name: "Zomato Gold 3-Months (Free Delivery)", amount: 199, frequency: "quarterly" },
      { name: "Zomato Gold Annual VIP Pass", amount: 699, frequency: "yearly" },
    ],
  },
  {
    id: "canva",
    name: "Canva Pro",
    icon: "🎨",
    color: "#00C4CC",
    category: "Tech",
    merchant_vpa: "canva.pro@stripe",
    plans: [
      { name: "Canva Pro Monthly (Unlimited Assets)", amount: 499, frequency: "monthly" },
      { name: "Canva Pro Annual (Save 33%)", amount: 3999, frequency: "yearly" },
    ],
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    icon: "💻",
    color: "#0078D4",
    category: "Tech",
    merchant_vpa: "microsoft@icici",
    plans: [
      { name: "Personal Monthly (1TB Cloud + Office)", amount: 489, frequency: "monthly" },
      { name: "Personal Annual (1 Person)", amount: 4899, frequency: "yearly" },
      { name: "Family Annual (Up to 6 Persons, 6TB)", amount: 6199, frequency: "yearly" },
    ],
  },
  {
    id: "cultfit",
    name: "Cult.fit / Cultpass",
    icon: "💪",
    color: "#FF3278",
    category: "Fitness",
    merchant_vpa: "curefit@hdfcbank",
    plans: [
      { name: "Cultpass Live (Monthly Home Fitness)", amount: 890, frequency: "monthly" },
      { name: "Cultpass Elite (3 Months Gym & Centers)", amount: 5990, frequency: "quarterly" },
      { name: "Cultpass Pro Annual Unlimited", amount: 11990, frequency: "yearly" },
    ],
  },
  {
    id: "blinkit",
    name: "Blinkit Black",
    icon: "⚡",
    color: "#F7D100",
    category: "Food",
    merchant_vpa: "blinkit@icici",
    plans: [
      { name: "Blinkit VIP 3 Months (Zero Delivery)", amount: 99, frequency: "quarterly" },
      { name: "Blinkit VIP Annual Pass", amount: 299, frequency: "yearly" },
    ],
  },
  {
    id: "googleone",
    name: "Google One",
    icon: "☁️",
    color: "#4285F4",
    category: "Tech",
    merchant_vpa: "googleone@icici",
    plans: [
      { name: "100 GB Cloud Storage (Monthly)", amount: 130, frequency: "monthly" },
      { name: "100 GB Cloud Storage (Annual)", amount: 1300, frequency: "yearly" },
      { name: "2 TB + Gemini Advanced (Monthly)", amount: 1950, frequency: "monthly" },
    ],
  },
  {
    id: "audible",
    name: "Audible Audiobooks",
    icon: "🎧",
    color: "#F8991C",
    category: "Music",
    merchant_vpa: "audible@icici",
    plans: [
      { name: "Audible Monthly (1 Audiobook Credit)", amount: 199, frequency: "monthly" },
      { name: "Audible 3-Month Plan", amount: 597, frequency: "quarterly" },
      { name: "Audible Annual Pass", amount: 2388, frequency: "yearly" },
    ],
  },
];

const CATEGORIES = ["All", "OTT", "Music", "Tech", "Food", "Fitness"];

export function SubscriptionsScreen({ onBack }) {
  const { isNightMode } = useTheme();
  const [mandates, setMandates] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [payMode, setPayMode] = useState("classic"); // "classic" (Normal Pay) | "slider" (Advance Pay)
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    icon: "📦",
    merchant_vpa: "",
    amount: "",
    max_limit: "",
    frequency: "monthly",
    category: "Bills",
  });
  const [selectedPlanName, setSelectedPlanName] = useState("");
  const [err, setErr] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = () =>
    MandateAPI.list()
      .then((res) => setMandates(res.data || res))
      .catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const total = mandates
    .filter((m) => m.status === "active")
    .reduce((s, m) => s + m.amount, 0);

  const toggle = async (id) => {
    await MandateAPI.toggle(id);
    await load();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to cancel this subscription mandate?")) {
      await MandateAPI.cancel(id);
      await load();
    }
  };

  // When user chooses an app from the catalog
  const handleSelectApp = (app) => {
    setSelectedApp(app);
    const defaultPlan = app.plans[0];
    setForm({
      name: `${app.name} (${defaultPlan.name})`,
      icon: app.icon,
      merchant_vpa: app.merchant_vpa,
      amount: String(defaultPlan.amount),
      max_limit: String(defaultPlan.amount), // EXACT PLAN AMOUNT, NOT * 2
      frequency: defaultPlan.frequency,
      category: app.category,
    });
    setSelectedPlanName(defaultPlan.name);
    setErr("");
  };

  // When user selects a specific plan
  const handleSelectPlan = (plan) => {
    setSelectedPlanName(plan.name);
    setForm((prev) => ({
      ...prev,
      name: `${selectedApp.name} (${plan.name})`,
      amount: String(plan.amount),
      max_limit: String(plan.amount), // EXACT PLAN AMOUNT, NOT * 2
      frequency: plan.frequency,
    }));
  };

  // Switch to custom app entry
  const handleSelectCustom = () => {
    setSelectedApp({ id: "custom", name: "Custom App", icon: "✨", plans: [] });
    setForm({
      name: "",
      icon: "✨",
      merchant_vpa: "",
      amount: "",
      max_limit: "",
      frequency: "monthly",
      category: "Bills",
    });
    setSelectedPlanName("");
    setErr("");
  };

  const startAddMandate = () => {
    if (!form.name || !form.merchant_vpa || !Number(form.amount) || Number(form.amount) <= 0) {
      setErr("Please select a plan or enter valid name, UPI ID, and amount");
      return;
    }
    setErr("");
    try { navigator.vibrate?.(12); } catch (_) {}
    setShowPin(true);
  };

  const confirmPin = async (pin) => {
    if (isSubmitting) return; // Prevent duplicate execution
    setIsSubmitting(true);
    setErr("");
    try {
      const planAmount = Number(form.amount);
      await MandateAPI.create({
        name: form.name,
        icon: form.icon,
        merchant_vpa: form.merchant_vpa,
        amount: planAmount,
        max_limit: planAmount, // STRICTLY EXACT PLAN AMOUNT, NEVER MULTIPLIED!
        frequency: form.frequency,
        category: form.category,
        pin,
      });
      await load();
      setShowAdd(false);
      setSelectedApp(null);
      setShowPin(false);
      setForm({
        name: "",
        icon: "📦",
        merchant_vpa: "",
        amount: "",
        max_limit: "",
        frequency: "monthly",
        category: "Bills",
      });
    } catch (e) {
      setErr(
        e.response?.data?.detail?.message ||
        e.response?.data?.detail ||
        "Could not authorize mandate — check your UPI PIN"
      );
      setShowPin(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter apps
  const filteredApps = POPULAR_APPS.filter((app) => {
    const matchesCategory =
      selectedCategory === "All" || app.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-bg pb-[110px]">
      {/* ── UPI PIN Modal ── */}
      {showPin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[999] p-4">
          <Card className="p-6 max-w-[340px] w-full border-accent/[.33] shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent text-2xl mx-auto mb-2 flex items-center justify-center">
              {form.icon || "📋"}
            </div>
            <p className="text-center text-textLight font-extrabold text-base mb-0.5">
              Authorize AutoPay
            </p>
            <p className="text-center text-accent font-mono font-bold text-lg mb-0.5">
              {fmt(Number(form.amount))}
              <span className="text-xs font-normal text-muted capitalize"> /{form.frequency}</span>
            </p>
            <p className="text-center text-teal text-[11px] font-semibold mb-2">
              ✓ Exact plan amount (Zero extra charges)
            </p>
            <p className="text-center text-muted text-[11px] mb-4">
              to {form.merchant_vpa}
            </p>
            <PINPad
              onComplete={confirmPin}
              label="Enter your 6-digit UPI PIN"
              actionLabel="Authorize"
              actionType="pay"
              loading={isSubmitting}
              disabled={isSubmitting}
            />
            <button
              className="btn w-full mt-4 text-muted hover:text-textLight text-xs py-2 transition-colors cursor-pointer disabled:opacity-40"
              onClick={() => setShowPin(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* ── Header ── */}
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="btn bg-card border border-line text-textLight rounded-xl w-10 h-10 flex items-center justify-center text-base shadow-sm hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
            onClick={onBack}
          >
            ←
          </button>
          <h2 className="text-xl font-extrabold text-textLight tracking-tight">
            Subscriptions 📋
          </h2>
        </div>
        {mandates.length > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent">
            {mandates.filter((m) => m.status === "active").length} Active
          </span>
        )}
      </div>

      <div className="px-[22px]">
        {/* ── Monthly Auto-Pay Summary Card ── */}
        <Card className="p-5 mb-4 border-accent/[.25] text-center shadow-sm relative overflow-hidden">
          <p className="text-muted text-[11px] tracking-wider font-bold uppercase">
            Monthly Auto-Pay Commitments
          </p>
          <p className="font-mono text-[34px] font-extrabold text-accent mt-1 leading-tight">
            {fmt(total)}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge color="#22C55E" size={10}>
              ● {mandates.filter((m) => m.status === "active").length} Active
            </Badge>
            {mandates.filter((m) => m.status !== "active").length > 0 && (
              <Badge color="#FFA000" size={10}>
                ❚❚ {mandates.filter((m) => m.status !== "active").length} Paused
              </Badge>
            )}
          </div>
        </Card>

        {/* ── Active Subscriptions List ── */}
        {mandates.length > 0 && (
          <div className="mb-4 space-y-2.5">
            <p className="text-xs font-bold text-muted uppercase tracking-wider px-1">
              Your Active Mandates
            </p>
            {mandates.map((m) => (
              <Card
                key={m.id}
                className="p-4 transition-all hover:border-accent/30 shadow-xs"
                style={{ opacity: m.status === "active" ? 1 : 0.65 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center text-2xl shrink-0">
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-textLight truncate">{m.name}</p>
                    <p className="text-muted text-[11px] capitalize truncate">
                      {m.frequency} · {m.merchant_vpa}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="font-mono font-bold text-sm text-textLight">{fmt(m.amount)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        className="btn px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer"
                        style={{
                          background: m.status === "active" ? "#ff3d6015" : "#22C55E15",
                          color: m.status === "active" ? "#ff3d60" : "#22C55E",
                          border: `1px solid ${m.status === "active" ? "#ff3d6030" : "#22C55E30"}`,
                        }}
                        onClick={() => toggle(m.id)}
                      >
                        {m.status === "active" ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="btn w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-muted hover:text-danger hover:bg-danger/15 border border-line hover:border-danger/30 transition-all cursor-pointer"
                        onClick={() => handleDelete(m.id)}
                        title="Cancel mandate"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── Add Subscription Section ── */}
        {showAdd ? (
          <Card className="p-5 mt-2 border-accent/[.35] shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-extrabold text-base text-accent flex items-center gap-1.5">
                <span>➕</span> Add New Subscription
              </p>
              <button
                type="button"
                className="text-xs text-muted hover:text-textLight font-semibold px-2 py-1 rounded-lg hover:bg-bg cursor-pointer"
                onClick={() => {
                  setShowAdd(false);
                  setSelectedApp(null);
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* 1. Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`btn px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-accent text-white border-accent shadow-xs"
                      : "bg-surf border-line text-muted hover:text-textLight"
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 2. Popular 18+ Apps Grid */}
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
              Select Popular App (or enter custom)
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4 max-h-[220px] overflow-y-auto pr-1">
              {filteredApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    selectedApp?.id === app.id
                      ? "bg-accent/15 border-accent shadow-sm ring-2 ring-accent/30"
                      : "bg-surf border-line hover:border-accent/40 text-textLight shadow-xs"
                  }`}
                  onClick={() => handleSelectApp(app)}
                >
                  <span className="text-2xl">{app.icon}</span>
                  <span className="text-[11px] font-bold text-textLight truncate w-full">
                    {app.name}
                  </span>
                  <span className="text-[9px] text-muted font-mono">
                    From ₹{app.plans[0]?.amount}
                  </span>
                </button>
              ))}

              {/* Custom App button */}
              <button
                type="button"
                className={`p-2.5 rounded-xl border-dashed border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  selectedApp?.id === "custom"
                    ? "bg-accent/15 border-accent ring-2 ring-accent/30"
                    : "bg-surf border-line hover:border-accent/40 text-accent shadow-xs"
                }`}
                onClick={handleSelectCustom}
              >
                <span className="text-2xl">➕</span>
                <span className="text-[11px] font-bold text-accent">Custom App</span>
                <span className="text-[9px] text-muted">Other Service</span>
              </button>
            </div>

            {/* 3. Selected App & Available Plans */}
            {selectedApp && selectedApp.id !== "custom" && (
              <div className="mb-4 bg-bg rounded-2xl p-3.5 border border-line/60 animate-fade-in">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xl">{selectedApp.icon}</span>
                  <div>
                    <p className="font-extrabold text-sm text-textLight">{selectedApp.name}</p>
                    <p className="text-muted text-[10px] font-mono">{selectedApp.merchant_vpa}</p>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                  Select Subscription Plan:
                </p>
                <div className="space-y-1.5">
                  {selectedApp.plans.map((p) => (
                    <div
                      key={p.name}
                      onClick={() => handleSelectPlan(p)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedPlanName === p.name
                          ? "bg-accent/15 border-accent shadow-xs ring-1 ring-accent"
                          : "bg-surf border-line hover:border-accent/30"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs text-textLight">{p.name}</p>
                        <p className="text-[10px] text-muted capitalize font-medium">
                          Billed {p.frequency}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-accent font-mono">
                          {fmt(p.amount)}
                        </span>
                        <span className="text-[10px] text-muted">/{p.frequency === "monthly" ? "mo" : p.frequency === "quarterly" ? "3mo" : "yr"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom App Fields */}
            {selectedApp?.id === "custom" && (
              <div className="space-y-2.5 mb-4 bg-bg rounded-2xl p-3.5 border border-line/60 animate-fade-in">
                <div>
                  <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">
                    Service / App Name
                  </label>
                  <input
                    placeholder="e.g. Claude Pro, Notion, Gym"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">
                    Merchant UPI ID (VPA)
                  </label>
                  <input
                    placeholder="e.g. merchant@icici or service@upi"
                    value={form.merchant_vpa}
                    onChange={(e) => setForm((f) => ({ ...f, merchant_vpa: e.target.value }))}
                    className="text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">
                    Subscription Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 499"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amount: e.target.value,
                        max_limit: e.target.value,
                      }))
                    }
                    className="text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">
                    Billing Frequency
                  </label>
                  <div className="flex gap-2">
                    {["monthly", "quarterly", "yearly"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`btn flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                          form.frequency === c
                            ? "bg-accent text-white border-accent"
                            : "bg-surf text-muted border-line hover:border-accent/40"
                        }`}
                        onClick={() => setForm((f) => ({ ...f, frequency: c }))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Payment Mode Selection: Normal Pay vs Advance Pay */}
            {selectedApp && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                  Choose Payment Method:
                </p>
                <div className="grid grid-cols-2 gap-2 bg-surf p-1.5 rounded-2xl border border-line mb-2">
                  <button
                    type="button"
                    className={`btn py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      payMode === "classic"
                        ? "bg-accent text-white shadow-accentGlow"
                        : "text-muted hover:text-textLight"
                    }`}
                    onClick={() => setPayMode("classic")}
                  >
                    <span>⚡</span>
                    <span>Normal Pay</span>
                  </button>
                  <button
                    type="button"
                    className={`btn py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      payMode === "slider"
                        ? "bg-accent text-white shadow-accentGlow"
                        : "text-muted hover:text-textLight"
                    }`}
                    onClick={() => setPayMode("slider")}
                  >
                    <span>🚀</span>
                    <span>Advance Pay</span>
                  </button>
                </div>
                <p className="text-[10px] text-muted text-center">
                  {payMode === "classic"
                    ? "⚡ Direct UPI AutoPay mandate with 6-digit PIN"
                    : "🚀 Interactive cash bundle slider for 1st installment + mandate setup"}
                </p>

                {/* If Advance Pay is active, render Locked Cash Bundle & Slide To Pay */}
                {payMode === "slider" && (
                  <div className="mt-3 mb-2 animate-fade-in bg-card p-4 rounded-2xl border border-accent/30 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🔒</span>
                        <span className="text-xs font-bold text-textLight">Exact Plan Price Locked</span>
                      </div>
                      <span className="text-xs font-extrabold text-accent font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                        {fmt(Number(form.amount))}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted mb-3 leading-relaxed">
                      Advance Mode strictly pays the exact subscription plan price (<strong>{fmt(Number(form.amount))}</strong>). Zero arbitrary charges.
                    </p>

                    {/* Exact Currency Denomination Breakdown */}
                    <div className="bg-bg/80 border border-line rounded-xl p-3 mb-3">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>💵 Cash Denomination Bundle</span>
                        <span className="text-teal font-semibold">Strictly Fixed</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          let rem = Math.max(0, Math.round(Number(form.amount) || 0));
                          const denoms = [
                            { val: 500, label: "₹500", isNote: true },
                            { val: 200, label: "₹200", isNote: true },
                            { val: 100, label: "₹100", isNote: true },
                            { val: 50,  label: "₹50",  isNote: true },
                            { val: 20,  label: "₹20",  isNote: true },
                            { val: 10,  label: "₹10",  isNote: true },
                            { val: 5,   label: "₹5",   isNote: false },
                            { val: 2,   label: "₹2",   isNote: false },
                            { val: 1,   label: "₹1",   isNote: false },
                          ];
                          const list = [];
                          for (const d of denoms) {
                            if (rem >= d.val) {
                              const count = Math.floor(rem / d.val);
                              list.push({ ...d, count });
                              rem %= d.val;
                            }
                          }
                          if (list.length === 0) {
                            return <span className="text-xs text-muted">Select a plan to view cash bundle</span>;
                          }
                          return list.map((item) => (
                            <span
                              key={item.val}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${
                                item.isNote
                                  ? "bg-accent/10 border-accent/30 text-accent"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                              }`}
                            >
                              <span>{item.isNote ? "💵" : "🪙"}</span>
                              <span>{item.count}×{item.label}</span>
                            </span>
                          ));
                        })()}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                        <span className="text-muted">Total Bundle Value:</span>
                        <span className="font-mono font-extrabold text-accent">{fmt(Number(form.amount))}</span>
                      </div>
                    </div>

                    {/* Interactive Slide to Authorize Button */}
                    <button
                      type="button"
                      className="btn w-full py-3 rounded-xl bg-accent text-white text-xs font-bold flex items-center justify-center gap-2 shadow-accentGlow hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                      onClick={startAddMandate}
                      disabled={isSubmitting || !Number(form.amount)}
                    >
                      <span>🚀</span>
                      <span>Slide &amp; Authorize Exact {fmt(Number(form.amount))} →</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {err && <p className="text-danger text-xs mb-3 font-semibold">{err}</p>}

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                className="btn flex-1 py-3 rounded-xl font-bold text-xs bg-surf hover:bg-bg border border-line text-textLight active:scale-98 transition-all cursor-pointer disabled:opacity-40"
                onClick={() => {
                  setShowAdd(false);
                  setSelectedApp(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn flex-1 py-3 rounded-xl font-bold text-xs bg-accent text-white shadow-accentGlow hover:brightness-110 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                onClick={startAddMandate}
                disabled={!selectedApp || isSubmitting || !Number(form.amount)}
              >
                {isSubmitting ? "Processing..." : `Pay Exact ${fmt(Number(form.amount))} →`}
              </button>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            className="btn w-full py-3.5 rounded-2xl bg-card border-[1.5px] border-dashed border-accent/40 text-accent text-sm font-bold flex items-center justify-center gap-2 hover:border-accent hover:bg-accent/[.04] active:scale-[0.98] transition-all cursor-pointer shadow-sm mt-3"
            onClick={() => {
              setShowAdd(true);
              handleSelectApp(POPULAR_APPS[0]); // default open with Netflix
            }}
          >
            <span>➕</span>
            <span>+ Add Subscription</span>
          </button>
        )}
      </div>
    </div>
  );
}

