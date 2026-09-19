import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function Nav({ active, onNavigate }) {
  const { profile } = useAuth();
  const { isNightMode } = useTheme();
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  // Close radial menu when active screen changes or on Escape key
  useEffect(() => {
    setIsActionMenuOpen(false);
  }, [active]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsActionMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAction = (type) => {
    setIsActionMenuOpen(false);
    if (type === "scan_camera") {
      onNavigate("scan", { mode: "camera" });
    } else if (type === "scan_upload") {
      onNavigate("scan", { mode: "upload" });
    } else if (type === "upi_id") {
      onNavigate("pay");
    }
  };

  const isPayActive = active === "pay" || active === "scan";

  return (
    <>
      {/* Dimmed backdrop scrim when action menu is open */}
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-sm z-[90] transition-opacity duration-300 ${
          isActionMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsActionMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Floating Pill Navigation Bar Container */}
      <div className="fixed bottom-3 left-0 right-0 z-[100] flex justify-center pointer-events-none px-3 select-none">
        <div className="relative w-full max-w-[420px] pointer-events-auto">

          {/* ── EXPANDING RADIAL ARC ACTION MENU ────────────────────────────── */}
          {isActionMenuOpen && (
            <div className="absolute -top-[145px] left-1/2 -translate-x-1/2 w-[280px] h-[150px] z-[105] pointer-events-none">
              {/* Fanned Radial Connecting Arc Guide (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                <path
                  d="M 52 108 A 92 92 0 0 1 228 108"
                  fill="none"
                  stroke="rgba(255, 106, 26, 0.3)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              </svg>

              {/* Action 1: Gallery / Photo Upload (Left) */}
              <div
                className="absolute pointer-events-auto flex flex-col items-center transition-all duration-300 animate-fadeUp"
                style={{
                  left: "calc(50% - 74px)",
                  top: "38px",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleAction("scan_upload")}
                  className="btn group w-12 h-12 rounded-full bg-gradient-to-br from-[#2A2320] to-[#171311] border-2 border-[#818CF8]/80 text-[#C7D2FE] shadow-[0_4px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_22px_rgba(99,102,241,0.55)] hover:scale-110 flex items-center justify-center transition-all"
                  aria-label="Upload QR Photo"
                  title="Upload QR Photo from Gallery"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-[#A5B4FC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <span className="mt-1 text-[10px] font-bold text-textLight tracking-wide bg-black/60 px-2 py-0.5 rounded-full border border-white/10 shadow">
                  Gallery
                </span>
              </div>

              {/* Action 2: Plus / Live Camera Scan (Center Top) */}
              <div
                className="absolute pointer-events-auto flex flex-col items-center transition-all duration-300 animate-fadeUp"
                style={{
                  left: "50%",
                  top: "4px",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleAction("scan_camera")}
                  className="btn group w-14 h-14 rounded-full bg-gradient-to-b from-[#FF7E36] to-[#E55000] border-2 border-white/50 text-white shadow-[0_6px_24px_rgba(255,106,26,0.6)] hover:shadow-[0_8px_28px_rgba(255,106,26,0.8)] hover:scale-110 flex items-center justify-center transition-all"
                  aria-label="Camera Scan"
                  title="Scan QR with Camera"
                >
                  <div className="relative flex items-center justify-center">
                    <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <line x1="12" y1="10" x2="12" y2="16" />
                      <line x1="9" y1="13" x2="15" y2="13" />
                    </svg>
                  </div>
                </button>
                <span className="mt-1 text-[10px] font-bold text-accent tracking-wide bg-black/60 px-2 py-0.5 rounded-full border border-accent/30 shadow">
                  + Camera
                </span>
              </div>

              {/* Action 3: Person / Enter UPI ID (Right) */}
              <div
                className="absolute pointer-events-auto flex flex-col items-center transition-all duration-300 animate-fadeUp"
                style={{
                  left: "calc(50% + 74px)",
                  top: "38px",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleAction("upi_id")}
                  className="btn group w-12 h-12 rounded-full bg-gradient-to-br from-[#2A2320] to-[#171311] border-2 border-[#34D399]/80 text-[#A7F3D0] shadow-[0_4px_18px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.55)] hover:scale-110 flex items-center justify-center transition-all"
                  aria-label="Enter UPI ID"
                  title="Pay to Contact / UPI ID"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-[#6EE7B7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </button>
                <span className="mt-1 text-[10px] font-bold text-textLight tracking-wide bg-black/60 px-2 py-0.5 rounded-full border border-white/10 shadow">
                  UPI ID
                </span>
              </div>
            </div>
          )}

          {/* ── PILL-SHAPED BAR WITH RAISED NOTCH CUTOUT ────────────────────── */}
          <div className={`relative w-full h-[66px] filter ${
            isNightMode
              ? "drop-shadow-[0_12px_32px_rgba(0,0,0,0.7)]"
              : "drop-shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          }`}>
            {/* Curved SVG Cutout Backdrop */}
            <svg
              viewBox="0 0 400 70"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
            >
              <defs>
                <linearGradient id="pillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isNightMode ? "#1B1715" : "#FFFFFF"} />
                  <stop offset="100%" stopColor={isNightMode ? "#110E0D" : "#F3F4F6"} />
                </linearGradient>
              </defs>
              <path
                d="M 32 0
                   H 152
                   C 168 0, 172 33, 200 33
                   C 228 33, 232 0, 248 0
                   H 368
                   A 32 32 0 0 1 400 32
                   V 38
                   A 32 32 0 0 1 368 70
                   H 32
                   A 32 32 0 0 1 0 38
                   V 32
                   A 32 32 0 0 1 32 0
                   Z"
                fill="url(#pillGrad)"
                stroke={isNightMode ? "#2F2723" : "#E5E7EB"}
                strokeWidth="1.2"
              />
            </svg>

            {/* ── CENTER RAISED ACTION BUTTON (POPS OUT ABOVE NOTCH) ────────── */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-20">
              <button
                type="button"
                onClick={() => setIsActionMenuOpen((prev) => !prev)}
                className={`btn relative w-[54px] h-[54px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
                  isActionMenuOpen
                    ? "bg-gradient-to-b from-[#ff3d60] to-[#b31432] shadow-[0_0_24px_rgba(255,61,96,0.5)] scale-105"
                    : isPayActive
                    ? "bg-gradient-to-b from-[#FF7E36] to-[#E55000] shadow-[0_0_26px_rgba(255,106,26,0.6)] ring-4 ring-[#FF6A1A]/30 scale-105"
                    : "bg-gradient-to-b from-[#FF7E36] to-[#D94700] shadow-[0_6px_20px_rgba(255,106,26,0.45)] hover:scale-105"
                }`}
                aria-label={isActionMenuOpen ? "Close Action Menu" : "Pay Actions"}
                title={isActionMenuOpen ? "Close Menu" : "Pay & Scan Menu"}
              >
                {/* Circular camera-style action button or morphed close cross */}
                {isActionMenuOpen ? (
                  /* Close Cross (X) icon */
                  <svg className="w-6 h-6 text-white transition-transform duration-300 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  /* Camera-style action button */
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-6 h-6 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

            {/* ── CENTER 'PAY' LABEL (POSITIONED PROMINENTLY BELOW CAMERA BUTTON) ── */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[3px] z-10 pointer-events-none flex flex-col items-center">
              <span
                className="text-[9.5px] font-extrabold tracking-wider uppercase transition-colors"
                style={{
                  color: isPayActive ? "#FF6A1A" : (isNightMode ? "#8C827A" : "#64748B"),
                  letterSpacing: "1px",
                }}
              >
                Pay
              </span>
            </div>

            {/* ── LEFT & RIGHT FLAT OUTLINE ICONS ON BAR ────────────────────── */}
            <div className="absolute inset-0 flex items-center justify-between px-5 pt-1">
              {/* Left Wing: Home & Accounting */}
              <div className="flex items-center justify-around w-[38%]">
                {/* Home */}
                <button
                  type="button"
                  onClick={() => onNavigate("home")}
                  className="btn flex flex-col items-center justify-center gap-1 group py-1 min-w-[50px]"
                  style={{ color: active === "home" ? "#FF6A1A" : (isNightMode ? "#7D746C" : "#64748B") }}
                  aria-label="Home"
                >
                  <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">
                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active === "home" ? "2.4" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10.5L12 3l9 7.5" />
                      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
                    </svg>
                  </div>
                  <span className="text-[10px] tracking-wide font-sans" style={{ fontWeight: active === "home" ? 700 : 500 }}>
                    Home
                  </span>
                </button>

                {/* Accounting (Ledger / Pie Chart Icon) */}
                <button
                  type="button"
                  onClick={() => onNavigate("accounting")}
                  className="btn flex flex-col items-center justify-center gap-1 group py-1 min-w-[50px]"
                  style={{ color: active === "accounting" ? "#FF6A1A" : (isNightMode ? "#7D746C" : "#64748B") }}
                  aria-label="Accounting"
                >
                  <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">
                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active === "accounting" ? "2.4" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                      <path d="M22 12A10 10 0 0 0 12 2v10z" />
                    </svg>
                  </div>
                  <span className="text-[10px] tracking-wide font-sans" style={{ fontWeight: active === "accounting" ? 700 : 500 }}>
                    Accounting
                  </span>
                </button>
              </div>

              {/* Center Spacer for Notch Cutout */}
              <div className="w-[20%] pointer-events-none" />

              {/* Right Wing: History & Profile/Account */}
              <div className="flex items-center justify-around w-[38%]">
                {/* History (Clock Icon) */}
                <button
                  type="button"
                  onClick={() => onNavigate("history")}
                  className="btn flex flex-col items-center justify-center gap-1 group py-1 min-w-[50px]"
                  style={{ color: active === "history" ? "#FF6A1A" : (isNightMode ? "#7D746C" : "#64748B") }}
                  aria-label="History"
                >
                  <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">
                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active === "history" ? "2.4" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <span className="text-[10px] tracking-wide font-sans" style={{ fontWeight: active === "history" ? 700 : 500 }}>
                    History
                  </span>
                </button>

                {/* Account / Profile (Person Icon / Avatar) */}
                <button
                  type="button"
                  onClick={() => onNavigate("profile")}
                  className="btn flex flex-col items-center justify-center gap-1 group py-1 min-w-[50px]"
                  style={{ color: active === "profile" ? "#FF6A1A" : (isNightMode ? "#7D746C" : "#64748B") }}
                  aria-label="Profile"
                >
                  <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile"
                        className={`w-5 h-5 object-cover rounded-full border ${
                          active === "profile" ? "border-accent ring-1 ring-accent" : (isNightMode ? "border-white/30" : "border-slate-300")
                        }`}
                      />
                    ) : (
                      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active === "profile" ? "2.4" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[10px] tracking-wide font-sans" style={{ fontWeight: active === "profile" ? 700 : 500 }}>
                    Account
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
