import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { PaymentAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";

// Universal UPI QR Parser: Handles Paytm, PhonePe, Google Pay, BharatPe, BHIM, Bank QRs, bare VPAs & dynamic bills
export function parseUniversalUpiQr(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  let text = rawText.trim();

  // 1. URL Decode if encoded (Google Pay QRs are often URL encoded e.g. upi%3A%2F%2Fpay%3Fpa%3D...)
  try {
    if (text.includes("%") || text.includes("%3A") || text.includes("%2F") || text.includes("%3F")) {
      const decoded = decodeURIComponent(text);
      if (decoded.includes("pa=") || decoded.includes("@")) {
        text = decoded;
      }
    }
  } catch (e) {
    // Keep text if decoding fails
  }

  // 1b. Support Tez & GPay custom URI schemes and Android intents
  if (text.startsWith("intent://")) {
    text = text.replace(/^intent:\/\//i, "upi://");
  }
  if (/^(tez|gpay|googlepay):\/\//i.test(text)) {
    text = text.replace(/^(tez|gpay|googlepay):\/\//i, "upi://");
  }

  // 2. Helper to extract parameter irrespective of case or encoding
  const getParam = (key) => {
    const match = text.match(new RegExp(`[?&]${key}=([^&#\\s]+)`, "i"));
    if (!match) return null;
    try {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    } catch {
      return match[1].replace(/\+/g, " ");
    }
  };

  const pa = getParam("pa");
  const pn = getParam("pn");
  const am = getParam("am");
  const tn = getParam("tn") || getParam("note");
  const mc = getParam("mc");
  const tr = getParam("tr") || getParam("tid");

  let vpa = pa;

  // 3. If no pa param, search for bare VPA pattern (e.g. user@okaxis, 9876543210@ybl, merchant@okbizaxis)
  if (!vpa) {
    const bareMatch = text.match(/([a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-_]+)/);
    if (bareMatch) {
      vpa = bareMatch[1];
    }
  }

  if (!vpa || !vpa.includes("@")) return null;

  vpa = vpa.trim().toLowerCase();
  vpa = vpa.replace(/[./]+$/, ""); // Clean trailing periods/slashes

  // 4. Identify UPI App and styling badge
  const handle = (vpa.split("@")[1] || "").toLowerCase();
  let app = "UPI";
  let appIcon = "📲";
  let badgeColor = "#22C55E";

  if (["paytm", "ptyes", "pthdfc", "ptsbi", "ptaxis"].includes(handle)) {
    app = "Paytm";
    appIcon = "🔷";
    badgeColor = "#00B9F5";
  } else if (["ybl", "ibl", "axl"].includes(handle)) {
    app = "PhonePe";
    appIcon = "🟣";
    badgeColor = "#5F259F";
  } else if (handle.startsWith("ok") || ["gpay", "googlepay"].includes(handle)) {
    app = "Google Pay";
    appIcon = "🟢";
    badgeColor = "#4285F4";
  } else if (["bharatpe", "postbank"].includes(handle)) {
    app = "BharatPe";
    appIcon = "⚡";
    badgeColor = "#00ACC1";
  } else if (handle === "renopay") {
    app = "RenoPay";
    appIcon = "🔥";
    badgeColor = "#FF6A1A";
  } else if (["apl", "rapl"].includes(handle)) {
    app = "Amazon Pay";
    appIcon = "🛒";
    badgeColor = "#FF9900";
  } else if (handle === "cred") {
    app = "CRED";
    appIcon = "💳";
    badgeColor = "#E0E0E0";
  } else if (handle === "upi") {
    app = "BHIM UPI";
    appIcon = "🇮🇳";
    badgeColor = "#22C55E";
  } else {
    app = `${handle.toUpperCase()} UPI`;
    appIcon = "🏦";
    badgeColor = "#FFA000";
  }

  // 5. Map merchant category code (mc) to RenoPay TxnCategory
  let category = "Other";
  if (mc) {
    const num = parseInt(mc, 10);
    if ((num >= 5400 && num <= 5499) || (num >= 5300 && num <= 5399) || num === 5912 || num === 5999) {
      category = "Shopping";
    } else if (num >= 5811 && num <= 5814) {
      category = "Food";
    } else if ((num >= 5541 && num <= 5542) || num === 4121 || num === 4111) {
      category = "Transport";
    } else if (num === 4900 || num === 4814 || num === 4899) {
      category = "Bills";
    } else if (num >= 8011 && num <= 8099) {
      category = "Health";
    } else if (num >= 8211 && num <= 8299) {
      category = "Education";
    } else if (num >= 7800 && num <= 7999) {
      category = "Entertainment";
    }
  }

  return {
    vpa,
    name: pn ? pn.trim() : "",
    amount: am && !isNaN(parseFloat(am)) && parseFloat(am) > 0 ? parseFloat(am) : null,
    note: tn ? tn.trim() : "",
    category,
    app,
    appIcon,
    badgeColor,
    tr,
  };
}

export function ScanScreen({ onBack, onSuccess }) {
  const [mode, setMode] = useState("camera"); // camera | upload | manual
  const [vpa, setVpa] = useState("");
  const [err, setErr] = useState("");
  const [cameraStatus, setCameraStatus] = useState("starting"); // starting | active | denied | unsupported
  const [cameraRetry, setCameraRetry] = useState(0);
  const [detected, setDetected] = useState(null);
  const [detectedName, setDetectedName] = useState("");
  const [detectedApp, setDetectedApp] = useState("");
  const [detectedAmount, setDetectedAmount] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleDetectedUpi = async (parsed) => {
    stopCamera();
    try {
      const res = await PaymentAPI.resolveVPA(parsed.vpa, parsed.name);
      const finalName = res?.name || parsed.name || parsed.vpa;
      const finalApp = res?.app || parsed.app || "UPI";

      setDetected(parsed.vpa);
      setDetectedName(finalName);
      setDetectedApp(finalApp);
      setDetectedAmount(parsed.amount);
      setErr("");

      setTimeout(() => {
        onSuccess?.({
          vpa: parsed.vpa,
          name: finalName,
          amount: parsed.amount,
          note: parsed.note,
          category: parsed.category,
          app: finalApp,
        });
      }, 700);
    } catch {
      setErr(`Scanned "${parsed.vpa}" but it's not a valid UPI handle`);
      setMode("manual");
      setVpa(parsed.vpa);
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });

    if (code?.data) {
      const parsed = parseUniversalUpiQr(code.data);
      if (parsed) {
        handleDetectedUpi(parsed);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    if (mode !== "camera") {
      stopCamera();
      return;
    }
    let cancelled = false;
    setCameraStatus("starting");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus("active");
        rafRef.current = requestAnimationFrame(scanFrame);
      } catch {
        setCameraStatus("denied");
      }
    })();

    return () => { cancelled = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cameraRetry]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setErr("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setUploadPreview(event.target.result);
        const oc = document.createElement("canvas");
        oc.width = img.width;
        oc.height = img.height;
        const ctx = oc.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "attemptBoth" });

        setProcessingImage(false);
        if (code?.data) {
          const parsed = parseUniversalUpiQr(code.data);
          if (parsed) {
            handleDetectedUpi(parsed);
          } else {
            setErr(`Scanned text: "${code.data.slice(0, 40)}..." is not a recognizable UPI QR code.`);
          }
        } else {
          setErr("No QR code detected in this image. Please upload a clearer QR code image.");
        }
      };
      img.onerror = () => {
        setProcessingImage(false);
        setErr("Could not read this image file.");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const submitManual = async () => {
    if (!vpa.includes("@")) { setErr("Enter valid UPI ID e.g. merchant@paytm or name@renopay"); return; }
    try {
      const res = await PaymentAPI.resolveVPA(vpa);
      const parsed = parseUniversalUpiQr(vpa) || {};
      onSuccess?.({
        vpa,
        name: res?.name,
        app: res?.app || parsed.app || "UPI",
      });
    } catch {
      setErr("Could not verify this UPI ID.");
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-10">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={() => { stopCamera(); onBack(); }}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Scan & Pay</h2>
        <div className="ml-auto">
          <Badge color={mode === "camera" ? "#22C55E" : mode === "upload" ? "#FF6A1A" : "#5C564F"} size={10}>
            {mode === "camera" ? "⚡ Live Camera" : mode === "upload" ? "🖼️ Image Scan" : "Manual entry"}
          </Badge>
        </div>
      </div>

      <div className="px-[22px]">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          {[
            ["camera", "📷 Camera"],
            ["upload", "🖼️ Upload QR"],
            ["manual", "⌨️ UPI ID"],
          ].map(([v, l]) => (
            <button
              key={v}
              className="btn flex-1 py-2.5 rounded-[10px] text-xs font-semibold transition-all"
              style={{
                background: mode === v ? "#FF6A1A" : "#151210",
                color: mode === v ? "#fff" : "#8C827A",
                border: `1px solid ${mode === v ? "#FF6A1A" : "#2A2320"}`,
              }}
              onClick={() => {
                stopCamera();
                setMode(v);
                setErr("");
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Live Camera Mode */}
        {mode === "camera" && (
          <div>
            <div className="relative rounded-[20px] overflow-hidden mb-4 bg-black border-2 transition-colors" style={{ borderColor: detected ? "#22C55E" : "#FF6A1A55", aspectRatio: "1/1" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              {/* Reticle overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-[70%] aspect-square rounded-2xl border-2 transition-all"
                  style={{
                    borderColor: detected ? "#22C55E" : "#FF6A1A88",
                    boxShadow: detected ? "0 0 25px rgba(34,197,94,0.4)" : "0 0 15px rgba(255,106,26,0.2)",
                  }}
                />
              </div>

              {cameraStatus === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <p className="text-muted text-sm">Starting camera…</p>
                </div>
              )}
              {cameraStatus === "denied" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
                  <p className="text-warn text-sm mb-3">Camera access denied. Please grant camera permission in App Settings or tap retry below.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraStatus("starting");
                        setCameraRetry((c) => c + 1);
                      }}
                      className="px-4 py-2 bg-accent hover:bg-accent/90 active:scale-95 text-white text-[12px] font-bold rounded-xl transition shadow-lg shadow-accent/30"
                    >
                      🔄 Grant & Retry Camera
                    </button>
                    <Btn variant="dark" onClick={() => setMode("upload")}>Switch to Upload QR</Btn>
                  </div>
                </div>
              )}
              {cameraStatus === "unsupported" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
                  <p className="text-warn text-sm mb-3">Camera access is not supported in this browser context (requires HTTPS / localhost).</p>
                  <Btn variant="dark" onClick={() => setMode("upload")}>Upload QR Image</Btn>
                </div>
              )}
              {detected && (
                <div className="absolute bottom-4 left-3 right-3 text-center bg-black/85 backdrop-blur-md py-2.5 px-3.5 rounded-xl border border-teal/40">
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    {detectedApp && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-white/10 text-textLight border border-white/15">
                        {detectedApp}
                      </span>
                    )}
                    <p className="text-teal text-sm font-bold animate-fadeIn">✅ {detectedName || detected}</p>
                  </div>
                  <p className="text-[11px] text-muted">
                    {detected} {detectedAmount ? `· Preset: ₹${detectedAmount}` : ""} · Redirecting to pay...
                  </p>
                </div>
              )}
            </div>
            <p className="text-muted text-xs text-center">Point your camera at any UPI QR code (Paytm, PhonePe, GPay, etc.)</p>
          </div>
        )}

        {/* Upload QR Image Mode */}
        {mode === "upload" && (
          <div>
            <Card className="p-6 text-center border-accent/[.25]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-accent/40 hover:border-accent rounded-2xl p-6 transition-all bg-card/40 flex flex-col items-center justify-center"
              >
                {uploadPreview ? (
                  <div className="relative mb-3">
                    <img src={uploadPreview} alt="QR Preview" className="max-h-48 rounded-xl object-contain shadow-lg border border-line" />
                    {processingImage && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                        <span className="text-xs text-textLight font-semibold">Scanning QR...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-3xl mb-3">
                    🖼️
                  </div>
                )}
                <p className="text-sm font-bold text-textLight mb-1">
                  {uploadPreview ? "Choose Another Image" : "Select or Drop QR Code Image"}
                </p>
                <p className="text-muted text-xs">
                  Upload Paytm, PhonePe, GPay, BharatPe or any UPI QR image
                </p>
              </div>

              {detected && (
                <div className="mt-4 p-3 rounded-xl bg-teal/10 border border-teal/30">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {detectedApp && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-white/10 text-textLight border border-white/15">
                        {detectedApp}
                      </span>
                    )}
                    <p className="text-teal text-sm font-bold">✅ Found: {detectedName || detected}</p>
                  </div>
                  <p className="text-muted text-xs">
                    {detected} {detectedAmount ? `· Preset: ₹${detectedAmount}` : ""} · Opening payment screen...
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Manual UPI ID Mode */}
        {mode === "manual" && (
          <Card className="p-5">
            <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">UPI ID / RenoPay Handle</p>
            <input
              placeholder="e.g. rahul@renopay"
              value={vpa}
              onChange={(e) => setVpa(e.target.value)}
              className="mb-3"
              autoFocus
            />
            {err && <p className="text-danger text-xs mb-3">{err}</p>}
            <Btn onClick={submitManual}>Continue to Pay →</Btn>
          </Card>
        )}

        {mode !== "manual" && err && (
          <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/30 text-center">
            <p className="text-danger text-xs font-semibold">{err}</p>
          </div>
        )}
      </div>
    </div>
  );
}
