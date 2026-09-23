import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AccountAPI, AuthAPI, GoldAPI } from "../lib/api";
import { getDeviceFingerprint, getDeviceLabel, fmt } from "../lib/format";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { downloadOrShareFile } from "../lib/download";
import iconAccount from "../assets/actions/account.webp";

export function ProfileScreen({ onBack, onLoggedOut }) {
  const { profile, logout, refreshProfile } = useAuth();
  const { theme, isNightMode, toggleTheme, setTheme } = useTheme();
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

  // Profile Photo states
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isPanningCrop, setIsPanningCrop] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offX: 0, offY: 0 });

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const previewImgRef = useRef(null);

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
      const filename = `renopay-qr-${profile.account.vpa.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
      await downloadOrShareFile(downloadUrl, filename, "image/png");
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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Please choose an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImageSrc(event.target?.result);
      setCropScale(1);
      setCropOffset({ x: 0, y: 0 });
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropPanStart = (clientX, clientY) => {
    setIsPanningCrop(true);
    panStartRef.current = {
      x: clientX,
      y: clientY,
      offX: cropOffset.x,
      offY: cropOffset.y,
    };
  };

  const handleCropPanMove = (clientX, clientY) => {
    if (!isPanningCrop) return;
    const deltaX = clientX - panStartRef.current.x;
    const deltaY = clientY - panStartRef.current.y;
    setCropOffset({
      x: panStartRef.current.offX + deltaX,
      y: panStartRef.current.offY + deltaY,
    });
  };

  const handleCropPanEnd = () => {
    setIsPanningCrop(false);
  };

  const handleSaveCroppedPhoto = async () => {
    if (!previewImgRef.current) return;
    setUploadingPhoto(true);
    setPhotoErr("");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");

      const img = previewImgRef.current;
      const aspect = img.naturalWidth / img.naturalHeight;

      let drawW, drawH;
      if (aspect >= 1) {
        drawH = 500 * cropScale;
        drawW = drawH * aspect;
      } else {
        drawW = 500 * cropScale;
        drawH = drawW / aspect;
      }

      const drawX = (500 - drawW) / 2 + cropOffset.x;
      const drawY = (500 - drawH) / 2 + cropOffset.y;

      ctx.fillStyle = "#181412";
      ctx.fillRect(0, 0, 500, 500);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("Could not process image");

      const formData = new FormData();
      formData.append("file", blob, "avatar.webp");

      await AccountAPI.uploadProfilePhoto(formData);
      await refreshProfile();
      setCropModalOpen(false);
      setSelectedImageSrc(null);
    } catch (err) {
      console.error("Photo upload error:", err);
      setPhotoErr(err?.response?.data?.detail || "Could not upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    setShowPhotoSheet(false);
    setUploadingPhoto(true);
    setPhotoErr("");
    try {
      await AccountAPI.deleteProfilePhoto();
      await refreshProfile();
    } catch (err) {
      console.error("Photo delete error:", err);
      alert("Could not remove photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onLoggedOut?.();
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
            {/* Clickable Profile Avatar with Edit Affordance */}
            <div className="relative w-24 h-24 mx-auto mb-3.5 group">
              <button
                type="button"
                onClick={() => setShowPhotoSheet(true)}
                disabled={uploadingPhoto}
                className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-accent to-[#B8420E] flex items-center justify-center text-4xl font-extrabold border-2 border-accent/[.45] shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer relative"
                title="Tap to change profile photo"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={iconAccount}
                    alt={profile.full_name || "Account"}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Uploading Spinner Overlay */}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-accent">
                    <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-1" />
                    <span className="text-[9px] font-bold text-white">Saving...</span>
                  </div>
                )}
              </button>

              {/* Edit Affordance Camera Icon */}
              {!uploadingPhoto && (
                <button
                  type="button"
                  onClick={() => setShowPhotoSheet(true)}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs shadow-md border-2 border-[#120F0D] hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Change photo"
                >
                  📷
                </button>
              )}
            </div>

            {photoErr && (
              <p className="text-danger text-xs text-center mb-2 font-semibold">
                {photoErr}
              </p>
            )}

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

        {/* App Theme Selector Card (Day Mode / Night Mode) - Placed directly above UPI PIN */}
        <Card className="p-4 mb-3.5 border-accent/[.25] transition-all">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all ${
                isNightMode
                  ? "bg-accent/15 border border-accent/30 text-accent shadow-sm"
                  : "bg-amber-500/15 border border-amber-400/40 text-amber-600 shadow-sm"
              }`}>
                {isNightMode ? "🌙" : "☀️"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-textLight">
                    {isNightMode ? "Night Mode" : "Day Mode"}
                  </p>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    isNightMode
                      ? "bg-accent/10 border-accent/40 text-accent"
                      : "bg-amber-500/15 border-amber-500/40 text-amber-600"
                  }`}>
                    {isNightMode ? "Dark Active" : "Daylight Active"}
                  </span>
                </div>
                <p className="text-muted text-[11.5px] mt-0.5">
                  {isNightMode
                    ? "Deep OLED dark theme (Default)"
                    : "Bright crisp daylight theme"}
                </p>
              </div>
            </div>

            {/* Toggle Switch (ON = Night Mode, OFF = Day Mode) */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={isNightMode}
                onClick={toggleTheme}
                className={`btn w-[54px] h-8 rounded-full relative transition-all duration-300 cursor-pointer p-0.5 ${
                  isNightMode
                    ? "bg-accent shadow-accentGlow"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
                title={isNightMode ? "Switch to Day Mode" : "Switch to Night Mode"}
              >
                <div
                  className="absolute top-[3px] w-[26px] h-[26px] rounded-full bg-white shadow-md flex items-center justify-center text-[12px] transition-all duration-300 transform"
                  style={{ left: isNightMode ? "25px" : "3px" }}
                >
                  {isNightMode ? "🌙" : "☀️"}
                </div>
              </button>
            </div>
          </div>

          {/* Quick 1-Tap Mode Selector Pills */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`btn py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                !isNightMode
                  ? "bg-accent text-white border-accent shadow-sm scale-[1.02]"
                  : "bg-surf border-line text-muted hover:text-textLight hover:bg-card"
              }`}
            >
              <span>☀️</span>
              <span>Day Mode</span>
              {!isNightMode && <span className="text-[10px] ml-1">✓</span>}
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`btn py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                isNightMode
                  ? "bg-accent text-white border-accent shadow-accentGlow scale-[1.02]"
                  : "bg-surf border-line text-muted hover:text-textLight hover:bg-card"
              }`}
            >
              <span>🌙</span>
              <span>Night Mode</span>
              {isNightMode && <span className="text-[10px] ml-1">✓</span>}
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

      {/* Hidden File Inputs for Camera and Gallery */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        ref={cameraInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        ref={galleryInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Photo Option Bottom-Sheet Modal ────────────────────────────── */}
      {showPhotoSheet && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-3 animate-fade-in"
          onClick={() => setShowPhotoSheet(false)}
        >
          <div
            className="w-full max-w-sm bg-[#171310] border border-line rounded-3xl p-5 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />
            <h3 className="text-base font-extrabold text-white text-center mb-1">
              Profile Photo
            </h3>
            <p className="text-xs text-muted text-center mb-5">
              Choose an option to update your photo
            </p>

            <div className="space-y-2.5">
              {/* Take Photo */}
              <button
                type="button"
                onClick={() => {
                  setShowPhotoSheet(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-card border border-line hover:border-accent/40 text-left flex items-center gap-3 text-sm font-bold text-textLight hover:text-white transition-all cursor-pointer"
              >
                <span className="text-lg">📸</span>
                <span>Take Photo</span>
              </button>

              {/* Choose from Gallery */}
              <button
                type="button"
                onClick={() => {
                  setShowPhotoSheet(false);
                  galleryInputRef.current?.click();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-card border border-line hover:border-accent/40 text-left flex items-center gap-3 text-sm font-bold text-textLight hover:text-white transition-all cursor-pointer"
              >
                <span className="text-lg">🖼️</span>
                <span>Choose from Gallery</span>
              </button>

              {/* Remove Photo (only if avatar exists) */}
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="w-full py-3 px-4 rounded-2xl bg-danger/10 border border-danger/25 hover:bg-danger/20 text-left flex items-center gap-3 text-sm font-bold text-danger transition-all cursor-pointer"
                >
                  <span className="text-lg">🗑️</span>
                  <span>Remove Photo</span>
                </button>
              )}

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setShowPhotoSheet(false)}
                className="w-full py-2.5 rounded-2xl text-center text-xs font-bold text-muted hover:text-white transition-colors cursor-pointer mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Circular Crop / Preview Modal ─────────────────────────────── */}
      {cropModalOpen && selectedImageSrc && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <Card className="p-6 max-w-sm w-full border-accent/40 bg-[#14100E] shadow-2xl text-center">
            <h3 className="text-base font-extrabold text-white mb-1">
              Adjust Profile Photo
            </h3>
            <p className="text-xs text-muted mb-4">
              Drag to position and adjust zoom slider
            </p>

            {/* Circular Viewport with Mask */}
            <div
              className="relative w-56 h-56 mx-auto rounded-full overflow-hidden border-2 border-accent shadow-inner bg-black/50 cursor-grab active:cursor-grabbing touch-none select-none mb-4"
              onMouseDown={(e) => handleCropPanStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handleCropPanMove(e.clientX, e.clientY)}
              onMouseUp={handleCropPanEnd}
              onMouseLeave={handleCropPanEnd}
              onTouchStart={(e) => {
                if (e.touches[0]) handleCropPanStart(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) handleCropPanMove(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchEnd={handleCropPanEnd}
            >
              <img
                ref={previewImgRef}
                src={selectedImageSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`,
                  transformOrigin: "center center",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
                className="w-full h-full pointer-events-none transition-transform duration-75"
              />
              {/* Circular guide ring */}
              <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
            </div>

            {/* Zoom Slider */}
            <div className="mb-5 px-4">
              <div className="flex justify-between text-xs text-muted font-bold mb-1.5">
                <span>Zoom</span>
                <span>{cropScale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropScale}
                onChange={(e) => setCropScale(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <Btn
                variant="dark"
                className="flex-1 py-2.5 text-xs font-bold"
                onClick={() => {
                  setCropModalOpen(false);
                  setSelectedImageSrc(null);
                }}
                disabled={uploadingPhoto}
              >
                Cancel
              </Btn>
              <Btn
                className="flex-1 py-2.5 text-xs font-bold"
                onClick={handleSaveCroppedPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? "Saving..." : "Save Photo"}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
