import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { PaymentAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";

// Parses `upi://pay?pa=someone@bank&pn=Name...` style payloads as well as bare VPAs
function extractVpaFromQrText(text) {
  if (!text) return null;
  const trimmed = text.trim();
  // bare VPA
  if (trimmed.includes("@") && !trimmed.includes("://") && !trimmed.includes("?")) {
    return trimmed;
  }
  // Try parsing as URL or URI
  try {
    const url = new URL(trimmed);
    const pa = url.searchParams.get("pa");
    if (pa) return decodeURIComponent(pa);
  } catch {
    /* fallback to regex */
  }

  // Regex fallback for upi://pay?pa=xxx
  const match = trimmed.match(/[?&]pa=([^&]+)/i);
  if (match) return decodeURIComponent(match[1]);

  return null;
}

export function ScanScreen({ onBack, onSuccess }) {
  const [mode, setMode] = useState("camera"); // camera | upload | manual
  const [vpa, setVpa] = useState("");
  const [err, setErr] = useState("");
  const [cameraStatus, setCameraStatus] = useState("starting"); // starting | active | denied | unsupported
  const [detected, setDetected] = useState(null);
  const [detectedName, setDetectedName] = useState("");
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

  const handleDetectedVpa = async (vpaCandidate) => {
    stopCamera();
    try {
      const res = await PaymentAPI.resolveVPA(vpaCandidate);
      setDetected(vpaCandidate);
      setDetectedName(res?.name || "");
      setErr("");
      setTimeout(() => {
        onSuccess?.({ vpa: vpaCandidate, name: res?.name });
      }, 700);
    } catch {
      setErr(`Scanned "${vpaCandidate}" but it's not a registered RenoPay account`);
      setMode("manual");
      setVpa(vpaCandidate);
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
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

    if (code?.data) {
      const vpaCandidate = extractVpaFromQrText(code.data);
      if (vpaCandidate) {
        handleDetectedVpa(vpaCandidate);
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
  }, [mode]);

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
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });

        setProcessingImage(false);
        if (code?.data) {
          const vpaCandidate = extractVpaFromQrText(code.data);
          if (vpaCandidate) {
            handleDetectedVpa(vpaCandidate);
          } else {
            setErr(`Found QR data: "${code.data.slice(0, 30)}..." but no valid UPI ID found.`);
          }
        } else {
          setErr("No QR code detected in this image. Please upload a clear QR code image.");
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
    if (!vpa.includes("@")) { setErr("Enter valid UPI ID e.g. name@renopay"); return; }
    try {
      const res = await PaymentAPI.resolveVPA(vpa);
      onSuccess?.({ vpa, name: res?.name });
    } catch {
      setErr("UPI ID / RenoPay account not found");
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
                  <p className="text-warn text-sm mb-3">Camera access denied. Use "Upload QR" or "UPI ID" instead, or grant browser camera permissions.</p>
                  <Btn variant="dark" onClick={() => setMode("upload")}>Switch to Upload QR</Btn>
                </div>
              )}
              {cameraStatus === "unsupported" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
                  <p className="text-warn text-sm mb-3">Camera access is not supported in this browser context (requires HTTPS / localhost).</p>
                  <Btn variant="dark" onClick={() => setMode("upload")}>Upload QR Image</Btn>
                </div>
              )}
              {detected && (
                <div className="absolute bottom-4 left-3 right-3 text-center bg-black/80 backdrop-blur-md py-2 px-3 rounded-xl border border-teal/40">
                  <p className="text-teal text-sm font-bold animate-fadeIn">✅ {detectedName || detected}</p>
                  <p className="text-[11px] text-muted">{detected} · Redirecting to pay...</p>
                </div>
              )}
            </div>
            <p className="text-muted text-xs text-center">Point your camera at a RenoPay / UPI QR code</p>
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
                  Upload downloaded RenoPay QR or photo of a QR code
                </p>
              </div>

              {detected && (
                <div className="mt-4 p-3 rounded-xl bg-teal/10 border border-teal/30">
                  <p className="text-teal text-sm font-bold">✅ Found: {detectedName || detected}</p>
                  <p className="text-muted text-xs">{detected} · Opening payment screen...</p>
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
