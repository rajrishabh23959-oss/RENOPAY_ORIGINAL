import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { getTranslation } from "./VendorTranslations";

export function VendorQRCollection({
  profile,
  currentLang = "hi",
  onPaymentReceived,
}) {
  const t = getTranslation(currentLang);
  const [qrType, setQrType] = useState("static"); // "static" | "dynamic"
  const [dynamicAmount, setDynamicAmount] = useState("50");
  const [dynamicNote, setDynamicNote] = useState("₹50 ka samosa");
  const canvasRef = useRef(null);

  const merchantName = profile?.full_name || "RenoPay Kirana Store";
  const merchantVpa = profile?.account?.vpa || "merchant@renopay";
  const merchantId = profile?.account?.id || "m_default_01";

  // Re-render QR code whenever type or dynamic params change
  useEffect(() => {
    if (!canvasRef.current) return;

    let upiPayload = `upi://pay?pa=${merchantVpa}&pn=${encodeURIComponent(merchantName)}&cu=INR`;
    if (qrType === "dynamic" && Number(dynamicAmount) > 0) {
      upiPayload += `&am=${Number(dynamicAmount)}`;
      if (dynamicNote.trim()) {
        upiPayload += `&tn=${encodeURIComponent(dynamicNote.trim())}`;
      }
    }

    QRCode.toCanvas(canvasRef.current, upiPayload, {
      width: 220,
      margin: 1,
      color: {
        dark: "#120e0c",
        light: "#ffffff",
      },
    }).catch(console.error);
  }, [qrType, dynamicAmount, dynamicNote, merchantName, merchantVpa]);

  // Download printable standee card
  const handleDownloadStandee = async () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 800;
    const ctx = c.getContext("2d");

    // Standee background
    ctx.fillStyle = "#151210";
    ctx.fillRect(0, 0, 600, 800);

    // Accent Header Banner
    const grad = ctx.createLinearGradient(0, 0, 600, 0);
    grad.addColorStop(0, "#ff6a1a");
    grad.addColorStop(1, "#e04e00");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 90);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RenoPay Merchant", 300, 56);

    // Store Name
    ctx.fillStyle = "#f5f3f0";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(merchantName, 300, 145);

    // VPA
    ctx.fillStyle = "#ff8c42";
    ctx.font = "16px monospace";
    ctx.fillText(merchantVpa, 300, 175);

    // White QR container box
    ctx.fillStyle = "#ffffff";
    ctx.roundRect(140, 210, 320, 320, 20);
    ctx.fill();

    // Draw QR into the white box
    if (canvasRef.current) {
      ctx.drawImage(canvasRef.current, 160, 230, 280, 280);
    }

    // Dynamic amount label if dynamic
    if (qrType === "dynamic" && Number(dynamicAmount) > 0) {
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(`Fixed: ₹${dynamicAmount}`, 300, 565);
    }

    // Footer All UPI Accepted
    ctx.fillStyle = "#a8a29e";
    ctx.font = "14px sans-serif";
    ctx.fillText("Accepted on PhonePe, Google Pay, Paytm, BHIM & All UPI", 300, 620);

    ctx.fillStyle = "#ff6a1a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Laminate & Place at Store Counter", 300, 720);

    // Trigger download
    const link = document.createElement("a");
    link.download = `${merchantName.replace(/\s+/g, "_")}_Standee_QR.png`;
    link.href = c.toDataURL("image/png");
    link.click();
  };

  // Simulate payment collection (Req 2 test trigger)
  const triggerSimulation = (amt = 50, note = "Payment") => {
    const payment = {
      qr_id: `qr_${Date.now()}`,
      merchant_id: merchantId,
      qr_type: qrType,
      linked_amount: Number(amt),
      amount: Number(amt),
      customer_name: "Rahul Sharma",
      note: note || dynamicNote,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "SUCCESS",
    };
    onPaymentReceived(payment);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* QR Type Switcher (Static vs Dynamic) */}
      <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
        <button
          onClick={() => setQrType("static")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            qrType === "static"
              ? "bg-accent text-white shadow-md"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <span>🏷️</span>
          <span>{t.static_qr_title.split("(")[0]}</span>
        </button>
        <button
          onClick={() => setQrType("dynamic")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            qrType === "dynamic"
              ? "bg-accent text-white shadow-md"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <span>⚡</span>
          <span>{t.dynamic_qr_title.split("(")[0]}</span>
        </button>
      </div>

      {/* Dynamic QR Input Controls */}
      {qrType === "dynamic" && (
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between text-xs text-neutral-300 font-medium">
            <span>{t.amount_label}</span>
            <span className="text-[10px] text-accent font-bold">Fixed Bill QR</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">₹</span>
            <input
              type="number"
              value={dynamicAmount}
              onChange={(e) => setDynamicAmount(e.target.value)}
              placeholder="50"
              className="flex-1 bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white font-bold text-lg focus:outline-none focus:border-accent"
            />
          </div>

          {/* Preset amount pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["10", "20", "50", "100", "200", "500"].map((p) => (
              <button
                key={p}
                onClick={() => setDynamicAmount(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  dynamicAmount === p
                    ? "bg-accent text-white"
                    : "bg-white/10 text-neutral-300 hover:bg-white/15"
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>

          <div>
            <input
              type="text"
              value={dynamicNote}
              onChange={(e) => setDynamicNote(e.target.value)}
              placeholder={t.item_note_placeholder}
              className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent mt-1"
            />
          </div>
        </div>
      )}

      {/* Standee QR Display Card */}
      <div className="rounded-3xl bg-gradient-to-b from-[#241c18] to-[#151210] border border-[#ff6a1a]/30 p-5 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
        {/* Top brand header */}
        <div className="flex items-center justify-between w-full pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2 text-left">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-base font-black">
              R
            </div>
            <div>
              <h4 className="text-white font-bold text-sm leading-tight">{merchantName}</h4>
              <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span>✓</span> <span>{t.verified_merchant}</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/20">
            {qrType === "dynamic" ? `₹${dynamicAmount || "0"}` : "All UPI"}
          </span>
        </div>

        {/* QR Code Canvas inside high-contrast rounded white pad */}
        <div className="p-3 bg-white rounded-2xl shadow-inner my-2">
          <canvas ref={canvasRef} className="rounded-lg block" />
        </div>

        {/* UPI Details */}
        <p className="text-neutral-300 font-mono text-xs mt-2 select-all font-semibold">
          {merchantVpa}
        </p>
        <p className="text-neutral-400 text-[11px] mt-1">
          {t.all_upi_accepted}
        </p>

        {/* Action Buttons: Print / Laminate & Download */}
        <div className="grid grid-cols-2 gap-2.5 w-full mt-4 pt-3 border-t border-white/10">
          <button
            onClick={handleDownloadStandee}
            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <span>{t.download_qr}</span>
          </button>
          <button
            onClick={handleDownloadStandee}
            className="py-2.5 px-3 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
          >
            <span>{t.print_laminate}</span>
          </button>
        </div>
      </div>

      {/* Simulator: Test Live Soundbox & Green Tick */}
      <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <span>🔊</span>
            <span>{t.simulate_payment}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80">3-4s Green Tick + Voice</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-1">
          <button
            onClick={() => triggerSimulation(50, "Samosa x 2")}
            className="py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-all"
          >
            Test ₹50
          </button>
          <button
            onClick={() => triggerSimulation(100, "Chai & Breakfast")}
            className="py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-all"
          >
            Test ₹100
          </button>
          <button
            onClick={() => triggerSimulation(dynamicAmount || 20, dynamicNote)}
            className="py-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-orange-300 text-xs font-bold border border-accent/30 transition-all"
          >
            Custom ₹{dynamicAmount || 20}
          </button>
        </div>
      </div>
    </div>
  );
}
