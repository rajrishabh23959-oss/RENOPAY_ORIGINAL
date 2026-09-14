import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import { Btn, Card } from "../components/ui";
import { downloadOrShareFile } from "../lib/download";

export function QRScreen({ onBack }) {
  const { profile } = useAuth();
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (!profile || !canvasRef.current) return;
    const payload = `upi://pay?pa=${profile.account.vpa}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 1,
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

      // Draw background card
      ctx.fillStyle = "#120E0C";
      ctx.fillRect(0, 0, width, height);

      // Top gradient bar
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#FF6A1A");
      grad.addColorStop(1, "#B8420E");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 8);

      // Border
      ctx.strokeStyle = "#2A2320";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Brand Title
      ctx.fillStyle = "#FF6A1A";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ RENOPAY", width / 2, 70);

      ctx.fillStyle = "#8C827A";
      ctx.font = "14px sans-serif";
      ctx.fillText("Instant UPI & Digital Banking", width / 2, 95);

      // White QR box
      const boxSize = 380;
      const boxX = (width - boxSize) / 2;
      const boxY = 125;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxSize, boxSize, 20);
      ctx.fill();

      // Draw QR image
      ctx.drawImage(img, boxX + 30, boxY + 30, 320, 320);

      // Payee details
      ctx.fillStyle = "#F5F3F0";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(profile.full_name, width / 2, 560);

      ctx.fillStyle = "#FF6A1A";
      ctx.font = "bold 20px monospace";
      ctx.fillText(profile.account.vpa, width / 2, 600);

      ctx.strokeStyle = "#2A2320";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, 640);
      ctx.lineTo(width - 80, 640);
      ctx.stroke();

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
    <div className="min-h-screen bg-bg pb-14">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base cursor-pointer" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">My QR Code</h2>
      </div>

      <div className="px-[22px] text-center max-w-[420px] mx-auto">
        <Card className="p-7 inline-block border-accent/[.27] relative glow-hero w-full">
          <canvas ref={canvasRef} className="rounded-lg relative z-10 mx-auto" />
          {error && <p className="text-danger text-xs mt-2">{error}</p>}
        </Card>

        <p className="text-xl font-extrabold mt-5 text-textLight">{profile.full_name}</p>
        <p className="text-accent mt-1 text-sm font-mono font-bold">{profile.account.vpa}</p>
        <p className="text-muted text-xs mt-1">Scan to pay via RenoPay or any UPI App</p>

        {downloadSuccess && (
          <p className="text-success text-xs font-bold mt-3 animate-fade-in">
            ✅ QR Code saved to phone storage!
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={downloading}
            className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-accent to-[#D43D0A] text-white shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Downloading QR…</span>
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Download QR Code to Phone</span>
              </>
            )}
          </button>

          <Btn variant="ghost" onClick={onBack} className="w-full">← Back to RenoPay</Btn>
        </div>
      </div>
    </div>
  );
}
