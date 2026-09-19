import { useState, useRef, useEffect } from "react";
import { PaymentAPI } from "../lib/api";
import { Card, Btn } from "../components/ui";

/**
 * VoiceUPIScreen — On-device voice command for UPI payments.
 *
 * Uses the browser Web Speech API (SpeechRecognition) for on-device,
 * privacy-first ASR. No audio ever leaves the device.
 * A lightweight JS regex NLP extracts [amount, recipient, note] from
 * the transcript, then validates via /payments/voice-parse.
 *
 * Supports: English, Hindi (hi-IN), Tamil (ta-IN)
 */

const LANG_OPTIONS = [
  { code: "en-IN", label: "English", flag: "🇬🇧" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ta-IN", label: "தமிழ்", flag: "🌺" },
];

/* ── On-device NLP Entity Extractor ─────────────────────────────────────── */
function extractEntities(transcript) {
  const lower = transcript.toLowerCase();

  // Amount: "pay 500", "500 rupees", "₹500", "five hundred"
  const WORD_NUMS = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,
    eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,
    seventy:70,eighty:80,ninety:90,hundred:100,thousand:1000,lakh:100000,
  };
  let amount = null;
  const digitMatch = lower.match(/(?:rs\.?|₹|rupees?)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:rs\.?|₹|rupees?)?/i);
  if (digitMatch) {
    amount = parseFloat(digitMatch[1].replace(/,/g, ""));
  } else {
    // word-based number parsing
    const words = lower.split(/\s+/);
    let sum = 0, current = 0;
    for (const w of words) {
      const n = WORD_NUMS[w];
      if (n !== undefined) {
        if (n === 100) { current = current ? current * n : n; }
        else if (n >= 1000) { sum += (current || 1) * n; current = 0; }
        else { current += n; }
      }
    }
    const total = sum + current;
    if (total > 0) amount = total;
  }

  // Recipient: "to [name]", "ko [name]", "க்கு [name]"
  let recipient = null;
  const toMatch = lower.match(/(?:\bto\b|\bko\b|\bpay\b.*?\bto\b)\s+([a-z\u0900-\u097f\u0B80-\u0BFF]+)/i);
  if (toMatch) recipient = toMatch[1].trim();

  // Note / purpose: "for [note]", "ke liye [note]", "lunch/dinner etc."
  let note = null;
  const forMatch = lower.match(/(?:\bfor\b|\bke liye\b|\bwaste\b)\s+([\w\s]+?)(?:\s*$|\s+(?:to|ko|via|using))/i);
  if (forMatch) note = forMatch[1].trim();

  // Confidence heuristic
  let confidence = 0.5;
  if (amount) confidence += 0.25;
  if (recipient) confidence += 0.20;
  if (note) confidence += 0.05;

  return { amount, recipient, note, confidence: Math.min(confidence, 1.0) };
}

/* ── Main Component ──────────────────────────────────────────────────────── */
/* ── Main Component ────────────────────────────────────────────────        */
export function VoiceUPIScreen({ onBack, onNavigatePay }) {
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [entities, setEntities] = useState(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recogRef = useRef(null);
  const waveTimerRef = useRef(null);
  const [waveBars, setWaveBars] = useState(Array(12).fill(20));

  useEffect(() => {
    const isNative = !!window.AndroidSTT;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition && !isNative) { setSupported(false); return; }
    setSupported(true);

    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = lang;

      recog.onstart = () => {
        setListening(true);
        setTranscript("");
        setEntities(null);
        setResult(null);
        setError("");
        // Animate wave bars randomly
        waveTimerRef.current = setInterval(() => {
          setWaveBars(Array.from({ length: 12 }, () => Math.floor(Math.random() * 80 + 20)));
        }, 150);
      };

      recog.onresult = (evt) => {
        const interim = Array.from(evt.results).map(r => r[0].transcript).join(" ");
        setTranscript(interim);
      };

      recog.onend = async () => {
        clearInterval(waveTimerRef.current);
        setWaveBars(Array(12).fill(20));
        setListening(false);
        const finalText = transcript || "";
        if (!finalText.trim()) { setError("No speech detected. Tap the mic and try again."); return; }
        handleFinalTranscript(finalText);
      };

      recog.onerror = (e) => {
        clearInterval(waveTimerRef.current);
        setWaveBars(Array(12).fill(20));
        setListening(false);
        setError(e.error === "no-speech" ? "No speech detected." : `Error: ${e.error}`);
      };

      recogRef.current = recog;
      return () => { recog.abort(); clearInterval(waveTimerRef.current); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleFinalTranscript = async (finalText) => {
    const ext = extractEntities(finalText);
    setEntities(ext);

    if (!ext.amount || !ext.recipient) {
      setError("Could not extract amount or recipient. Please try again.");
      return;
    }

    // Validate via backend
    setValidating(true);
    try {
      const res = await PaymentAPI.voiceParse({
        amount: ext.amount,
        recipient: ext.recipient,
        note: ext.note,
        transcript: finalText,
        confidence: ext.confidence,
        language: lang,
      });
      setResult(res);
      setValidating(false);
    } catch {
      setValidating(false);
      setError("Validation failed. Please check your connection.");
    }
  };

  const startListening = () => {
    if (window.AndroidSTT?.startListening) {
      setListening(true);
      setTranscript("");
      setEntities(null);
      setResult(null);
      setError("");
      window.__onNativeSpeechResult = (text) => {
        setListening(false);
        setTranscript(text);
        if (text && text.trim()) {
          handleFinalTranscript(text);
        } else {
          setError("No speech detected. Tap the mic and try again.");
        }
      };
      window.AndroidSTT.startListening(lang);
      return;
    }
    recogRef.current?.start();
  };

  const stopListening = () => {
    if (recogRef.current) {
      recogRef.current.stop();
    }
    setListening(false);
  };

  const handleProceed = () => {
    if (!result || !entities) return;
    onNavigatePay?.({
      vpa: result.resolved_vpa || "",
      amount: entities.amount,
      note: entities.note || "",
      fromVoice: true,
    });
  };

  return (
    <>
      <style>{`
        @keyframes voiceBar0 { from{height:20%} to{height:90%} }
        @keyframes voiceBar1 { from{height:30%} to{height:70%} }
        @keyframes voiceBar2 { from{height:50%} to{height:100%} }
        @keyframes voiceBar3 { from{height:20%} to{height:60%} }
        @keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,106,26,.5)} 50%{box-shadow:0 0 0 20px rgba(255,106,26,0)} }
      `}</style>

      <div className="min-h-screen bg-bg pb-[100px]">
        {/* Header */}
        <div className="pt-[50px] pb-4 px-[22px] flex items-center gap-3">
          <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
          <h2 className="text-[22px] font-extrabold text-textLight">Voice UPI 🎙️</h2>
          <span className="ml-auto text-[10px] text-success font-semibold bg-success/10 border border-success/30 rounded-full px-2 py-0.5">On-Device</span>
        </div>

        <div className="px-[22px] flex flex-col gap-4">
          {!supported && (
            <Card className="p-5 border-danger/40 bg-danger/5">
              <p className="text-danger text-sm font-semibold mb-1">Browser Not Supported</p>
              <p className="text-muted text-xs">Please use Chrome, Edge, or Safari for voice recognition.</p>
            </Card>
          )}

          {/* Language Selector */}
          <Card className="p-4">
            <p className="text-[10px] text-muted font-bold tracking-widest mb-3">LANGUAGE</p>
            <div className="flex gap-2">
              {LANG_OPTIONS.map((l) => (
                <button
                  key={l.code}
                  className="btn flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{
                    background: lang === l.code ? "#FF6A1A22" : "#151210",
                    border: `1.5px solid ${lang === l.code ? "#FF6A1A" : "#2A2320"}`,
                    color: lang === l.code ? "#FF6A1A" : "#5C564F",
                  }}
                  onClick={() => setLang(l.code)}
                >
                  <span>{l.flag}</span> {l.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Mic Button + Waveform */}
          <Card className="p-6 flex flex-col items-center gap-4">
            <p className="text-[10px] text-muted font-bold tracking-widest">
              {listening ? "LISTENING… SPEAK NOW" : "TAP MIC TO SPEAK"}
            </p>

            {/* Waveform */}
            <div className="flex items-center justify-center gap-[3px] h-14 w-full">
              {waveBars.map((h, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-150"
                  style={{ width: 4, height: `${listening ? h : 20}%`, background: listening ? "#FF6A1A" : "#5C564F", minHeight: 4 }}
                />
              ))}
            </div>

            {/* Mic Button */}
            <button
              className="btn w-20 h-20 rounded-full flex items-center justify-center text-3xl"
              style={{
                background: listening ? "linear-gradient(135deg,#FF6A1A,#B8420E)" : "#151210",
                border: `2.5px solid ${listening ? "#FF6A1A" : "#2A2320"}`,
                animation: listening ? "micPulse 1.2s ease infinite" : "none",
                boxShadow: listening ? "0 0 32px rgba(255,106,26,.4)" : "none",
              }}
              onClick={listening ? stopListening : startListening}
              disabled={!supported}
            >
              {listening ? "⏹" : "🎙️"}
            </button>

            <p className="text-xs text-muted text-center">
              Say: <span className="text-textLight font-semibold">"Pay 500 rupees to Rishabh for lunch"</span>
            </p>
          </Card>

          {/* Live Transcript */}
          {transcript && (
            <Card className="p-4 border-accent/30">
              <p className="text-[10px] text-muted font-bold tracking-widest mb-2">TRANSCRIPT</p>
              <p className="text-textLight text-sm leading-relaxed italic">"{transcript}"</p>
            </Card>
          )}

          {/* Extracted Entities */}
          {entities && !validating && (
            <Card className="p-4">
              <p className="text-[10px] text-muted font-bold tracking-widest mb-3">EXTRACTED DETAILS</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Amount", value: entities.amount ? `₹${entities.amount}` : "—", ok: !!entities.amount },
                  { label: "To", value: entities.recipient || "—", ok: !!entities.recipient },
                  { label: "Note", value: entities.note || "—", ok: true },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl p-3 text-center"
                    style={{ background: f.ok && f.value !== "—" ? "#FF6A1A15" : "#15121088", border: `1px solid ${f.ok && f.value !== "—" ? "#FF6A1A" : "#2A2320"}` }}>
                    <p className="text-[9px] text-muted font-bold mb-1">{f.label}</p>
                    <p className="text-textLight text-[11px] font-bold truncate">{f.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-bg rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${entities.confidence * 100}%`, background: entities.confidence > 0.8 ? "#22C55E" : entities.confidence > 0.6 ? "#FFA000" : "#FF6A1A" }} />
                </div>
                <p className="text-[10px] text-muted">{(entities.confidence * 100).toFixed(0)}% confidence</p>
              </div>
            </Card>
          )}

          {validating && (
            <Card className="p-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
              <p className="text-textLight text-sm">Validating with server…</p>
            </Card>
          )}

          {/* Result / Action */}
          {result && !validating && (
            <Card className={`p-4 ${result.needs_confirmation ? "border-warn/40 bg-warn/5" : "border-success/40 bg-success/5"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{result.needs_confirmation ? "⚠️" : "✅"}</span>
                <p className="text-textLight font-semibold text-sm">{result.message}</p>
              </div>
              {result.resolved_vpa && (
                <p className="text-muted text-xs mb-3">VPA: <span className="text-textLight font-mono">{result.resolved_vpa}</span></p>
              )}
              <Btn
                variant={result.needs_confirmation ? "ghost" : "primary"}
                onClick={handleProceed}
                disabled={!entities?.amount || !entities?.recipient}
              >
                {result.needs_confirmation ? "Verify & Pay →" : "Pay Now →"}
              </Btn>
            </Card>
          )}

          {error && (
            <p className="text-danger text-xs text-center bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">{error}</p>
          )}

          {/* Privacy note */}
          <div className="flex items-start gap-2 px-2 pb-2">
            <span className="text-[16px] mt-0.5">🔒</span>
            <p className="text-muted text-[11px] leading-relaxed">
              Voice processing happens <strong className="text-textLight">entirely on your device</strong>.
              No audio is ever sent to our servers — only the extracted text.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
