import { useState, useEffect } from "react";
import { PaymentAPI, AnalyticsAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getDeviceFingerprint } from "../lib/format";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { NoteSlider } from "../components/NoteSlider";
import { fmt } from "../lib/format";

const CATS = [
  { id: "Food", icon: "🍔" }, { id: "Shopping", icon: "🛍️" }, { id: "Transport", icon: "🚗" },
  { id: "Entertainment", icon: "🎬" }, { id: "Bills", icon: "💡" }, { id: "Health", icon: "💊" },
  { id: "Education", icon: "📚" }, { id: "Other", icon: "📦" },
];

export function PayScreen({ onBack, onNavigate, prefillVpa, prefillAmount, prefillNote, prefillName, prefillCategory, prefillApp }) {
  let refreshProfile = null;
  try {
    const auth = useAuth();
    refreshProfile = auth?.refreshProfile;
  } catch {
    // optional / running in isolation test
  }

  const [step, setStep] = useState(prefillVpa ? "amount" : "vpa");
  const [vpa, setVpa] = useState(prefillVpa || "");
  const [resolvedName, setResolvedName] = useState(prefillName || "");
  const [payeeApp, setPayeeApp] = useState(prefillApp || "");
  const [amount, setAmount] = useState(prefillAmount ? String(prefillAmount) : "");
  const [desc, setDesc] = useState(prefillNote || "");
  const [category, setCategory] = useState(prefillCategory || "Other");
  const [useLite, setUseLite] = useState(false);
  const [payMode, setPayMode] = useState("classic");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (prefillVpa) resolveVpa(prefillVpa, prefillName);
    if (prefillAmount) setAmount(String(prefillAmount));
    if (prefillNote) setDesc(prefillNote);
    if (prefillCategory) setCategory(prefillCategory);
    if (prefillApp) setPayeeApp(prefillApp);
    if (prefillName) setResolvedName(prefillName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillVpa, prefillAmount, prefillNote, prefillCategory, prefillApp, prefillName]);

  const resolveVpa = async (v, hintName = null) => {
    setErr("");
    try {
      const r = await PaymentAPI.resolveVPA(v, hintName || prefillName);
      setResolvedName(r.name || hintName || prefillName || v);
      if (r.app) setPayeeApp(r.app);
      setVpa(v);
      setStep("amount");
    } catch {
      setErr("Could not verify this UPI address");
    }
  };

  const handleResolveSubmit = (e) => {
    e.preventDefault();
    if (!vpa.includes("@")) { setErr("Enter valid VPA e.g. name@renopay"); return; }
    resolveVpa(vpa);
  };

  const proceedToAuth = () => {
    if (!Number(amount) || Number(amount) <= 0) { setErr("Amount must be > 0"); return; }
    setErr("");
    setIdempotencyKey(crypto.randomUUID()); // fresh key for this attempt
    setStep("pin");
  };

  const handleDownloadReceipt = async () => {
    if (!result?.txn_ref || downloadingReceipt) return;
    setDownloadingReceipt(true);
    setDownloadError("");
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: "transaction_receipt",
        txn_ref: result.txn_ref,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt_${result.txn_ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError("Failed to download PDF receipt. Please try again.");
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const executePay = async (pin) => {
    if (loading) return; // Prevent double-clicks
    setLoading(true); setErr("");
    try {
      const payload = {
        to_vpa: vpa, amount: Number(amount), description: desc || "UPI Transfer", pin,
        category, device_fingerprint: getDeviceFingerprint(), use_upi_lite: useLite && Number(amount) <= 500,
        idempotency_key: idempotencyKey,
        receiver_name: resolvedName,
      };
      const res = await PaymentAPI.sendMoney(payload);
      setResult({ success: true, ...res });
      setStep("result");
      if (refreshProfile) {
        try {
          await refreshProfile();
        } catch {
          // ignore background sync error
        }
      }
    } catch (e2) {
      const detail = e2.response?.data?.detail;
      const code = detail?.code;
      if (code === "pin_not_set") {
        setResult({ success: false, error: "Set your UPI PIN in Profile to send money", isPinNotSet: true });
        setStep("result");
        return;
      }
      if (code === "invalid_pin" || code === "pin_locked") {
        // Wrong PIN: stay on the PIN screen and let them retry, rather
        // than burying the mistake behind a full failure screen.
        setErr(detail.message);
        return;
      }
      setResult({ success: false, error: detail?.message || detail || "Payment failed" });
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-10">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Send Money</h2>
      </div>

      <div className="px-[22px]">
        {step === "vpa" && (
          <form onSubmit={handleResolveSubmit} className="animate-fadeUp">
            <Card className="p-5 mb-4">
              <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Pay to (UPI ID)</p>
              <input placeholder="e.g. merchant@paytm or user@renopay" value={vpa} onChange={(e) => setVpa(e.target.value)} />
              {err && <p className="text-danger text-xs mt-2">{err}</p>}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                <span>Try:</span>
                <button type="button" className="text-accent hover:underline cursor-pointer" onClick={() => { setVpa("praveen@renopay"); resolveVpa("praveen@renopay"); }}>praveen@renopay</button>
                <span>or</span>
                <button type="button" className="text-accent hover:underline cursor-pointer" onClick={() => { setVpa("groceries@paytm"); resolveVpa("groceries@paytm", "City Supermarket"); }}>groceries@paytm</button>
              </div>
            </Card>
            <Btn type="submit">Find & Pay →</Btn>
          </form>
        )}

        {step === "amount" && (
          <div className="animate-fadeUp">
            <Card className="p-4 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-[13px] bg-accent/[.28] flex items-center justify-center text-xl glow-icon shrink-0">👤</div>
                <div className="min-w-0">
                  <p className="font-bold text-[15px] text-textLight truncate">{resolvedName}</p>
                  <p className="text-muted text-xs font-mono truncate">{vpa}</p>
                </div>
              </div>
              {payeeApp && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-card border border-line text-textLight shrink-0">
                  {payeeApp}
                </span>
              )}
            </Card>

            {/* ── Payment Mode Toggle ── */}
            <div className="ns-mode-toggle">
              <button className={`ns-mode-btn ${payMode === "classic" ? "ns-mode-active" : ""}`} onClick={() => setPayMode("classic")} type="button">
                ⌨️ Keypad
              </button>
              <button className={`ns-mode-btn ${payMode === "slider" ? "ns-mode-active" : ""}`} onClick={() => setPayMode("slider")} type="button">
                💵 Note Slider
              </button>
            </div>

            {payMode === "classic" ? (
              /* ── Classic Keypad Mode (original) ── */
              <Card className="p-6 mb-4 relative glow-hero">
                <p className="text-muted text-[11px] tracking-wide mb-3 relative z-10 uppercase">Amount</p>
                <div className="flex items-center gap-2.5 relative z-10">
                  <span className="text-[32px] text-accent font-mono">₹</span>
                  <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                         className="text-[36px] font-extrabold border-none border-b-2 border-accent rounded-none pl-0 bg-transparent font-mono" />
                </div>
                {Number(amount) > 0 && Number(amount) <= 500 && (
                  <div className="mt-5 pt-4 border-t border-line flex justify-between items-center relative z-10">
                    <div><p className="font-bold text-[13px] text-teal">Use UPI Lite ⚡</p><p className="text-muted text-[10px]">No PIN required</p></div>
                    <button className="btn w-11 h-6 rounded-full relative" style={{ background: useLite ? "#22C55E" : "#5C564F44" }} onClick={() => setUseLite(!useLite)}>
                      <div className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: useLite ? 23 : 3 }} />
                    </button>
                  </div>
                )}
                <div className="mt-4 relative z-10">
                  <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Note</p>
                  <input placeholder="What's this for?" value={desc} onChange={(e) => setDesc(e.target.value)} className="mb-3" />
                  <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATS.map((c) => (
                      <button key={c.id} className="btn px-2.5 py-1.5 rounded-full text-[11px] font-semibold"
                              style={{ background: category === c.id ? "#FF6A1A22" : "#151210", border: `1px solid ${category === c.id ? "#FF6A1A" : "#2A2320"}`, color: category === c.id ? "#FF6A1A" : "#5C564F" }}
                              onClick={() => setCategory(c.id)}>
                        {c.icon} {c.id}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ) : (
              /* ── Note Slider Mode ── */
              <>
                <NoteSlider
                  onAmountChange={(v) => setAmount(String(v))}
                  recipientName={resolvedName}
                  recipientVpa={vpa}
                />
                <Card className="p-5 mb-4">
                  {Number(amount) > 0 && Number(amount) <= 500 && (
                    <div className="mb-4 pb-4 border-b border-line flex justify-between items-center">
                      <div><p className="font-bold text-[13px] text-teal">Use UPI Lite ⚡</p><p className="text-muted text-[10px]">No PIN required</p></div>
                      <button className="btn w-11 h-6 rounded-full relative" style={{ background: useLite ? "#22C55E" : "#5C564F44" }} onClick={() => setUseLite(!useLite)}>
                        <div className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: useLite ? 23 : 3 }} />
                      </button>
                    </div>
                  )}
                  <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Note</p>
                  <input placeholder="What's this for?" value={desc} onChange={(e) => setDesc(e.target.value)} className="mb-3" />
                  <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATS.map((c) => (
                      <button key={c.id} className="btn px-2.5 py-1.5 rounded-full text-[11px] font-semibold"
                              style={{ background: category === c.id ? "#FF6A1A22" : "#151210", border: `1px solid ${category === c.id ? "#FF6A1A" : "#2A2320"}`, color: category === c.id ? "#FF6A1A" : "#5C564F" }}
                              onClick={() => setCategory(c.id)}>
                        {c.icon} {c.id}
                      </button>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {err && <p className="text-danger text-xs mb-3">{err}</p>}
            <Btn onClick={proceedToAuth}>Continue →</Btn>
            <div className="mt-2.5"><Btn variant="ghost" onClick={() => setStep("vpa")}>← Back</Btn></div>
          </div>
        )}

        {step === "pin" && (
          <div className="animate-fadeUp">
            <Card className="p-[18px] mb-5 text-center border-accent/[.27]">
              <p className="text-muted text-xs">Paying</p>
              <p className="font-mono text-[30px] font-bold text-accent">{fmt(Number(amount))}</p>
              <p className="text-muted text-xs mt-0.5">to {resolvedName} · {vpa}</p>
            </Card>
            {err && <p className="text-danger text-[13px] text-center mb-3">{err}</p>}
            <PINPad onComplete={executePay} label="Enter your UPI PIN" />
            {loading && <p className="text-center text-muted text-xs mt-4">Processing...</p>}
          </div>
        )}

        {step === "result" && result && (
          <div className="animate-fadeUp text-center pt-5">
            <div
              className="w-[90px] h-[90px] rounded-full flex items-center justify-center text-4xl mx-auto mb-[18px] animate-heartbeat"
              style={{ background: result.success ? "#22C55E22" : "#ff3d6022", border: `2px solid ${result.success ? "#22C55E" : "#ff3d60"}` }}
            >
              {result.success ? "✓" : "✗"}
            </div>
            <h2 className="text-[26px] font-extrabold" style={{ color: result.success ? "#22C55E" : "#ff3d60" }}>
              {result.success ? "Payment Successful!" : "Payment Failed"}
            </h2>
            {result.success ? (
              <>
                <p className="text-muted mt-2">{fmt(result.amount)} sent to {resolvedName}</p>
                <p className="font-mono text-muted text-[11px] mt-1">TXN: {result.txn_ref}</p>
                {result.new_balance !== undefined && (
                  <p className="text-accent font-semibold text-sm mt-1.5">
                    Remaining Balance: {fmt(result.new_balance)}
                  </p>
                )}
                {result.round_up > 0 && <div className="mt-2"><Badge color="#FF6A1A">🪙 +{fmt(result.round_up)} rounded up to Digital Gold!</Badge></div>}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    disabled={downloadingReceipt}
                    className="btn bg-card border border-accent/40 text-accent hover:bg-accent/10 px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
                  >
                    📄 {downloadingReceipt ? "Generating PDF..." : "Download Receipt (PDF)"}
                  </button>
                  {downloadError && <p className="text-danger text-xs mt-1">{downloadError}</p>}
                </div>
              </>
            ) : <p className="text-muted mt-2">{result.error}</p>}
            <div className="mt-7 flex gap-2.5">
              <Btn variant="dark" onClick={onBack} className="flex-1">Home</Btn>
              {result.success && (
                <Btn variant="teal" className="flex-1" onClick={() => { setStep("vpa"); setVpa(""); setAmount(""); setResult(null); }}>
                  Pay Again
                </Btn>
              )}
              {result.isPinNotSet && (
                <Btn variant="teal" className="flex-1" onClick={() => onNavigate("profile")}>Go to Profile</Btn>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
