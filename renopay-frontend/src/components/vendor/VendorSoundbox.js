// Soundbox Engine for RenoPay Vendor Mode
// Plays iconic dual-bell chime via Web Audio API + regional speech announcement

import { getTranslation } from "./VendorTranslations";

class SoundboxEngine {
  constructor() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Dual tone bell chime (Signature soundbox ding-dong)
  playChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // First bell note (E5 ~ 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Second higher bell note (A5 ~ 880 Hz / C#6 ~ 1108 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.5, now + 0.12); // C6
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.45, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);
    } catch (err) {
      console.warn("Soundbox chime playback error:", err);
    }
  }

  // Spoken voice confirmation
  speak(text, langCode = "hi") {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis not supported on this device.");
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      const speechMap = {
        hi: "hi-IN",
        en: "en-IN",
        te: "te-IN",
        ta: "ta-IN",
        ml: "ml-IN",
      };
      utterance.lang = speechMap[langCode] || "hi-IN";
      utterance.rate = 0.92; // Clear, deliberate cadence for merchants
      utterance.pitch = 1.05;

      // Select matching regional voice if available
      const voices = window.speechSynthesis.getVoices();
      const targetLang = utterance.lang.toLowerCase();
      const matchedVoice = voices.find(
        (v) => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2))
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  }

  // Play chime first, followed by clear voice announcement in the selected language
  announcePayment(amount, langCode = "hi") {
    this.playChime();

    const t = getTranslation(langCode);
    const text = t.voice_received_phrase.replace("{amount}", amount);

    // Wait for the chime to complete before speaking
    setTimeout(() => {
      this.speak(text, langCode);
    }, 450);

    return text;
  }
}

export const soundbox = new SoundboxEngine();
