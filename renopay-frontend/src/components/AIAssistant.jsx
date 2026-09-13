import { useState, useEffect, useRef } from "react";
import { AIAPI, AccountAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import saathiLogo from "../assets/saathi-logo.png";

const LANGUAGES = [
  { code: "en", name: "English", native: "English", flag: "🌐", locale: "en-IN" },
  { code: "hi", name: "Hindi", native: "हिंदी", flag: "🇮🇳", locale: "hi-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇮🇳", locale: "ta-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", flag: "🇮🇳", locale: "te-IN" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", flag: "🇮🇳", locale: "ml-IN" },
];

const SCREEN_PROMPTS = {
  split: [
    "How do I split a bill with friends?",
    "Can I set custom amounts per person in Split Bill?",
  ],
  vaults: [
    "How do shared vaults work in RenoPay?",
    "How are vault withdrawals approved with multi-sig?",
  ],
  accounting: [
    "Explain double-entry ledger & chart of accounts",
    "How do I generate and download GST reports?",
    "How does automated payroll calculation work?",
  ],
  gold: [
    "How does 24K digital gold round-up work?",
    "How can I withdraw my gold balance to bank?",
  ],
  upilite: [
    "What are UPI Lite limits and benefits?",
    "How to make pinless 1-click payments under ₹500?",
  ],
  pay: [
    "How to send money to a UPI ID?",
    "What is the high-value privacy code?",
  ],
  home: [
    "Give me an overview of top RenoPay features",
    "How does SentinAI fraud detection protect me?",
    "How to save money with Digital Gold round-up?",
  ],
};

export function AIAssistant({ currentScreen = "home", onNavigate }) {
  const { profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Active language
  const [currentLang, setCurrentLang] = useState("en");

  // Voice state: STT (Speech-to-Text) and TTS (Text-to-Speech)
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const modalRef = useRef(null);

  // Sync language with user profile
  useEffect(() => {
    if (profile?.language_code) {
      setCurrentLang(profile.language_code);
    }
  }, [profile?.language_code]);

  // Initial welcome greeting when chat opens first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const userFirstName = profile?.full_name?.split(" ")[0] || "there";
      let greeting = `Hello ${userFirstName}! I'm **Saathi**, your personal financial companion on RenoPay. How can I help you today?`;
      if (currentLang === "hi") {
        greeting = `नमस्ते ${userFirstName}! मैं **Saathi** हूँ, आपका RenoPay वित्तीय साथी। Split Bill, Shared Vaults, UPI Lite, Digital Gold या RenoPay के किसी भी फीचर के बारे में आप मुझसे पूछ सकते हैं!`;
      } else if (currentLang === "ta") {
        greeting = `வணக்கம் ${userFirstName}! நான் **Saathi**, உங்கள் RenoPay நிதி உதவியாளர். உங்களுக்கு நான் எவ்வாறு உதவ முடியும்?`;
      } else if (currentLang === "te") {
        greeting = `నమస్కారం ${userFirstName}! నేను **Saathi**, మీ RenoPay ఆర్థిక సహాయకుడిని. మీకు నేను ఎలా సహాయపడగలను?`;
      } else if (currentLang === "ml") {
        greeting = `നമസ്കാരം ${userFirstName}! ഞാൻ **Saathi**, നിങ്ങളുടെ RenoPay സാമ്പത്തിക സഹായി. ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?`;
      }

      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: greeting,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, currentLang, profile?.full_name]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const handleClose = () => {
    // Note: Do not cancel speech synthesis here so Saathi keeps speaking
    // the instructions while the user navigates RenoPay screens!
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setIsOpen(false);
  };

  // Handle Text Submission
  const handleSend = async (overrideText = null) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || busy) return;

    setInput("");
    const userMsg = {
      id: "u-" + Date.now(),
      role: "user",
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const res = await AIAPI.query(
        textToSend,
        currentScreen,
        currentLang,
        sessionId
      );

      if (res.session_id) setSessionId(res.session_id);

      const botMsg = {
        id: "b-" + Date.now(),
        role: "assistant",
        content: res.response_text,
        provider: res.provider,
        model: res.model,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errMsg = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `⚠️ ${e?.response?.data?.detail || "Could not connect to Saathi. Please check backend Groq API settings or network."}`,
        isError: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
    }
  };

  // Speech-to-Text (STT)
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
      recognition.lang = langObj.locale;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };
      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition startup error:", e);
      setIsListening(false);
    }
  };

  // Text-to-Speech (TTS)
  const toggleSpeechSynthesis = (msgId, text) => {
    if (!window.speechSynthesis) return;

    if (speakingMessageId === msgId) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
    utterance.lang = langObj.locale;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setSpeakingMessageId(msgId);
      setIsSpeaking(true);
      setIsSpeechPaused(false);
    };

    utterance.onend = () => {
      setSpeakingMessageId(null);
      setIsSpeaking(false);
      setIsSpeechPaused(false);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
      setIsSpeaking(false);
      setIsSpeechPaused(false);
    };

    setSpeakingMessageId(msgId);
    setIsSpeaking(true);
    setIsSpeechPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeechPause = (e) => {
    e?.stopPropagation();
    if (!window.speechSynthesis) return;
    if (isSpeechPaused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
    }
  };

  const stopSpeech = (e) => {
    e?.stopPropagation();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    setIsSpeaking(false);
    setIsSpeechPaused(false);
  };

  const currentPrompts = SCREEN_PROMPTS[currentScreen] || SCREEN_PROMPTS["home"];
  const currentLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  return (
    <>
      {/* ── 1. Floating Saathi Button (Centered Circle Launcher) ────────── */}
      {!isOpen && (
        <div className="fixed bottom-[74px] left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#151210] shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_25px_rgba(255,106,26,0.55)] border-2 transition-all duration-300 cursor-pointer ${
              isSpeaking
                ? "border-teal ring-4 ring-teal/30 scale-105 shadow-[0_0_30px_rgba(20,184,166,0.5)]"
                : "border-accent hover:border-[#FF5500] hover:scale-110 active:scale-95"
            }`}
            title="Open Saathi - Your RenoPay Assistant"
          >
            {/* Ambient radial pulse glow */}
            <span
              className={`absolute inset-0 rounded-full blur-md -z-10 transition-all animate-pulse ${
                isSpeaking ? "bg-teal/50" : "bg-accent/40 group-hover:blur-lg group-hover:bg-accent/60"
              }`}
            />

            {/* Circular Saathi Logo */}
            <img
              src={saathiLogo}
              alt="Saathi"
              className="w-full h-full rounded-full object-cover p-0.5"
            />

            {/* Speaking audio animation badge or online indicator */}
            {isSpeaking ? (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-teal text-black text-[10px] font-black shadow-md flex items-center gap-0.5 animate-bounce">
                <span>🔊</span>
              </span>
            ) : (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-teal border-2 border-[#151210] shadow-sm flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </span>
            )}
          </button>

          {/* Docked Audio Controller under circle (Handwritten diagram layout) */}
          {isSpeaking && (
            <div className="mt-2.5 flex items-center gap-2 bg-[#171310]/95 backdrop-blur-xl border border-teal/50 px-3 py-1.5 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.95)] animate-fade-in z-[95]">
              {/* Pause / Play Button */}
              <button
                type="button"
                onClick={toggleSpeechPause}
                className="btn px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title={isSpeechPaused ? "Resume Saathi Voice" : "Pause Saathi Voice"}
              >
                <span>{isSpeechPaused ? "▶️ Play" : "⏸️ Pause"}</span>
              </button>

              <span className="w-px h-3.5 bg-white/20" />

              {/* Stop Button (Cancels audio & resets icon to normal) */}
              <button
                type="button"
                onClick={stopSpeech}
                className="btn px-2.5 py-1 rounded-full text-xs font-bold bg-danger/25 hover:bg-danger/40 text-danger border border-danger/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title="Stop Voice & Reset"
              >
                <span>⏹️ Stop</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Centered Modal Overlay ("BEECH ME KRO") ───────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-5 bg-black/80 backdrop-blur-md transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          {/* Centered Modal Card */}
          <div
            ref={modalRef}
            className="relative w-full max-w-[460px] h-[88dvh] max-h-[640px] flex flex-col bg-[#120F0D] border border-accent/40 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(255,106,26,0.2)] overflow-hidden ring-1 ring-white/10 animate-fade-in"
          >
            {/* Top subtle decorative ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-28 bg-gradient-to-b from-accent/25 to-transparent blur-3xl pointer-events-none -z-0" />

            {/* Mobile Top Grab / Close Bar (Guaranteed Cut button on phone) */}
            <div className="sm:hidden flex items-center justify-between px-3.5 py-2 bg-[#171310] border-b border-line/60 flex-shrink-0 z-20">
              <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                <span>✨</span> Saathi AI Assistant
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1 rounded-full bg-white/15 active:bg-danger text-white text-xs font-black flex items-center gap-1 border border-white/25 shadow-sm cursor-pointer"
                aria-label="Close Saathi Chat"
              >
                ✕ Close
              </button>
            </div>

            {/* Header Bar */}
            <div className="relative z-10 px-3.5 sm:px-4 py-3 bg-[#181412]/95 backdrop-blur-md border-b border-line/80 flex items-center justify-between gap-2 flex-shrink-0">
              {/* Saathi Brand & Status */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                  <img
                    src={saathiLogo}
                    alt="Saathi Logo"
                    className="w-10 h-10 rounded-full object-cover border-2 border-accent/50 shadow-md ring-1 ring-white/10"
                  />
                  {/* Online Dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal border-2 border-[#181412] shadow-sm animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm sm:text-base font-black text-white tracking-wide truncate">
                      Saathi
                    </h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal/15 text-teal font-bold border border-teal/30 flex-shrink-0">
                      Online
                    </span>
                  </div>
                  <p className="text-[10px] text-muted truncate font-medium">
                    Your 24/7 Companion
                  </p>
                </div>
              </div>

              {/* Controls: Language Selector & High-Visibility Close Button */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Language Select Dropdown */}
                <select
                  value={currentLang}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setCurrentLang(newLang);
                    if (profile) {
                      AccountAPI.updatePreferences({ language_code: newLang })
                        .then(refreshProfile)
                        .catch(() => {});
                    }
                  }}
                  className="bg-[#1D1815] border border-accent/40 text-[11px] text-accent font-bold rounded-xl px-2 py-1.5 outline-none cursor-pointer max-w-[120px] sm:max-w-none truncate hover:border-accent transition-colors"
                  title="Change AI Language"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#181412] text-white">
                      {l.flag} {l.native}
                    </option>
                  ))}
                </select>

                {/* Primary Prominent Close Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:bg-danger/60 border border-white/20 text-white flex items-center justify-center text-base font-black transition-all cursor-pointer flex-shrink-0 shadow-sm"
                  title="Close (Esc)"
                  aria-label="Close Saathi Chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Smart Screen Context Bar */}
            <div className="relative z-10 px-4 py-2 bg-accent/[.08] border-b border-accent/20 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-muted">
                <span className="text-accent">📍</span>
                <span>Active Context:</span>
                <span className="text-accent font-bold uppercase tracking-wider">
                  {currentScreen}
                </span>
              </div>
              <span className="text-muted text-[10px] font-medium">
                Speaks {currentLangObj.native}
              </span>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin relative z-10">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-2 max-w-[88%]">
                      {/* Saathi Icon Avatar */}
                      {!isUser && (
                        <img
                          src={saathiLogo}
                          alt="Saathi"
                          className="w-7 h-7 rounded-full object-cover border border-accent/40 shadow-sm flex-shrink-0 mb-1"
                        />
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? "bg-gradient-to-r from-accent to-[#D43D0A] text-white rounded-br-none shadow-md font-medium"
                            : m.isError
                            ? "bg-danger/15 text-danger border border-danger/30 rounded-bl-none"
                            : "bg-[#1B1614] text-zinc-100 border border-white/10 rounded-bl-none shadow-sm"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>

                        {/* Footer with Timestamp & Listen / Pause / Stop buttons */}
                        {!isUser && !m.isError && (
                          <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-muted">
                            <span className="text-[10px]">{m.time}</span>
                            {speakingMessageId === m.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSpeechPause();
                                  }}
                                  className="text-white hover:text-accent font-bold transition-colors flex items-center gap-1 cursor-pointer bg-white/10 px-2 py-0.5 rounded-md border border-white/10 text-[10px]"
                                  title={isSpeechPaused ? "Resume voice" : "Pause voice"}
                                >
                                  <span>{isSpeechPaused ? "▶️ Resume" : "⏸️ Pause"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    stopSpeech();
                                  }}
                                  className="text-danger hover:text-danger/80 font-bold transition-colors flex items-center gap-1 cursor-pointer bg-danger/15 px-2 py-0.5 rounded-md border border-danger/30 text-[10px]"
                                  title="Stop voice"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-ping" />
                                  <span>⏹️ Stop</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleSpeechSynthesis(m.id, m.content)}
                                className="text-muted hover:text-accent font-semibold transition-colors flex items-center gap-1 cursor-pointer bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
                                title="Listen audio"
                              >
                                <span>🔊 Listen</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isUser && (
                      <span className="text-[10px] text-muted mt-1 pr-1 font-mono">
                        {m.time}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Saathi Thinking Animation */}
              {busy && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#1B1614] border border-white/10 w-fit animate-pulse">
                  <img
                    src={saathiLogo}
                    alt="Saathi"
                    className="w-6 h-6 rounded-full object-cover border border-accent/40 animate-spin"
                    style={{ animationDuration: "3s" }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                    <span className="text-xs text-muted font-medium ml-1">
                      Saathi is thinking...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Context-Aware Suggestion Chips */}
            {messages.length <= 4 && (
              <div className="relative z-10 px-4 py-2.5 bg-[#15110E] border-t border-line/80 flex gap-2 overflow-x-auto scrollbar-none">
                {currentPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#1F1916] border border-white/10 text-xs text-muted hover:text-white hover:border-accent/50 hover:bg-accent/15 transition-all cursor-pointer font-medium"
                  >
                    💡 {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Live Listening Wave Banner */}
            {isListening && (
              <div className="relative z-10 px-4 py-2.5 bg-[#FF3D60]/15 border-t border-[#FF3D60]/30 flex items-center justify-between text-xs text-[#FF3D60] animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF3D60] animate-ping" />
                  <span>
                    Listening in <strong>{currentLangObj.native}</strong>... speak now
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => recognitionRef.current?.stop()}
                  className="font-bold underline cursor-pointer hover:opacity-80"
                >
                  Done
                </button>
              </div>
            )}

            {/* Input Footer Bar */}
            <div className="relative z-10 p-3.5 bg-[#181412] border-t border-line/80 flex items-center gap-2.5">
              {/* Mic Voice Button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-all cursor-pointer flex-shrink-0 ${
                  isListening
                    ? "bg-[#FF3D60] text-white animate-pulse shadow-lg ring-2 ring-[#FF3D60]/50"
                    : "bg-[#1F1916] border border-white/10 text-muted hover:text-accent hover:border-accent/40"
                }`}
                title={isListening ? "Listening..." : "Tap to Speak (Voice)"}
              >
                🎙️
              </button>

              {/* Text Input Field */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  currentLang === "hi"
                    ? "Saathi se kuch bhi poochein..."
                    : `Ask Saathi in ${currentLangObj.native}...`
                }
                className="flex-1 bg-[#120F0D] border border-white/15 rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder:text-muted/60 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                disabled={busy}
                autoFocus
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={busy || !input.trim()}
                className="w-11 h-11 rounded-2xl bg-gradient-to-r from-accent to-[#D43D0A] text-white flex items-center justify-center text-base font-bold shadow-md hover:opacity-95 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex-shrink-0"
                title="Send message"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
