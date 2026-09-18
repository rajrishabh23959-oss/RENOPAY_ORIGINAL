import React, { useState, useEffect } from "react";
import { soundbox } from "./VendorSoundbox";

export function VendorGroqSettingsModal({ isOpen, onClose, currentLang = "hi" }) {
  const [groqKey, setGroqKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem("renopay_groq_api_key") || "";
    setGroqKey(existing);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem("renopay_groq_api_key", groqKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestVoice = () => {
    setTesting(true);
    soundbox.announcePayment(50, currentLang);
    setTimeout(() => setTesting(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] bg-[#1a1614] border border-[#ff6a1a]/30 rounded-2xl p-5 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent text-lg">
              ⚡
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Groq AI Voice Engine</h3>
              <p className="text-[11px] text-neutral-400">High-speed soundbox & voice synthesis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-300 font-medium mb-1.5">
              Groq API Key (gsk_...)
            </label>
            <input
              type="password"
              placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              className="w-full bg-[#120f0d] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-accent"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Groq key allows low-latency voice synthesis and multi-lingual voice recognition.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-neutral-300 font-semibold">Soundbox Engine Status</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                groqKey ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300"
              }`}>
                {groqKey ? "⚡ Groq Enabled" : "🔊 Native Offline Engine"}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Native speech engine runs 100% offline without key. Groq provides ultra-crisp studio voice.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleTestVoice}
              disabled={testing}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <span>{testing ? "Testing..." : "🔊 Test Voice"}</span>
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-3 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <span>{saved ? "✓ Saved!" : "Save Key"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
