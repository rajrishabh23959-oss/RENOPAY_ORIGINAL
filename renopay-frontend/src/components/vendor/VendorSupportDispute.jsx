import React, { useState } from "react";
import { getTranslation } from "./VendorTranslations";

export function VendorSupportDispute({
  currentLang = "hi",
  merchantId = "m_default_01",
}) {
  const t = getTranslation(currentLang);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordTimer, setRecordTimer] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const [tickets, setTickets] = useState([
    {
      ticket_id: "tkt_1092",
      merchant_id: merchantId,
      type: "PAYMENT_NOT_RECEIVED",
      title: "₹150 payment not credited on counter QR",
      voice_note_url: "voice_note_1092.m4a",
      status: "IN_PROGRESS", // "RAISED" | "IN_PROGRESS" | "RESOLVED"
      time: "Today, 11:20 AM",
    },
    {
      ticket_id: "tkt_1088",
      merchant_id: merchantId,
      type: "SOUNDBOX_DELAY",
      title: "Delayed soundbox announcement issue",
      voice_note_url: "voice_note_1088.m4a",
      status: "RESOLVED",
      time: "Yesterday, 04:15 PM",
    },
  ]);

  // One-tap dispute trigger
  const handleQuickDispute = () => {
    const newTkt = {
      ticket_id: `tkt_${Date.now().toString().slice(-4)}`,
      merchant_id: merchantId,
      type: "PAYMENT_NOT_RECEIVED",
      title: "Paisa nahi mila (1-Tap Fast Dispute)",
      voice_note_url: null,
      status: "RAISED",
      time: "Just now",
    };
    setTickets([newTkt, ...tickets]);
    setToastMsg("शिकायत दर्ज हो गई! RenoPay सपोर्ट टीम जांच कर रही है।");
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Voice message complaint recorder simulation
  const startRecording = () => {
    setIsRecording(true);
    setRecordDuration(1);
    const interval = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
    setRecordTimer(interval);
  };

  const stopRecording = () => {
    if (recordTimer) clearInterval(recordTimer);
    setIsRecording(false);

    const newTkt = {
      ticket_id: `tkt_${Date.now().toString().slice(-4)}`,
      merchant_id: merchantId,
      type: "VOICE_COMPLAINT",
      title: `Voice Note Complaint (${recordDuration}s)`,
      voice_note_url: `rec_${Date.now()}.m4a`,
      status: "RAISED",
      time: "Just now",
    };
    setTickets([newTkt, ...tickets]);
    setRecordDuration(0);
    setToastMsg("वॉयस शिकायत दर्ज हो गई! (Voice note complaint submitted)");
    setTimeout(() => setToastMsg(""), 3500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center animate-fade-in shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* 1-Tap "Paisa nahi mila" Button */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2a1b15] to-[#17110e] border border-amber-500/40 shadow-xl space-y-3">
        <div>
          <h4 className="text-white font-bold text-sm mb-1">{t.support_heading}</h4>
          <p className="text-neutral-400 text-xs">
            No lengthy forms. File complaints in 1-tap or by speaking naturally.
          </p>
        </div>

        <button
          onClick={handleQuickDispute}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <span>{t.paisa_nahi_mila}</span>
        </button>
      </div>

      {/* Voice Complaint Recorder Box */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-neutral-200">
            {t.voice_complaint_btn}
          </h4>
          {isRecording && (
            <span className="text-[11px] font-bold text-red-400 animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Rec: {recordDuration}s
            </span>
          )}
        </div>

        <p className="text-[11px] text-neutral-400">
          {t.voice_recording_hint}
        </p>

        {!isRecording ? (
          <button
            onClick={startRecording}
            className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/40 flex items-center justify-center gap-2 transition-all"
          >
            <span className="text-base">🎙️</span>
            <span>बोलना शुरू करें (Tap to Record)</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg animate-pulse"
          >
            <span>⏹️</span>
            <span>रिकॉर्डिंग समाप्त करें और भेजें (Send Voice Note)</span>
          </button>
        )}
      </div>

      {/* Complaint Status Pipeline Tracker */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <h4 className="text-xs font-bold text-neutral-200">
          Dispute &amp; Complaint History
        </h4>

        <div className="space-y-3">
          {tickets.map((tkt) => {
            const isRaised = tkt.status === "RAISED";
            const isInProgress = tkt.status === "IN_PROGRESS";
            const isResolved = tkt.status === "RESOLVED";

            return (
              <div
                key={tkt.ticket_id}
                className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">{tkt.title}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    #{tkt.ticket_id}
                  </span>
                </div>

                {/* Pipeline Step Dots */}
                <div className="flex items-center justify-between pt-1">
                  {/* Step 1: Raised */}
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-[10px] text-neutral-300">{t.ticket_status_raised}</span>
                  </div>
                  <span className="text-neutral-600 text-xs">➔</span>

                  {/* Step 2: In Progress */}
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isInProgress || isResolved ? "bg-amber-400" : "bg-neutral-600"
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        isInProgress ? "text-amber-300 font-bold" : "text-neutral-400"
                      }`}
                    >
                      {t.ticket_status_progress}
                    </span>
                  </div>
                  <span className="text-neutral-600 text-xs">➔</span>

                  {/* Step 3: Resolved */}
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isResolved ? "bg-emerald-400" : "bg-neutral-600"
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        isResolved ? "text-emerald-400 font-bold" : "text-neutral-400"
                      }`}
                    >
                      {t.ticket_status_resolved}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                  <span>Logged: {tkt.time}</span>
                  {tkt.voice_note_url && (
                    <span className="text-accent flex items-center gap-0.5">
                      <span>🎵</span> <span>Voice Attachment</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
