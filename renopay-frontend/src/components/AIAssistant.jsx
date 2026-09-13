import { useState, useEffect, useRef } from "react";
import { AIAPI, AccountAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const LANGUAGES = [
  { code: "en", name: "English (English)", flag: "🌐", locale: "en-IN" },
  { code: "hi", name: "Hindi (हिंदी)", flag: "🇮🇳", locale: "hi-IN" },
  { code: "ta", name: "Tamil (தமிழ்)", flag: "🇮🇳", locale: "ta-IN" },
  { code: "te", name: "Telugu (తెలుగు)", flag: "🇮🇳", locale: "te-IN" },
  { code: "ml", name: "Malayalam (മലയാളം)", flag: "🇮🇳", locale: "ml-IN" },
];

const SCREEN_PROMPTS = {
  split: [
    "How do I split a bill with friends?",
    "Can I set custom amounts per person?",
  ],
  vaults: [
    "How do shared vaults work?",
    "How are vault withdrawals approved?",
  ],
  accounting: [
    "Explain double-entry ledger in RenoPay",
    "How do I generate a GST report?",
    "How to run automated payroll?",
  ],
  gold: [
    "How does 24K digital gold round-up work?",
    "How can I withdraw my gold to bank?",
  ],
  upilite: [
    "What are UPI Lite limits and benefits?",
    "How to make pinless 1-click payments?",
  ],
  pay: [
    "How to send money to a UPI ID?",
    "What is high-value privacy code?",
  ],
  home: [
    "Give me an overview of RenoPay features",
    "How does SentinAI fraud detection protect me?",
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

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Sync language with user profile
  useEffect(() => {
    if (profile?.language_code) {
      setCurrentLang(profile.language_code);
    }
  }, [profile?.language_code]);

  // Initial welcome greeting when chat opens first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
      let greeting = `Hello ${profile?.full_name?.split(" ")[0] || "there"}! I'm **RenoAI**, your personal guide. How can I help you today?`;
      if (currentLang === "hi") {
        greeting = `नमस्ते ${profile?.full_name?.split(" ")[0] || ""}! मैं **RenoAI** हूँ। RenoPay के किसी भी फीचर (Split Bill, Vaults, Accounting, UPI Lite) के बारे में आप मुझसे पूछ सकते हैं!`;
      } else if (currentLang === "ta") {
        greeting = `வணக்கம்! நான் **RenoAI**. RenoPay பயன்பாட்டில் உங்களுக்கு எவ்வாறு உதவ முடியும்?`;
      } else if (currentLang === "te") {
        greeting = `నమస్కారం! నేను **RenoAI**. RenoPay ఫీచర్ల గురించి ఏదైనా నన్ను అడగవచ్చు!`;
      } else if (currentLang === "ml") {
        greeting = `നമസ്കാരം! ഞാൻ **RenoAI**. RenoPay-ൽ ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?`;
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

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        is_byo: res.is_byo,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errMsg = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `⚠️ ${e?.response?.data?.detail || "Could not connect to AI Assistant. Please check your network or try again."}`,
        isError: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Speech-to-Text (STT) via Web Speech API
  // -------------------------------------------------------------------------
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

      // Select locale based on active language
      const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
      recognition.lang = langObj.locale;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          // Automatically send transcribed text
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

  // -------------------------------------------------------------------------
  // Text-to-Speech (TTS) via Web Speech API
  // -------------------------------------------------------------------------
  const toggleSpeechSynthesis = (msgId, text) => {
    if (!window.speechSynthesis) return;

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel(); // stop any ongoing audio
    const cleanText = text.replace(/[*#_`]/g, ""); // strip markdown tokens
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
    utterance.lang = langObj.locale;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const currentPrompts = SCREEN_PROMPTS[currentScreen] || SCREEN_PROMPTS["home"];
  const currentLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  return (
    <>
      {/* ── 1. Floating Action Bubble (Bottom-Right) ───────────────────── */}
      <div className="fixed bottom-[74px] right-4 z-[90]">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="btn relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-accent via-[#FF5500] to-[#992200] text-white shadow-2xl border-2 border-accent/60 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Open RenoAI Assistant"
          >
            {/* Glowing radial aura */}
            <span className="absolute inset-0 rounded-full bg-accent/40 blur-md -z-10 group-hover:blur-lg transition-all animate-pulse" />

            <span className="text-2xl animate-bounce">🤖</span>

            {/* Tiny active badge */}
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-teal border-2 border-[#0A0908] flex items-center justify-center text-[9px] font-extrabold text-black">
              ✓
            </span>
          </button>
        )}
      </div>

      {/* ── 2. Chat Modal / Drawer ────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-4 sm:w-[410px] sm:h-[580px] bg-[#0F0D0C]/95 backdrop-blur-xl border border-accent/30 rounded-none sm:rounded-3xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-fade-in">
          {/* Header Bar */}
          <div className="px-4 py-3.5 bg-[#171310] border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-[#B8420E] flex items-center justify-center text-lg shadow-sm border border-accent/40">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-extrabold text-white">RenoAI</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal/15 text-teal font-semibold border border-teal/30">
                    ⚡ Online
                  </span>
                </div>
                <p className="text-[10px] text-muted flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                  <span>Multilingual Smart Guide</span>
                </p>
              </div>
            </div>

            {/* Language & Close Controls */}
            <div className="flex items-center gap-1.5">
              {/* Quick Language Dropdown */}
              <select
                value={currentLang}
                onChange={(e) => {
                  setCurrentLang(e.target.value);
                  if (profile) {
                    AccountAPI.updatePreferences({ language_code: e.target.value }).then(refreshProfile).catch(() => {});
                  }
                }}
                className="bg-[#120F0D] border border-line text-[11px] text-accent rounded-lg px-2 py-1 outline-none font-bold cursor-pointer"
                title="Change AI Language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5 text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Screen Context Banner */}
          <div className="px-4 py-2 bg-accent/[.07] border-b border-accent/20 flex items-center justify-between text-[11px]">
            <span className="text-muted flex items-center gap-1">
              <span>📍</span> Current Screen: <strong className="text-accent uppercase">{currentScreen}</strong>
            </span>
            <span className="text-[10px] text-muted font-mono">{currentLangObj.name}</span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? "bg-accent text-white rounded-br-none shadow-md"
                        : m.isError
                        ? "bg-danger/15 text-danger border border-danger/30 rounded-bl-none"
                        : "bg-[#181412] text-textLight border border-line rounded-bl-none shadow-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Metadata footer with TTS speaker button */}
                    {!isUser && !m.isError && (
                      <div className="mt-2 pt-1.5 border-t border-line/60 flex items-center justify-between text-[10px] text-muted">
                        <span>{m.time}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSpeechSynthesis(m.id, m.content)}
                            className="text-muted hover:text-accent font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="Listen in your language"
                          >
                            <span>{speakingMessageId === m.id ? "⏹️ Stop" : "🔊 Listen"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isUser && <span className="text-[9px] text-muted mt-0.5 pr-1">{m.time}</span>}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {busy && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#181412] border border-line w-fit">
                <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                <span className="text-xs text-muted">RenoAI is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Context-Aware Suggestion Chips */}
          {messages.length <= 4 && (
            <div className="px-3 py-2 bg-[#120F0D] border-t border-line flex gap-1.5 overflow-x-auto scrollbar-none">
              {currentPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-card border border-line text-[11px] text-muted hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
                >
                  💡 {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Listening Pulsing Wave Banner */}
          {isListening && (
            <div className="px-4 py-2 bg-[#FF3D60]/15 border-t border-[#FF3D60]/30 flex items-center justify-between text-xs text-[#FF3D60]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF3D60] animate-ping" />
                <span>Listening in <strong>{currentLangObj.name}</strong>... speak now</span>
              </div>
              <button
                type="button"
                onClick={() => recognitionRef.current?.stop()}
                className="font-bold underline cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-[#171310] border-t border-line flex items-center gap-2">
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all cursor-pointer ${
                isListening
                  ? "bg-[#FF3D60] text-white animate-pulse shadow-md"
                  : "bg-card border border-line text-muted hover:text-accent hover:border-accent"
              }`}
              title={isListening ? "Listening..." : "Tap to Speak (Voice Input)"}
            >
              🎙️
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={`Ask in ${currentLangObj.name}...`}
              className="flex-1 bg-[#120F0D] border border-line rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-accent"
              disabled={busy}
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={busy || !input.trim()}
              className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center text-sm font-bold shadow-md hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
