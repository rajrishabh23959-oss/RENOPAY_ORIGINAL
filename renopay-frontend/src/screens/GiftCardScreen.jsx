import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { GiftCardAPI } from "../lib/api";
import { fmt } from "../lib/format";
import { downloadOrSharePdf } from "../lib/download";
import { Card, Btn, Badge } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { PdfPreviewModal } from "../components/PdfPreviewModal";

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

const GREETINGS = [
  "Happy Birthday! 🎂",
  "Best Wishes! 🌟",
  "Congratulations! 🎉",
  "Festival Greetings! 🪔",
  "Thank You! 🙏",
  "Just for You! 💖",
];

const THEMES = [
  { id: "gold", name: "Gold Luxury", border: "#f59e0b", grad: "from-[#2A2008] via-[#1A1405] to-[#0F0C05]", badge: "#fbbf24", icon: "👑" },
  { id: "neon", name: "Cyber Neon", border: "#06b6d4", grad: "from-[#08202A] via-[#05141A] to-[#040C0F]", badge: "#22d3ee", icon: "⚡" },
  { id: "crimson", name: "Festive Crimson", border: "#f43f5e", grad: "from-[#2A0812] via-[#1A050B] to-[#0F0407]", badge: "#fb7185", icon: "🪔" },
];

export function GiftCardScreen({ onBack }) {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState("create"); // "create" | "claim" | "history"

  // Creation State
  const [amount, setAmount] = useState("500");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("Best Wishes! 🌟");
  const [theme, setTheme] = useState("gold");
  const [showPinPad, setShowPinPad] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCard, setCreatedCard] = useState(null);

  // Claim State
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [claimError, setClaimError] = useState("");

  // History State
  const [myCards, setMyCards] = useState({ created: [], claimed: [] });
  const [historyFilter, setHistoryFilter] = useState("created");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // PDF Preview State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfTitle, setPdfTitle] = useState("Gift Card Voucher");
  const [pdfFilename, setPdfFilename] = useState("RenoPay_GiftCard.pdf");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await GiftCardAPI.myCards();
      setMyCards(data);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") {
      fetchHistory();
    }
  }, [tab, fetchHistory]);

  const handleStartCreate = (e) => {
    e?.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      setCreateError("Please enter a valid amount greater than ₹0.");
      return;
    }
    const currentBal = (profile?.account?.balance ?? 0);
    if (num > currentBal) {
      setCreateError(`Insufficient wallet balance (Available: ${fmt(currentBal)}).`);
      return;
    }
    setCreateError("");
    setShowPinPad(true);
  };

  const handlePinComplete = async (pin) => {
    setShowPinPad(false);
    setCreating(true);
    setCreateError("");
    try {
      const res = await GiftCardAPI.create({
        amount: Number(amount),
        pin,
        recipient_name: recipientName.trim() || undefined,
        message: message.trim() || undefined,
        theme,
      });
      setCreatedCard(res);
      await refreshProfile?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "object" ? detail.message : (detail || "Failed to create gift card.");
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleClaim = async (e) => {
    e?.preventDefault();
    const code = claimCode.trim();
    if (!code) {
      setClaimError("Please enter a valid gift card code.");
      return;
    }
    setClaiming(true);
    setClaimError("");
    setClaimResult(null);
    try {
      const res = await GiftCardAPI.claim(code);
      setClaimResult(res);
      setClaimCode("");
      await refreshProfile?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "object" ? detail.message : (detail || "Could not claim gift card. Check code and try again.");
      setClaimError(msg);
    } finally {
      setClaiming(false);
    }
  };

  const handlePasteCode = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setClaimCode(text.trim());
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCopy = (code) => {
    try {
      navigator.clipboard?.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleViewPdf = async (card) => {
    setPdfTitle(`Gift Card ${card.card_code}`);
    setPdfFilename(`RenoPay_GiftCard_${card.card_code}.pdf`);
    setPdfBlob(null);
    setPdfLoading(true);
    setPdfModalOpen(true);
    try {
      const blob = await GiftCardAPI.downloadPdf(card.id);
      setPdfBlob(blob);
    } catch {
      alert("Failed to load PDF preview. Please try again.");
      setPdfModalOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async (card) => {
    try {
      const blob = await GiftCardAPI.downloadPdf(card.id);
      await downloadOrSharePdf(blob, `RenoPay_GiftCard_${card.card_code}.pdf`);
    } catch {
      alert("Failed to download PDF voucher.");
    }
  };

  const activeTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="min-h-screen bg-bg pb-[120px]">
      {/* Header */}
      <div className="pt-[50px] pb-[16px] px-[22px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base cursor-pointer"
            onClick={onBack}
          >
            ←
          </button>
          <div>
            <h2 className="text-[20px] font-extrabold text-textLight">RenoPay Gift Card</h2>
            <p className="text-muted text-[11px]">Send instant digital cash vouchers</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-muted text-[10px] uppercase font-bold tracking-wider">Wallet Balance</p>
          <p className="text-accent font-mono font-extrabold text-sm">
            {fmt(profile?.account?.balance ?? 0)}
          </p>
        </div>
      </div>

      <div className="px-[22px]">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-card/70 border border-line rounded-2xl mb-5">
          <button
            type="button"
            className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === "create" ? "bg-accent text-white shadow-md shadow-accent/20" : "text-muted hover:text-textLight"
            }`}
            onClick={() => {
              setTab("create");
              setCreatedCard(null);
            }}
          >
            <span>🎁</span>
            <span>Create</span>
          </button>
          <button
            type="button"
            className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === "claim" ? "bg-accent text-white shadow-md shadow-accent/20" : "text-muted hover:text-textLight"
            }`}
            onClick={() => {
              setTab("claim");
              setClaimResult(null);
            }}
          >
            <span>🎟️</span>
            <span>Claim</span>
          </button>
          <button
            type="button"
            className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === "history" ? "bg-accent text-white shadow-md shadow-accent/20" : "text-muted hover:text-textLight"
            }`}
            onClick={() => setTab("history")}
          >
            <span>📜</span>
            <span>My Cards</span>
          </button>
        </div>

        {/* ---------------- CREATE GIFT CARD ---------------- */}
        {tab === "create" && (
          <div className="animate-fadeUp">
            {!createdCard ? (
              <>
                {/* Live Card Preview */}
                <div
                  className={`p-5 rounded-2xl border-2 mb-5 relative overflow-hidden bg-gradient-to-br ${activeTheme.grad} shadow-xl`}
                  style={{ borderColor: activeTheme.border }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[10px] text-muted tracking-widest font-extrabold uppercase">RenoPay Bearer Voucher</p>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                        <span>{activeTheme.icon}</span> RenoPay Gift Card
                      </h3>
                    </div>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                      style={{ background: `${activeTheme.border}22`, borderColor: activeTheme.border, color: activeTheme.badge }}
                    >
                      Instant Redeem
                    </span>
                  </div>

                  <div className="my-4 text-center py-2 bg-black/40 rounded-xl border border-white/5 backdrop-blur-sm">
                    <p className="text-muted text-[10px] tracking-wider uppercase font-semibold">Voucher Value</p>
                    <p className="text-[34px] font-extrabold text-white font-mono tracking-tight my-0.5">
                      {fmt(Number(amount) || 0)}
                    </p>
                    <p className="text-emerald-400 text-[10px] font-medium">✓ Guaranteed & Pre-funded</p>
                  </div>

                  <div className="flex justify-between items-end text-xs">
                    <div>
                      <p className="text-muted text-[10px]">For</p>
                      <p className="font-semibold text-textLight truncate max-w-[150px]">
                        {recipientName.trim() || "Recipient"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted text-[10px]">Message</p>
                      <p className="font-semibold text-textLight italic truncate max-w-[140px]">
                        “{message || "Best Wishes!"}”
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amount Selection */}
                <Card className="p-4 mb-4 border-accent/[.2]">
                  <p className="text-muted text-[11px] font-bold uppercase tracking-wide mb-2.5">Select or Enter Amount</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl text-accent font-mono font-bold">₹</span>
                    <input
                      type="number"
                      placeholder="500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="text-2xl font-extrabold font-mono bg-transparent border-none border-b-2 border-accent rounded-none pl-0 w-full focus:outline-none text-textLight"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          Number(amount) === p
                            ? "bg-accent/20 border-accent text-accent shadow-sm"
                            : "bg-surf/80 border-line text-muted hover:text-textLight hover:border-accent/40"
                        }`}
                        onClick={() => setAmount(String(p))}
                      >
                        ₹{p}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Personalization */}
                <Card className="p-4 mb-4 border-line">
                  <p className="text-muted text-[11px] font-bold uppercase tracking-wide mb-2.5">Personalize (Optional)</p>
                  <div className="mb-3">
                    <label className="text-[11px] text-muted block mb-1">Recipient Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      maxLength={80}
                      className="w-full text-xs"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="text-[11px] text-muted block mb-1">Greeting / Message</label>
                    <input
                      type="text"
                      placeholder="e.g. Best Wishes! 🌟"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={120}
                      className="w-full text-xs mb-2"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {GREETINGS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          className="text-[10px] px-2.5 py-1 rounded-full bg-surf border border-line text-muted hover:text-textLight hover:border-accent/30 cursor-pointer"
                          onClick={() => setMessage(g)}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted block mb-1.5">Card Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                            theme === t.id
                              ? "bg-accent/15 border-accent text-white shadow-sm"
                              : "bg-surf border-line text-muted hover:text-textLight"
                          }`}
                          onClick={() => setTheme(t.id)}
                        >
                          <span>{t.icon}</span>
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>

                {createError && (
                  <p className="text-danger text-xs text-center mb-3">{createError}</p>
                )}

                <Btn onClick={handleStartCreate} disabled={creating}>
                  {creating ? "Generating Gift Card..." : `Generate Gift Card • ₹${amount || 0}`}
                </Btn>
              </>
            ) : (
              /* Success Creation Screen */
              <div className="animate-fadeUp text-center pt-3">
                <div className="w-[84px] h-[84px] rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                  🎁
                </div>
                <h3 className="text-2xl font-extrabold text-white">Gift Card Generated!</h3>
                <p className="text-muted text-xs mt-1">
                  ₹{createdCard.amount} pre-funded and ready to share
                </p>

                {/* Voucher Card Result */}
                <div className="my-5 p-5 rounded-2xl bg-gradient-to-br from-[#1F1912] to-[#120F0D] border-2 border-amber-500 shadow-2xl text-left">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-amber-400">⚡ RENOPAY GIFT CARD</span>
                    <Badge color="#F59E0B">Active</Badge>
                  </div>

                  <p className="text-muted text-[11px] uppercase font-bold">Unique Gift Card Code</p>
                  <div className="flex items-center justify-between bg-black/60 p-3 rounded-xl border border-amber-500/30 my-1.5">
                    <span className="font-mono text-xl font-extrabold text-white tracking-wider select-all">
                      {createdCard.card_code}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 text-black hover:bg-amber-400 active:scale-95 transition-all cursor-pointer"
                      onClick={() => handleCopy(createdCard.card_code)}
                    >
                      {copiedCode ? "✓ Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-line/60 flex justify-between text-xs text-muted">
                    <span>Value: <strong className="text-white">₹{createdCard.amount}</strong></span>
                    <span>Valid For: <strong className="text-white">1 Year</strong></span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2.5 mb-5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn flex-1 py-3 px-3 rounded-xl bg-card border border-accent/40 text-accent font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-accent/10 transition-all cursor-pointer"
                      onClick={() => handleViewPdf(createdCard)}
                    >
                      <span>👁</span>
                      <span>View PDF Voucher</span>
                    </button>
                    <button
                      type="button"
                      className="btn flex-1 py-3 px-3 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-accent/25 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                      onClick={() => handleDownloadPdf(createdCard)}
                    >
                      <span>⬇</span>
                      <span>Download PDF</span>
                    </button>
                  </div>

                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setCreatedCard(null);
                      setAmount("500");
                      setRecipientName("");
                    }}
                  >
                    + Create Another Card
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- CLAIM GIFT CARD ---------------- */}
        {tab === "claim" && (
          <div className="animate-fadeUp">
            {!claimResult ? (
              <form onSubmit={handleClaim}>
                <Card className="p-5 mb-4 border-accent/[.25] relative glow-hero shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-2xl mx-auto mb-3">
                    🎟️
                  </div>
                  <h3 className="text-center text-base font-extrabold text-white mb-1">
                    Redeem RenoPay Gift Card
                  </h3>
                  <p className="text-center text-muted text-xs mb-4">
                    Enter the unique 16-character code printed on your gift card or PDF voucher.
                  </p>

                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="RENO-GIFT-XXXX-XXXX"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                      className="w-full font-mono text-center text-base font-bold tracking-widest uppercase pr-16 py-3.5"
                    />
                    <button
                      type="button"
                      onClick={handlePasteCode}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-card border border-line text-muted hover:text-textLight text-[11px] font-bold cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>

                  <p className="text-[10.5px] text-muted text-center mt-2">
                    Funds will be deposited immediately into your RenoPay account balance.
                  </p>
                </Card>

                {claimError && (
                  <p className="text-danger text-xs text-center mb-3.5">{claimError}</p>
                )}

                <Btn type="submit" disabled={claiming || !claimCode.trim()}>
                  {claiming ? "Verifying & Claiming..." : "Claim to Account Balance"}
                </Btn>
              </form>
            ) : (
              /* Claim Success Screen */
              <div className="animate-fadeUp text-center pt-4">
                <div className="w-[84px] h-[84px] rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                  ✓
                </div>
                <h3 className="text-2xl font-extrabold text-emerald-400">Gift Card Claimed!</h3>
                <p className="text-white text-base font-bold mt-1.5">
                  ₹{claimResult.amount} Credited Successfully
                </p>
                <p className="text-muted text-xs mt-0.5">Code: {claimResult.card_code}</p>

                <div className="my-5 p-4 rounded-xl bg-card border border-line flex justify-between items-center text-sm">
                  <span className="text-muted text-xs">Updated Wallet Balance:</span>
                  <span className="text-accent font-bold font-mono text-base">
                    {fmt(claimResult.new_balance)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Btn variant="dark" onClick={() => onBack()} className="flex-1">
                    Home
                  </Btn>
                  <Btn
                    variant="teal"
                    onClick={() => {
                      setClaimResult(null);
                      setClaimCode("");
                    }}
                    className="flex-1"
                  >
                    Claim Another
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- MY GIFT CARDS HISTORY ---------------- */}
        {tab === "history" && (
          <div className="animate-fadeUp">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  historyFilter === "created"
                    ? "bg-accent/20 border-accent text-accent"
                    : "bg-card border-line text-muted"
                }`}
                onClick={() => setHistoryFilter("created")}
              >
                Created by Me ({myCards.created.length})
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  historyFilter === "claimed"
                    ? "bg-accent/20 border-accent text-accent"
                    : "bg-card border-line text-muted"
                }`}
                onClick={() => setHistoryFilter("claimed")}
              >
                Claimed by Me ({myCards.claimed.length})
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent mx-auto"></div>
                <p className="text-muted text-xs mt-3">Loading gift cards...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(historyFilter === "created" ? myCards.created : myCards.claimed).map((c) => (
                  <Card key={c.id} className="p-4 border-line hover:border-accent/30 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono text-sm font-extrabold text-white">{c.card_code}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {historyFilter === "created"
                            ? c.recipient_name ? `For ${c.recipient_name}` : "Bearer Card"
                            : `Claimed on ${new Date(c.claimed_at || c.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-accent text-sm">₹{c.amount}</p>
                        <Badge
                          color={c.status === "active" ? "#F59E0B" : c.status === "claimed" ? "#22C55E" : "#94A3B8"}
                          size={9}
                        >
                          {c.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-line/50 flex justify-between items-center text-xs">
                      <button
                        type="button"
                        className="text-muted hover:text-accent flex items-center gap-1 font-semibold cursor-pointer"
                        onClick={() => handleCopy(c.card_code)}
                      >
                        <span>📋</span>
                        <span>Copy Code</span>
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-accent hover:underline font-bold cursor-pointer"
                          onClick={() => handleViewPdf(c)}
                        >
                          👁 View PDF
                        </button>
                        <span className="text-muted">·</span>
                        <button
                          type="button"
                          className="text-accent hover:underline font-bold cursor-pointer"
                          onClick={() => handleDownloadPdf(c)}
                        >
                          ⬇ Download
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}

                {(historyFilter === "created" ? myCards.created : myCards.claimed).length === 0 && (
                  <div className="text-center py-12 text-muted text-xs">
                    <p className="text-3xl mb-2">🎟️</p>
                    <p>No gift cards found in this category.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PIN Pad Modal for creation authentication */}
      {showPinPad && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <Card className="p-5 border-accent/[.3]">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-extrabold text-sm text-textLight">Authorize Gift Card Creation</h3>
                <button
                  type="button"
                  onClick={() => setShowPinPad(false)}
                  className="text-muted hover:text-textLight text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-muted text-xs mb-4 text-center">
                Deducting <strong>₹{amount}</strong> from wallet to fund gift voucher.
              </p>
              <PINPad onComplete={handlePinComplete} label="Enter UPI PIN" />
            </Card>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
        loading={pdfLoading}
      />
    </div>
  );
}
