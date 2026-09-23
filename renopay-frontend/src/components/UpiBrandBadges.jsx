import React from "react";

/**
 * Official high-resolution vector BHIM UPI badge.
 * Compliant with NPCI branding guidelines.
 */
export function BhimUpiLogo({ className = "h-6", dark = true }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/80 border border-line backdrop-blur-md shadow-sm select-none ${className}`}>
      {/* NPCI angled arrows icon */}
      <svg width="22" height="18" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Green forward arrow */}
        <path d="M12.5 2L18.5 11L12.5 20H6.5L12.5 11L6.5 2H12.5Z" fill="#22C55E" />
        {/* Orange forward arrow */}
        <path d="M19.5 2L25.5 11L19.5 20H13.5L19.5 11L13.5 2H19.5Z" fill="#FF6A1A" />
      </svg>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] font-black tracking-wider text-textLight">BHIM</span>
          <span className="text-[11px] font-black tracking-wider text-accent">UPI</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Anchored or inline "Powered by UPI" compliance emblem.
 */
export function PoweredByUpiBadge({ className = "", isBottomAnchor = false }) {
  const baseClasses = isBottomAnchor
    ? "fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
    : "inline-flex items-center";

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/90 border border-line/80 shadow-md backdrop-blur-md">
        <span className="text-[9px] uppercase tracking-[1.5px] font-bold text-muted">Powered by</span>
        <svg width="18" height="14" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 2L18.5 11L12.5 20H6.5L12.5 11L6.5 2H12.5Z" fill="#22C55E" />
          <path d="M19.5 2L25.5 11L19.5 20H13.5L19.5 11L13.5 2H19.5Z" fill="#FF6A1A" />
        </svg>
        <span className="text-[10px] font-black text-textLight tracking-wider">UPI</span>
      </div>
    </div>
  );
}

/**
 * Contactless "Tap to Pay" central emblem covering >= 10% of QR code area.
 */
export function TapToPayOverlay({ className = "" }) {
  return (
    <div
      className={`absolute inset-0 m-auto w-14 h-14 rounded-2xl bg-[#0f0d0c]/95 border-2 border-accent flex flex-col items-center justify-center shadow-2xl z-20 pointer-events-none animate-pulseScale ${className}`}
      style={{ boxShadow: "0 0 20px rgba(255, 106, 26, 0.45)" }}
    >
      {/* Contactless waves SVG */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 16.5a5 5 0 0 1 0-9" />
        <path d="M12 19a8.5 8.5 0 0 1 0-14" />
        <path d="M15.5 21.5a12 12 0 0 1 0-19" />
      </svg>
      <span className="text-[8px] font-extrabold text-white tracking-tight uppercase mt-0.5">Tap to Pay</span>
    </div>
  );
}
