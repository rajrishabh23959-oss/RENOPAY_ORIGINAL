import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { GiftCardAPI } from "../lib/api";
import { fmt } from "../lib/format";
import { downloadOrSharePdf } from "../lib/download";
import { Card, Btn, Badge } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { PdfPreviewModal } from "../components/PdfPreviewModal";

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

export function GiftCardScreen({ onBack, initialClaimCode = "", onScanQr }) {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState(initialClaimCode ? "claim" : "create"); // "create" | "claim" | "history"

  // Creation State
  const [amount, setAmount] = useState("500");
  const [recipientName, setRecipientName] = useState("");
  const [paymentMode, setPaymentMode] = useState("normal"); // "normal" | "advance"
  const [message, setMessage] = useState("Best Wishes! 🌟");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCard, setCreatedCard] = useState(null);

  // Claim State
  const [claimCode, setClaimCode] = useState(initialClaimCode || "");
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

  useEffect(() => {
    if (initialClaimCode) {
      setTab("claim");
      setClaimCode(initialClaimCode);
    }
  }, [initialClaimCode]);

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

  const handleStartCheckout = (e) => {
    e?.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      setCreateError("Please enter a valid amount greater than ₹0.");
      return;
    }
    const currentBal = (profile?.account?.balance ?? 0);
    if (paymentMode === "normal" && num > currentBal) {
      setCreateError(`Insufficient wallet balance for Normal Pay (Available: ${fmt(currentBal)}). Switch to Advance Pay or enter a lower amount.`);
      return;
    }
    setCreateError("");
    setShowCheckoutModal(true);
  };

  const handlePinComplete = async (pin) => {
    setCreating(true);
    setCreateError("");
    try {
      const res = await GiftCardAPI.create({
        amount: Number(amount),
        pin,
        payment_mode: paymentMode,
        recipient_name: recipientName.trim() || undefined,
        message: message.trim() || undefined,
        theme: "emerald",
      });
      setShowCheckoutModal(false);
      setCreatedCard(res);
      await refreshProfile?.();
    } catch (err) {
      let msg = "Failed to create gift card. Please check your PIN and balance.";
      if (err.response?.data) {
        const detail = err.response.data.detail;
        msg = typeof detail === "object" ? detail.message : (detail || msg);
      }
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleClaim = async (e) => {
    e?.preventDefault();
    const code = claimCode.trim().toUpperCase();
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
      let msg = "Could not claim gift card. Check code and try again.";
      if (err.response?.data) {
        const detail = err.response.data.detail;
        msg = typeof detail === "object" ? detail.message : (detail || msg);
      }
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
          setClaimCode(text.trim().toUpperCase());
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
    } catch (err) {
      let errMsg = "Failed to load PDF preview. Please try again.";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) errMsg = typeof json.detail === "string" ? json.detail : (json.detail.message || errMsg);
        } catch {
          // ignore
        }
      }
      alert(errMsg);
      setPdfModalOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = async (card) => {
    try {
      const blob = await GiftCardAPI.downloadPdf(card.id);
      await downloadOrSharePdf(blob, `RenoPay_GiftCard_${card.card_code}.pdf`);
    } catch (err) {
      let errMsg = "Failed to download PDF voucher.";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) errMsg = typeof json.detail === "string" ? json.detail : (json.detail.message || errMsg);
        } catch {
          // ignore
        }
      }
      alert(errMsg);
    }
  };

  const senderDisplayName = (profile?.full_name || "RISHABH Raj").trim();

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
            <p className="text-muted text-[11px]">Luxury digital cash vouchers</p>
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
                {/* 🌟 EMERALD & GOLD LUXURY GIFT CARD PREVIEW (Exact match to reference) */}
                <div className="relative rounded-[22px] border-2 border-[#c9a44c] p-[3px] shadow-[0_15px_35px_rgba(0,0,0,0.6)] mb-5 overflow-hidden bg-gradient-to-b from-[#123824] via-[#092b1b] to-[#051a10]">
                  {/* Inner Hairline Frame */}
                  <div className="border border-[#e0be6c]/70 rounded-[18px] p-5 relative">
                    {/* Top Row: Ribbon Bow, Crest & Mode */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-bold text-[#a1d1b5] tracking-widest uppercase">⚡ RENOPAY</span>
                        <div className="text-[10px] font-extrabold text-[#ffd875]">LUXURY VOUCHER</div>
                      </div>

                      {/* Top Crest & FROM */}
                      <div className="text-center -mt-1">
                        {/* Golden Pin Icon */}
                        <div className="text-[#ffd875] text-lg leading-none">📌</div>
                        <div className="text-[10px] font-bold text-[#c9a44c] tracking-[4px] uppercase mt-0.5">
                          F R O M
                        </div>
                        <div className="font-serif text-[22px] font-bold text-[#f5d78a] tracking-wide leading-tight mt-0.5 drop-shadow">
                          {senderDisplayName}
                        </div>
                        <div className="h-[1px] w-28 bg-[#c9a44c]/70 mx-auto my-1.5"></div>
                      </div>

                      {/* Top-Right Golden Ribbon Bow */}
                      <div className="text-right">
                        <div className="inline-block text-2xl filter drop-shadow-[0_2px_6px_rgba(255,215,0,0.5)]">
                          🎀
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Gift Card ID & Value */}
                    <div className="my-3.5 text-center">
                      <div className="text-[10px] font-bold text-[#c9a44c] tracking-[3px] uppercase">
                        G I F T &nbsp; C A R D &nbsp; I D -
                      </div>
                      <div className="font-mono text-xl font-extrabold text-[#ffe08a] tracking-[3px] my-1">
                        RENO-GIFT •••• ••••
                      </div>

                      {/* Amount Centerpiece */}
                      <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/40 border border-[#c9a44c]/40 backdrop-blur-sm">
                        <span className="text-[11px] text-[#a1d1b5] uppercase font-bold tracking-wider">VALUE:</span>
                        <span className="font-mono text-2xl font-extrabold text-[#ffd875]">
                          {fmt(Number(amount) || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Recipient, QR Scanner Box & RP Wax Seal */}
                    <div className="flex justify-between items-end pt-2 border-t border-[#c9a44c]/30">
                      {/* TO: Recipient */}
                      <div className="max-w-[140px]">
                        <div className="font-serif text-sm font-bold text-[#f5d78a] flex items-center gap-1">
                          <span>TO</span>
                          <span className="border-b border-[#c9a44c] pb-0.5 truncate text-white">
                            {recipientName.trim() || "___________________"}
                          </span>
                        </div>
                        <div className="text-[9px] text-[#a1d1b5] mt-1 font-medium">
                          100% Redeemable to Wallet
                        </div>
                      </div>

                      {/* Dynamic QR Scanner Box on the Card */}
                      <div className="flex flex-col items-center">
                        <div className="w-[58px] h-[58px] p-1 bg-white rounded-lg border-2 border-[#c9a44c] shadow flex items-center justify-center">
                          {/* Miniature High-Contrast QR Matrix Preview */}
                          <div className="w-full h-full bg-black flex flex-col justify-between p-1 rounded">
                            <div className="flex justify-between">
                              <div className="w-2.5 h-2.5 bg-white border border-black"></div>
                              <div className="w-2.5 h-2.5 bg-white border border-black"></div>
                            </div>
                            <div className="text-[6px] text-white font-mono text-center tracking-tighter">
                              RENO-QR
                            </div>
                            <div className="flex justify-between">
                              <div className="w-2.5 h-2.5 bg-white border border-black"></div>
                              <div className="w-1.5 h-1.5 bg-white"></div>
                            </div>
                          </div>
                        </div>
                        <span className="text-[7.5px] font-extrabold text-[#ffd875] tracking-wider mt-1 uppercase">
                          SCAN TO CLAIM
                        </span>
                      </div>

                      {/* Bottom-Right Golden Wax Seal with RP Monogram */}
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f0c36b] via-[#c49233] to-[#7a4f0c] border-2 border-[#fff0c2] shadow-[0_4px_10px_rgba(0,0,0,0.5)] flex items-center justify-center font-serif text-lg font-black text-[#3d2402] tracking-tighter">
                          RP
                        </div>
                        <span className="text-[7.5px] font-bold text-[#c9a44c] mt-1 tracking-wider uppercase">
                          SEAL
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount Selection */}
                <Card className="p-4 mb-4 border-accent/[.2]">
                  <p className="text-muted text-[11px] font-bold uppercase tracking-wide mb-2.5">
                    Select or Enter Amount
                  </p>
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

                {/* Payment Mode Selector */}
                <Card className="p-4 mb-4 border-line">
                  <p className="text-muted text-[11px] font-bold uppercase tracking-wide mb-2.5">
                    Choose Pay Option
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        paymentMode === "normal"
                          ? "bg-emerald-500/15 border-emerald-500 text-white shadow"
                          : "bg-surf border-line text-muted hover:text-textLight"
                      }`}
                      onClick={() => setPaymentMode("normal")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-extrabold text-emerald-400">🟢 Normal Pay</span>
                        {paymentMode === "normal" && <span className="text-emerald-400 text-xs">✓</span>}
                      </div>
                      <p className="text-[10px] text-muted leading-tight">
                        Deduct from RenoPay Wallet
                      </p>
                      <p className="text-[10px] font-mono text-emerald-400 mt-1">
                        Avail: {fmt(profile?.account?.balance ?? 0)}
                      </p>
                    </button>

                    <button
                      type="button"
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        paymentMode === "advance"
                          ? "bg-accent/15 border-accent text-white shadow"
                          : "bg-surf border-line text-muted hover:text-textLight"
                      }`}
                      onClick={() => setPaymentMode("advance")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-extrabold text-accent">⚡ Advance Pay</span>
                        {paymentMode === "advance" && <span className="text-accent text-xs">✓</span>}
                      </div>
                      <p className="text-[10px] text-muted leading-tight">
                        Bank Account / Advance Line
                      </p>
                      <p className="text-[10px] font-mono text-accent mt-1">
                        Verified UPI Mandate
                      </p>
                    </button>
                  </div>
                </Card>

                {createError && (
                  <p className="text-danger text-xs text-center mb-3">{createError}</p>
                )}

                <Btn onClick={handleStartCheckout} disabled={creating}>
                  {`Proceed to Gift • ₹${amount || 0}`}
                </Btn>
              </>
            ) : (
              /* Success Creation Screen */
              <div className="animate-fadeUp text-center pt-2">
                <div className="w-[74px] h-[74px] rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-3xl mx-auto mb-3 animate-bounce">
                  🎁
                </div>
                <h3 className="text-2xl font-extrabold text-white">Gift Card Generated!</h3>
                <p className="text-muted text-xs mt-1">
                  ₹{createdCard.amount} pre-funded and ready to download & share
                </p>

                {/* Voucher Card Result in Emerald & Gold */}
                <div className="my-5 rounded-[22px] border-2 border-[#c9a44c] p-[3px] shadow-2xl text-left bg-gradient-to-b from-[#123824] via-[#092b1b] to-[#051a10]">
                  <div className="border border-[#e0be6c]/70 rounded-[18px] p-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-extrabold text-[#ffd875] tracking-widest uppercase">
                        ⚡ RENOPAY GIFT CARD
                      </span>
                      <Badge color="#22C55E">ACTIVE</Badge>
                    </div>

                    <div className="text-center my-3">
                      <p className="text-[10px] text-[#c9a44c] uppercase font-bold tracking-[3px]">
                        G I F T &nbsp; C A R D &nbsp; I D -
                      </p>
                      <div className="flex items-center justify-between bg-black/60 p-3 rounded-xl border border-[#c9a44c]/40 my-2">
                        <span className="font-mono text-xl font-extrabold text-[#ffe08a] tracking-wider select-all">
                          {createdCard.card_code}
                        </span>
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#c9a44c] text-black hover:bg-[#e0be6c] active:scale-95 transition-all cursor-pointer"
                          onClick={() => handleCopy(createdCard.card_code)}
                        >
                          {copiedCode ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-[#c9a44c]/30 text-xs">
                      <div>
                        <p className="text-[#a1d1b5] text-[10px]">Recipient</p>
                        <p className="font-semibold text-white">
                          {createdCard.recipient_name || "Valued Bearer"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#a1d1b5] text-[10px]">Value</p>
                        <p className="font-mono font-bold text-[#ffd875] text-base">
                          ₹{createdCard.amount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF Action Buttons */}
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
                      className="btn flex-1 py-3 px-3 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-accent/20 hover:bg-accent/90 transition-all cursor-pointer"
                      onClick={() => handleDownloadPdf(createdCard)}
                    >
                      <span>⬇</span>
                      <span>Download PDF</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="text-muted text-xs hover:text-white py-2 transition-all cursor-pointer"
                    onClick={() => {
                      setCreatedCard(null);
                      setRecipientName("");
                    }}
                  >
                    + Create Another Gift Card
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- CHECKOUT & PIN MODAL ---------------- */}
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end justify-center animate-fadeUp p-0">
            <div className="w-full max-w-[430px] bg-card border-t border-line rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto">
              <div className="w-12 h-1 bg-line rounded-full mx-auto mb-4"></div>

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-white">Authorize Gift Card</h3>
                  <p className="text-xs text-muted">Amount: <strong className="text-accent font-mono">₹{amount}</strong></p>
                </div>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-surf border border-line text-muted flex items-center justify-center text-sm hover:text-white cursor-pointer"
                  onClick={() => setShowCheckoutModal(false)}
                >
                  ✕
                </button>
              </div>

              {/* 1. Recipient Name Prompt */}
              <div className="mb-4">
                <label className="text-xs text-[#ffd875] font-bold block mb-1.5">
                  👤 Kisko bhej rahe hain? (Recipient Name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma / Sister / Friend"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  maxLength={60}
                  className="w-full p-3 rounded-xl bg-surf border border-line text-sm text-white focus:border-accent focus:outline-none"
                />
              </div>

              {/* 2. Payment Mode Selection */}
              <div className="mb-5">
                <label className="text-xs text-muted font-bold block mb-1.5">
                  💳 Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`p-2.5 rounded-xl text-left border text-xs font-semibold cursor-pointer ${
                      paymentMode === "normal"
                        ? "bg-emerald-500/15 border-emerald-500 text-white"
                        : "bg-surf border-line text-muted"
                    }`}
                    onClick={() => setPaymentMode("normal")}
                  >
                    🟢 Normal Pay
                    <div className="text-[10px] text-muted font-normal">Wallet Balance</div>
                  </button>
                  <button
                    type="button"
                    className={`p-2.5 rounded-xl text-left border text-xs font-semibold cursor-pointer ${
                      paymentMode === "advance"
                        ? "bg-accent/15 border-accent text-white"
                        : "bg-surf border-line text-muted"
                    }`}
                    onClick={() => setPaymentMode("advance")}
                  >
                    ⚡ Advance Pay
                    <div className="text-[10px] text-muted font-normal">Bank Account</div>
                  </button>
                </div>
              </div>

              {/* 3. PIN Pad */}
              <div className="text-center mb-2">
                <p className="text-xs font-bold text-muted mb-2">Enter 6-Digit UPI PIN to Confirm</p>
                <PINPad
                  onComplete={handlePinComplete}
                  length={6}
                />
              </div>

              {creating && (
                <div className="text-center py-2 text-accent text-xs font-bold animate-pulse">
                  Generating Emerald Gift Card & PDF Voucher...
                </div>
              )}

              {createError && (
                <p className="text-danger text-xs text-center mt-2">{createError}</p>
              )}
            </div>
          </div>
        )}

        {/* ---------------- CLAIM GIFT CARD ---------------- */}
        {tab === "claim" && (
          <div className="animate-fadeUp">
            {!claimResult ? (
              <Card className="p-5 border-accent/[.2]">
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-3xl mx-auto mb-3">
                    🎟️
                  </div>
                  <h3 className="text-lg font-extrabold text-white">Claim Gift Card</h3>
                  <p className="text-muted text-xs mt-1">
                    Redeem your voucher code or scan voucher QR for instant wallet credit
                  </p>
                </div>

                <form onSubmit={handleClaim}>
                  <div className="mb-4">
                    <label className="text-[11px] text-muted font-bold block mb-1 uppercase tracking-wider">
                      Gift Card Code
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="e.g. RENO-GIFT-A1B2-C3D4"
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                        className="w-full pr-20 font-mono uppercase font-bold text-sm tracking-wider"
                      />
                      <button
                        type="button"
                        className="absolute right-2 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surf border border-line text-muted hover:text-white cursor-pointer"
                        onClick={handlePasteCode}
                      >
                        Paste
                      </button>
                    </div>
                  </div>

                  {claimError && (
                    <p className="text-danger text-xs text-center mb-3">{claimError}</p>
                  )}

                  <div className="flex flex-col gap-2.5">
                    <Btn type="submit" disabled={claiming}>
                      {claiming ? "Verifying & Claiming..." : "Claim Gift Card"}
                    </Btn>

                    {/* Direct Camera Scanner Trigger */}
                    {onScanQr && (
                      <button
                        type="button"
                        className="py-2.5 rounded-xl border border-line bg-surf/80 text-textLight font-semibold text-xs flex items-center justify-center gap-1.5 hover:border-accent/40 cursor-pointer"
                        onClick={onScanQr}
                      >
                        <span>📷</span>
                        <span>Scan Voucher QR Code</span>
                      </button>
                    )}
                  </div>
                </form>
              </Card>
            ) : (
              /* Claim Success Screen */
              <div className="animate-fadeUp text-center pt-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                  ✨
                </div>
                <h3 className="text-2xl font-extrabold text-white">Gift Card Claimed!</h3>
                <p className="text-emerald-400 text-sm font-bold mt-1">
                  ₹{claimResult.amount} added to your account!
                </p>

                <div className="my-5 p-4 rounded-xl bg-card border border-line text-left">
                  <div className="flex justify-between items-center text-xs py-1 border-b border-line/60">
                    <span className="text-muted">Voucher Code</span>
                    <span className="font-mono font-bold text-white">{claimResult.card_code}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1 border-b border-line/60">
                    <span className="text-muted">Amount Credited</span>
                    <span className="font-mono font-extrabold text-emerald-400">₹{claimResult.amount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1">
                    <span className="text-muted">Updated Balance</span>
                    <span className="font-mono font-extrabold text-accent">₹{claimResult.new_balance}</span>
                  </div>
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
                            ? c.recipient_name ? `For ${c.recipient_name}` : "Bearer Voucher"
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
                    No {historyFilter === "created" ? "created" : "claimed"} gift cards found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF Voucher Preview Modal */}
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
