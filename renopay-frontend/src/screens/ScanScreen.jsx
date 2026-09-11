import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { PaymentAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";

// Parses `upi://pay?pa=someone@bank&pn=Name...` style payloads (what
// real UPI QR codes encode) as well as a bare VPA string, so scanning
// either a proper UPI QR or a simpler "vpa-only" QR both work.
function extractVpaFromQrText(text) {
  const trimmed = text.trim();
  if (trimmed.includes("@") && !trimmed.includes("://")) return trimmed; // bare VPA
  try {
    const url = new URL(trimmed);
    const pa = url.searchParams.get("pa");
    if (pa) return pa;
  } catch {
    /* not a URL — fall through */
  }
  return null;
}

export function ScanScreen({ onBack, onSuccess }) {
  const [mode, setMode] = useState("camera"); // camera | manual
  const [vpa, setVpa] = useState("");
  const [err, setErr] = useState("");
  const [cameraStatus, setCameraStatus] = useState("starting"); // starting | active | denied | unsupported
  const [detected, setDetected] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleDetectedVpa = async (vpaCandidate) => {
    stopCamera();
    try {
      await PaymentAPI.resolveVPA(vpaCandidate);
      setDetected(vpaCandidate);
      setTimeout(() => onSuccess(vpaCandidate), 500);
    } catch {
      setErr(`Scanned "${vpaCandidate}" but it's not a valid RenoPay VPA`);
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
    if (mode !== "camera") return;
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

  const submitManual = async () => {
    if (!vpa.includes("@")) { setErr("Enter valid VPA"); return; }
    try {
      await PaymentAPI.resolveVPA(vpa);
      onSuccess(vpa);
    } catch {
      setErr("VPA not found");
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-10">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={() => { stopCamera(); onBack(); }}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Scan & Pay</h2>
        <div className="ml-auto"><Badge color={mode === "camera" ? "#22C55E" : "#5C564F"} size={10}>{mode === "camera" ? "⚡ Live Camera" : "Manual entry"}</Badge></div>
      </div>
      <div className="px-[22px]">
        <div className="flex gap-2 mb-4">
          {[["camera", "Camera"], ["manual", "Enter UPI ID"]].map(([v, l]) => (
            <button key={v} className="btn flex-1 py-2.5 rounded-[10px] text-xs font-semibold"
                    style={{ background: mode === v ? "#FF6A1A" : "#151210", color: mode === v ? "#fff" : "#5C564F", border: `1px solid ${mode === v ? "#FF6A1A" : "#2A2320"}` }}
                    onClick={() => { stopCamera(); setMode(v); setErr(""); }}>
              {l}
            </button>
          ))}
        </div>

        {mode === "camera" && (
          <div>
            <div className="relative rounded-[20px] overflow-hidden mb-4 bg-black border-2" style={{ borderColor: detected ? "#22C55E" : "#FF6A1A55", aspectRatio: "1/1" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {/* Reticle overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[70%] aspect-square rounded-2xl border-2" style={{ borderColor: detected ? "#22C55E" : "#FF6A1A88" }} />
              </div>
              {cameraStatus === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60"><p className="text-muted text-sm">Starting camera…</p></div>
              )}
              {cameraStatus === "denied" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
                  <p className="text-warn text-sm">Camera permission denied. Use "Enter UPI ID" instead, or allow camera access and reopen this screen.</p>
                </div>
              )}
              {cameraStatus === "unsupported" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
                  <p className="text-warn text-sm">Camera access isn't supported in this browser/context (needs HTTPS). Use "Enter UPI ID" instead.</p>
                </div>
              )}
              {detected && (
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <p className="text-teal text-sm font-bold animate-fadeIn">✅ {detected}</p>
                </div>
              )}
            </div>
            <p className="text-muted text-xs text-center">Point your camera at a RenoPay / UPI QR code</p>
          </div>
        )}

        {mode === "manual" && (
          <Card className="p-5">
            <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">UPI ID</p>
            <input placeholder="anyone@renopay" value={vpa} onChange={(e) => setVpa(e.target.value)} className="mb-3" />
            {err && <p className="text-danger text-xs mb-3">{err}</p>}
            <Btn onClick={submitManual}>Continue to Pay →</Btn>
          </Card>
        )}

        {mode === "camera" && err && <p className="text-danger text-xs mt-3 text-center">{err}</p>}
      </div>
    </div>
  );
}
