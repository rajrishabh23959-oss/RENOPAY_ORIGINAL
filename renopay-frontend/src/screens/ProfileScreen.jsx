import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import { AccountAPI, AuthAPI, GoldAPI } from "../lib/api";
import { getDeviceFingerprint, getDeviceLabel, fmt } from "../lib/format";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";

const PROFILE_LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🌐" },
  { code: "hi", label: "Hindi", native: "हिंदी", flag: "🇮🇳" },
  { code: "ta", label: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  { code: "te", label: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", flag: "🇮🇳" },
];

export function ProfileScreen({ onBack, onLoggedOut }) {
  const { profile, logout, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetErr, setBudgetErr] = useState("");
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinErr, setPinErr] = useState("");
  const [newPin, setNewPin] = useState("");
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [qrErr, setQrErr] = useState("");
  const qrCanvasRef = useRef(null);

  // Language state
  const [savingLang, setSavingLang] = useState(false);
  const [langErr, setLangErr] = useState("");

  // Gold vault withdrawal states
  const [goldWithdrawStep, setGoldWithdrawStep] = useState(null); // null | "confirm" | "pin" | "success"
  const [goldWithdrawErr, setGoldWithdrawErr] = useState("");
  const [withdrawnGoldAmount, setWithdrawnGoldAmount] = useState(0);
  const [goldWithdrawing, setGoldWithdrawing] = useState(false);


  useEffect(() => {
    if (!profile?.account?.vpa || !qrCanvasRef.current) return;
    const payload = `upi://pay?pa=${profile.account.vpa}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`;
    QRCode.toCanvas(qrCanvasRef.current, payload, {
      width: 190,
      margin: 1,
      color: { dark: "#0f0d0c", light: "#ffffff" },
    }).catch(() => setQrErr("Could not render QR code"));
  }, [profile?.account?.vpa, profile?.full_name]);

  const copyVpa = async () => {
    try {
      await navigator.clipboard.writeText(profile.account.vpa);
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadQrCard = async () => {
    if (!profile?.account?.vpa) return;
    setDownloadingQr(true);
    try {
      const payload = `upi://pay?pa=${profile.account.vpa}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`;
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
        color: { dark: "#0f0d0c", light: "#ffffff" },
      });

      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const width = 640;
      const height = 820;
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");

      // Draw stylish background card
      ctx.fillStyle = "#120E0C";
      ctx.fillRect(0, 0, width, height);

      // Gradient accent header strip
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#FF6A1A");
      grad.addColorStop(1, "#B8420E");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 8);

      // Card inner border
      ctx.strokeStyle = "#2A2320";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Header logo / app name
      ctx.fillStyle = "#FF6A1A";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ RENOPAY", width / 2, 70);

      ctx.fillStyle = "#8C827A";
      ctx.font = "14px sans-serif";
      ctx.fillText("Instant UPI & Digital Banking", width / 2, 95);

      // White box for QR code
      const boxSize = 380;
      const boxX = (width - boxSize) / 2;
      const boxY = 125;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxSize, boxSize, 20);
      ctx.fill();

      // Draw QR image centered inside the white box
      ctx.drawImage(img, boxX + 30, boxY + 30, 320, 320);

      // Payee Name
      ctx.fillStyle = "#F5F3F0";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(profile.full_name, width / 2, 560);

      // Payee VPA / UPI ID
      ctx.fillStyle = "#FF6A1A";
      ctx.font = "bold 20px monospace";
      ctx.fillText(profile.account.vpa, width / 2, 600);

      // Divider line
      ctx.strokeStyle = "#2A2320";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, 640);
      ctx.lineTo(width - 80, 640);
      ctx.stroke();

      // Badges / Footer text
      ctx.fillStyle = "#22C55E";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("✔ Verified RenoPay ID", width / 2, 675);

      ctx.fillStyle = "#8C827A";
      ctx.font = "13px sans-serif";
      ctx.fillText("Scan with RenoPay or any UPI app to pay", width / 2, 715);

      ctx.fillStyle = "#5C564F";
      ctx.font = "11px sans-serif";
      ctx.fillText("Powered by RenoPay SentinAI Engine", width / 2, 755);

      const downloadUrl = c.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `renopay-qr-${profile.account.vpa.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
      link.click();
    } catch (e) {
      console.error("QR download error:", e);
      setQrErr("Failed to generate download image");
    } finally {
      setDownloadingQr(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accent"></div>
      </div>
    );
  }
  const acc = profile.account;
  const kycCol = profile.kyc_status === "verified" ? "#22C55E" : "#FFA000";

  const trustDevice = async () => {
    setBusy(true);
    await AccountAPI.trustDevice(getDeviceFingerprint(), getDeviceLabel());
    await refreshProfile();
    setBusy(false);
  };

  const toggleRoundUp = async () => {
    setBusy(true);
    await AccountAPI.toggleRoundUp(!acc.round_up_enabled);
    await refreshProfile();
    setBusy(false);
  };

  const executeGoldWithdraw = async (pin) => {
    setGoldWithdrawErr("");
    setGoldWithdrawing(true);
    try {
      const amountToWithdraw = acc.digital_gold;
      await GoldAPI.withdraw(pin);
      setWithdrawnGoldAmount(amountToWithdraw);
      await refreshProfile();
      setGoldWithdrawStep("success");
    } catch (e) {
      console.error("Gold withdrawal error:", e);
      setGoldWithdrawErr(
        e?.response?.data?.detail?.message ||
        e?.response?.data?.detail ||
        "Incorrect UPI PIN or withdrawal failed"
      );
    } finally {
      setGoldWithdrawing(false);
    }
  };

  const saveBudget = async () => {
    if (!Number(budgetInput) || Number(budgetInput) <= 0) { setBudgetErr("Enter a valid amount"); return; }
    setBusy(true); setBudgetErr("");
    try {
      await AccountAPI.updateBudget(Number(budgetInput));
      await refreshProfile();
      setEditingBudget(false);
    } catch {
      setBudgetErr("Could not update budget");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onLoggedOut?.();
  };

  const handleLanguageChange = async (code) => {
    setSavingLang(true);
    setLangErr("");
    try {
      await AccountAPI.updatePreferences({ language_code: code });
      await refreshProfile();
    } catch {
      setLangErr("Could not update preferred language");
    } finally {
      setSavingLang(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {/* Gold Vault Confirmation Modal */}
      {goldWithdrawStep === "confirm" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <Card className="p-6 max-w-[340px] w-full border-line text-center animate-fade-in shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-accent/15 text-accent text-2xl mx-auto mb-3 flex items-center justify-center">
              🪙
            </div>
            <h3 className="text-base font-extrabold text-white mb-2 leading-tight">
              Do you want to withdraw from gold vault?
            </h3>
            <p className="text-muted text-xs mb-5">
              Withdraw <span className="text-accent font-bold font-mono">{fmt(acc.digital_gold)}</span> from your Gold Vault directly to your account balance?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setGoldWithdrawStep("pin"); setGoldWithdrawErr(""); }}
                className="btn py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-[#FF3D60] hover:bg-[#E03450] active:scale-95 shadow-md transition-all cursor-pointer"
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setGoldWithdrawStep(null)}
                className="btn py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-[#22C55E] hover:bg-[#1EA850] active:scale-95 shadow-md transition-all cursor-pointer"
              >
                NO
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Gold Vault PIN Modal */}
      {goldWithdrawStep === "pin" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[999] p-4">
          <Card className="p-6 max-w-[340px] w-full border-accent/[.33] shadow-2xl animate-fade-in">
            <p className="text-center text-textLight font-bold text-sm mb-1">Enter UPI PIN to Withdraw</p>
            <p className="text-center text-accent font-mono font-bold text-lg mb-4">{fmt(acc.digital_gold)}</p>
            {goldWithdrawErr && <p className="text-danger text-xs text-center mb-3 font-semibold">{goldWithdrawErr}</p>}
            {goldWithdrawing && <p className="text-accent text-xs text-center mb-3">Processing withdrawal...</p>}
            <PINPad
              onComplete={executeGoldWithdraw}
              label="6-digit PIN"
              accent="#FF6A1A"
              actionLabel="Withdraw"
              actionType="withdraw"
            />
            <button
              className="btn w-full mt-4 text-muted hover:text-white text-xs py-2 transition-colors cursor-pointer"
              onClick={() => { setGoldWithdrawStep(null); setGoldWithdrawErr(""); }}
              disabled={goldWithdrawing}
            >
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* Gold Vault Success Modal */}
      {goldWithdrawStep === "success" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[999] p-4">
          <Card className="p-6 max-w-[340px] w-full border-teal/40 text-center shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-teal/20 text-teal text-2xl mx-auto mb-3 flex items-center justify-center">
              ✓
            </div>
            <h3 className="text-base font-extrabold text-white mb-1">Withdrawal Successful!</h3>
            <p className="text-muted text-xs mb-4">
              <span className="text-teal font-bold font-mono">{fmt(withdrawnGoldAmount)}</span> has been credited back to your account balance.
            </p>
            <button
              className="btn w-full py-2.5 rounded-xl bg-accent text-white font-bold text-xs shadow-accentGlow cursor-pointer"
              onClick={() => setGoldWithdrawStep(null)}
            >
              Done
            </button>
          </Card>
        </div>
      )}

      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Profile</h2>
      </div>
      <div className="px-[22px]">
        <Card className="p-7 mb-3.5 text-center border-accent/[.2] relative glow-hero">
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-full mx-auto mb-3.5 bg-gradient-to-br from-accent to-[#B8420E] flex items-center justify-center text-3xl font-extrabold border-2 border-accent/[.33]">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : profile.full_name[0]}
            </div>
            <h3 className="text-[22px] font-extrabold text-textLight">{profile.full_name}</h3>
            <p className="text-accent mt-1 text-sm">{acc.vpa}</p>
            <div className="mt-2.5 flex gap-2 justify-center flex-wrap">
              <Badge color="#22C55E">🛡 SentinAI Active</Badge>
              <Badge color={kycCol}>{profile.kyc_status === "verified" ? "✅" : "⏳"} KYC {profile.kyc_status}</Badge>
              <Badge color={profile.is_trusted_device ? "#22C55E" : "#ff3d60"} size={9}>
                {profile.is_trusted_device ? "🔒 Trusted Device" : "⚠ New Device"}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4 mb-3.5" style={{ border: `1px solid ${acc.round_up_enabled ? "#FF6A1A55" : "#2A2320"}` }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-sm text-textLight">🪙 Round-Up to Digital Gold</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-muted text-[11px]">Vault: {fmt(acc.digital_gold)}</p>
                {acc.digital_gold > 0 && (
                  <button
                    type="button"
                    onClick={() => { setGoldWithdrawStep("confirm"); setGoldWithdrawErr(""); }}
                    className="btn px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all cursor-pointer"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
            <button className="btn w-[52px] h-7 rounded-full relative" disabled={busy} style={{ background: acc.round_up_enabled ? "#FF6A1A" : "#5C564F44" }} onClick={toggleRoundUp}>
              <div className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all" style={{ left: acc.round_up_enabled ? 26 : 3 }} />
            </button>
          </div>
        </Card>


        <Card className="p-4 mb-3.5 border-accent/[.2]">
          {editingBudget ? (
            <div>
              <p className="font-bold text-sm mb-2.5 text-textLight">📊 Monthly Budget</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg text-accent">₹</span>
                <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="text-base font-semibold" autoFocus />
              </div>
              {budgetErr && <p className="text-danger text-[11px] mb-2">{budgetErr}</p>}
              <div className="flex gap-2">
                <Btn variant="dark" className="flex-1 py-2" onClick={() => setEditingBudget(false)}>Cancel</Btn>
                <Btn className="flex-1 py-2" disabled={busy} onClick={saveBudget}>Save</Btn>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <div><p className="font-bold text-sm text-textLight">📊 Monthly Budget</p><p className="text-muted text-[11px] mt-0.5">Used for spending predictions & tracker</p></div>
              <div className="text-right flex items-center gap-2.5">
                <p className="font-mono font-bold text-sm text-accent">{fmt(acc.monthly_budget)}</p>
                <button className="btn text-accent text-xs font-semibold" onClick={() => { setBudgetInput(String(acc.monthly_budget)); setEditingBudget(true); }}>Edit</button>
              </div>
            </div>
          )}
        </Card>

        {/* Preferred Language Selector Card */}
        <Card className="p-4 mb-3.5 border-accent/[.2]">
          <div className="flex justify-between items-center mb-2.5">
            <div>
              <p className="font-bold text-sm text-textLight flex items-center gap-1.5">
                <span>🌐</span> Preferred Language / भाषा
              </p>
              <p className="text-muted text-[11px] mt-0.5">
                Controls app context, Saathi AI response & voice language
              </p>
            </div>
            {savingLang && (
              <span className="text-[10px] text-accent font-semibold animate-pulse">
                Saving...
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {PROFILE_LANGUAGES.map((lang) => {
              const isSelected = (profile.language_code || "en") === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  disabled={savingLang}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/20 text-white shadow-sm ring-1 ring-accent/40"
                      : "border-line bg-card/60 text-muted hover:text-textLight hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-textLight">{lang.label}</span>
                    <span className="text-sm">{lang.flag}</span>
                  </div>
                  <span className="text-[11px] text-accent font-medium">{lang.native}</span>
                </button>
              );
            })}
          </div>
          {langErr && <p className="text-danger text-[11px] mt-2">{langErr}</p>}
        </Card>

        {/* Unique Personal QR Code Card */}
        <Card className="p-5 mb-3.5 border-accent/[.25] text-center relative glow-hero">
          <div className="flex justify-between items-center mb-3">
            <div className="text-left">
              <p className="font-bold text-sm text-textLight flex items-center gap-1.5">
                <span>📲</span> Receive Money QR
              </p>
              <p className="text-muted text-[11px] mt-0.5">Scan to pay directly to this account</p>
            </div>
            <Badge color="#22C55E" size={9}>Unique ID</Badge>
          </div>

          <div className="inline-block bg-white p-3 rounded-2xl shadow-lg border border-line my-1.5">
            <canvas ref={qrCanvasRef} className="block rounded-lg mx-auto" />
          </div>

          {qrErr && <p className="text-danger text-xs mt-1.5">{qrErr}</p>}

          <div className="mt-3">
            <p className="text-base font-extrabold text-textLight">{profile.full_name}</p>
            <div className="inline-flex items-center gap-2 mt-1.5 px-3.5 py-1 rounded-full bg-card border border-line">
              <span className="text-accent font-mono text-xs font-bold">{acc.vpa}</span>
              <button
                type="button"
                onClick={copyVpa}
                className="text-[11px] text-muted hover:text-accent font-semibold transition-colors flex items-center gap-1"
              >
                {copiedVpa ? "✅ Copied" : "📋 Copy"}
              </button>
            </div>
            <p className="text-muted text-[11px] mt-2">
              Scan with RenoPay or any UPI app to pay instantly
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-line">
            <button
              type="button"
              className="btn w-full py-2.5 px-4 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              disabled={downloadingQr}
              onClick={downloadQrCard}
            >
              <span className="text-base">📥</span>
              <span>{downloadingQr ? "Generating Card..." : "Download QR Code"}</span>
            </button>
          </div>
        </Card>

        <Card className="p-4 mb-3.5 border-accent/[.2]">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="font-bold text-sm text-textLight">🔐 UPI PIN</p>
              <p className="text-muted text-[11px] mt-0.5">
                {profile.has_upi_pin ? "UPI PIN is set" : "You haven't set a UPI PIN yet — set one to start making payments"}
              </p>
            </div>
            <button className="btn text-accent text-xs font-semibold" onClick={() => { setShowPinPad(true); setPinErr(""); setNewPin(""); }}>
              {profile.has_upi_pin ? "Change PIN" : "Set UPI PIN"}
            </button>
          </div>
          {showPinPad && (
            <div className="mt-4 pt-4 border-t border-line">
              <PINPad 
                label={newPin ? "Confirm new UPI PIN" : "Enter new 6-digit UPI PIN"}
                actionLabel="Check"
                actionType="check"
                onComplete={async (enteredPin) => {
                  if (!newPin) {
                    setNewPin(enteredPin);
                    setPinErr("");
                  } else {
                    if (enteredPin !== newPin) {
                      setPinErr("PINs do not match. Try again.");
                      setNewPin("");
                    } else {
                      setBusy(true); setPinErr("");
                      try {
                        await AuthAPI.setPin(newPin, enteredPin);
                        await refreshProfile();
                        setShowPinPad(false);
                        setNewPin("");
                      } catch (e) {
                        setPinErr(e.response?.data?.detail?.message || e.response?.data?.detail || "Could not set PIN");
                        setNewPin("");
                      } finally {
                        setBusy(false);
                      }
                    }
                  }
                }}
              />
              {pinErr && <p className="text-danger text-xs text-center mt-2">{pinErr}</p>}
              <Btn variant="dark" className="mt-3 w-full" onClick={() => { setShowPinPad(false); setNewPin(""); }}>Cancel</Btn>
            </div>
          )}
        </Card>

        <Card className="p-4 mb-3.5" style={{ border: `1px solid ${kycCol}33` }}>
          <p className="text-muted text-[10px] tracking-wide font-semibold mb-3 uppercase">🪪 KYC & Virtual Account</p>
          {[
            { l: "Virtual A/c", v: acc.virtual_acc_no },
            { l: "IFSC", v: acc.ifsc_code },
            { l: "Linked Bank", v: acc.linked_bank_name },
            { l: "Device", v: profile.is_trusted_device ? "🔒 Trusted" : "⚠ New — Privacy check on next txn" },
          ].map((r) => (
            <div key={r.l} className="flex justify-between py-1.5 border-b border-line last:border-0">
              <span className="text-muted text-xs">{r.l}</span><span className="text-xs font-semibold text-textLight">{r.v}</span>
            </div>
          ))}
        </Card>

        {[
          { l: "Phone", v: profile.phone_number },
          { l: "Balance", v: fmt(acc.balance) },
          { l: "UPI Lite Balance", v: fmt(acc.upi_lite_balance) },
          { l: "Digital Gold", v: fmt(acc.digital_gold) },
        ].map((r) => (
          <Card key={r.l} className="p-4 mb-2.5 flex justify-between items-center">
            <p className="text-muted text-[13px]">{r.l}</p><p className="text-[13px] font-semibold text-textLight">{r.v}</p>
          </Card>
        ))}

        {!profile.is_trusted_device && (
          <div className="mb-2.5"><Btn variant="teal" onClick={trustDevice} disabled={busy}>Trust This Device</Btn></div>
        )}
        <div className="mt-2.5"><Btn variant="danger" onClick={handleLogout}>Logout</Btn></div>
      </div>
    </div>
  );
}
