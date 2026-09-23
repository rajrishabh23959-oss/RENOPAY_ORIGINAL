import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import { Btn, Card } from "../components/ui";
import { downloadOrShareFile } from "../lib/download";
import { BhimUpiLogo, PoweredByUpiBadge, TapToPayOverlay } from "../components/UpiBrandBadges";

export function QRScreen({ onBack }) {
  const { profile } = useAuth();
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isTapToPay, setIsTapToPay] = useState(true);

  const issueDate = new Date().toLocaleDateString("en-IN", {
    month: "2-digit",
    year: "numeric",
  }); // e.g. "09/2026"

  useEffect(() => {
    if (!profile || !canvasRef.current) return;
    const payload = `upi://pay?pa=${profile.account.vpa}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`;
    
    // Render large high-resolution QR (340px)
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "H", // High correction level allows center Tap to Pay overlay without unreadable QR
      color: { dark: "#F5F3F0", light: "#151210" },
    }).catch(() => setError("Could not render QR code"));
  }, [profile]);

  const handleDownloadQr = async () => {
    if (!profile?.account?.vpa || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const payload = `upi://pay?pa=${profile.account.vpa}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`;
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 440,
        margin: 1,
        errorCorrectionLevel: "H",
        color: { dark: "#0f0d0c", light: "#ffffff" },
      });

      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const width = 720;
      const height = 980;
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");

      // Draw background card
      ctx.fillStyle = "#120E0C";
      ctx.fillRect(0, 0, width, height);

      // Top gradient bar
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#FF6A1A");
      grad.addColorStop(1, "#B8420E");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 10);

      // Border
      ctx.strokeStyle = "#2A2320";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Brand Title & NPCI Label
      ctx.fillStyle = "#FF6A1A";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("⚡ RENOPAY", 45, 75);

      // NPCI Mandated Issue Date (MM/YYYY) on the right side
      ctx.fillStyle = "#8C827A";
      ctx.font = "bold 15px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Issued: ${issueDate}`, width - 45, 75);

      // NPCI Mandated Tagline
      ctx.fillStyle = "#F5F3F0";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scan & Pay with any UPI app", width / 2, 120);

      // White QR box covering >= 60% of vertical focus
      const boxSize = 480;
      const boxX = (width - boxSize) / 2;
      const boxY = 145;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxSize, boxSize, 24);
      ctx.fill();

      // Draw QR image
      ctx.drawImage(img, boxX + 20, boxY + 20, 440, 440);

      // Center Tap & Pay Contactless overlay if enabled (covering ~10% area)
      if (isTapToPay) {
        const overlaySize = 90;
        const ovX = (width - overlaySize) / 2;
        const ovY = boxY + (boxSize - overlaySize) / 2;
        ctx.fillStyle = "#0F0D0C";
        ctx.beginPath();
        ctx.roundRect(ovX, ovY, overlaySize, overlaySize, 18);
        ctx.fill();
        ctx.strokeStyle = "#FF6A1A";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "#FF6A1A";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("📶", width / 2, ovY + 42);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("TAP TO PAY", width / 2, ovY + 68);
      }

      // Payee details
      ctx.fillStyle = "#F5F3F0";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(profile.full_name, width / 2, 680);

      ctx.fillStyle = "#FF6A1A";
      ctx.font = "bold 22px monospace";
      ctx.fillText(profile.account.vpa, width / 2, 720);

      ctx.strokeStyle = "#2A2320";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, 760);
      ctx.lineTo(width - 80, 760);
      ctx.stroke();

      ctx.fillStyle = "#22C55E";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("✔ Verified BHIM UPI Merchant / Individual", width / 2, 800);

      ctx.fillStyle = "#8C827A";
      ctx.font = "14px sans-serif";
      ctx.fillText("Accepted by Google Pay, PhonePe, Paytm, BHIM & all UPI apps", width / 2, 840);

      ctx.fillStyle = "#5C564F";
      ctx.font = "12px sans-serif";
      ctx.fillText("Powered by National Payments Corporation of India (NPCI)", width / 2, 885);

      const downloadUrl = c.toDataURL("image/png");
      const filename = `renopay-upi-qr-${profile.account.vpa.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
      await downloadOrShareFile(downloadUrl, filename, "image/png");

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (e) {
      console.error("QR download error:", e);
      setError("Failed to download QR card.");
    } finally {
      setDownloading(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      {/* Header */}
      <div className="pt-[45px] pb-[16px] px-[22px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base cursor-pointer" onClick={onBack}>←</button>
          <h2 className="text-[22px] font-extrabold text-textLight">My QR Code</h2>
        </div>
        <BhimUpiLogo className="scale-90 origin-right" />
      </div>

      <div className="px-[22px] text-center max-w-[440px] mx-auto">
        {/* Mandated Compliance Card: Covers >= 60% viewport proportion */}
        <Card className="p-5 border-accent/[.27] relative glow-hero w-full shadow-2xl flex flex-col items-center">
          {/* NPCI Header & Issue Date MM/YYYY */}
          <div className="w-full flex items-center justify-between border-b border-line/60 pb-2.5 mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-textLight">Scan & Pay with any UPI app</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-muted bg-line/40 px-2 py-0.5 rounded">
              Issued: {issueDate}
            </span>
          </div>

          {/* QR Canvas Container (occupies >= 60% relative screen area) */}
          <div className="relative p-2 rounded-2xl bg-[#151210] border-2 border-line flex items-center justify-center min-h-[320px] w-full max-w-[340px]">
            <canvas ref={canvasRef} className="rounded-xl w-full h-auto max-w-[310px] mx-auto" />

            {/* Tap & Pay Contactless Overlay (>= 10% area) */}
            {isTapToPay && <TapToPayOverlay />}
          </div>

          {error && <p className="text-danger text-xs mt-2">{error}</p>}

          {/* Payee Info */}
          <div className="mt-3.5 w-full">
            <p className="text-lg font-extrabold text-textLight">{profile.full_name}</p>
            <div className="inline-flex items-center gap-1 mt-1 bg-accent/10 px-3 py-1 rounded-lg border border-accent/25">
              <span className="text-[11px] font-bold text-muted uppercase">UPI ID:</span>
              <span className="text-accent text-sm font-mono font-bold">{profile.account.vpa}</span>
            </div>
          </div>
        </Card>

        {/* Tap to Pay Contactless Toggle */}
        <div className="mt-3.5 flex items-center justify-between p-3 rounded-xl bg-card border border-line">
          <div className="flex items-center gap-2 text-left">
            <span className="text-lg">📶</span>
            <div>
              <p className="text-xs font-bold text-textLight">Tap & Pay Contactless Mode</p>
              <p className="text-[10px] text-muted">Includes 10% central NFC wave badge</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTapToPay(!isTapToPay)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isTapToPay ? "bg-teal/20 text-teal border border-teal/40" : "bg-line/40 text-muted border border-line"
            }`}
          >
            {isTapToPay ? "ENABLED ✓" : "OFF"}
          </button>
        </div>

        {downloadSuccess && (
          <p className="text-success text-xs font-bold mt-3 animate-fade-in">
            ✅ Standardized NPCI QR Card saved to phone storage!
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={downloading}
            className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-accent to-[#D43D0A] text-white shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Generating Card…</span>
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Download NPCI QR Card (with Date & Logo)</span>
              </>
            )}
          </button>

          <Btn variant="ghost" onClick={onBack} className="w-full">← Back to RenoPay</Btn>
        </div>
      </div>
    </div>
  );
}

