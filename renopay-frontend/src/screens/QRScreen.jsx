import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import { Btn, Card } from "../components/ui";

export function QRScreen({ onBack }) {
  const { profile } = useAuth();
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile || !canvasRef.current) return;
    const payload = `upi://pay?pa=${profile.account.vpa}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 1,
      color: { dark: "#F5F3F0", light: "#151210" },
    }).catch(() => setError("Could not render QR code"));
  }, [profile]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-10">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">My QR Code</h2>
      </div>
      <div className="px-[22px] text-center">
        <Card className="p-7 inline-block border-accent/[.27] relative glow-hero">
          <canvas ref={canvasRef} className="rounded-lg relative z-10" />
          {error && <p className="text-danger text-xs mt-2">{error}</p>}
        </Card>
        <p className="text-xl font-extrabold mt-5 text-textLight">{profile.full_name}</p>
        <p className="text-accent mt-1 text-sm">{profile.account.vpa}</p>
        <p className="text-muted text-xs mt-1">Scan to pay via RenoPay / UPI</p>
        <div className="mt-5"><Btn variant="ghost" onClick={onBack}>← Back</Btn></div>
      </div>
    </div>
  );
}
