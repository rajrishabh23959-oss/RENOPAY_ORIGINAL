import React from "react";
import bhimLogo from "../assets/bhim-logo-transparent.png";
import upiLogo from "../assets/upi-logo-transparent.png";

export { bhimLogo, upiLogo };

/**
 * Official Real BHIM UPI Logo Badge.
 * Uses the authentic NPCI high-res assets provided by the user.
 */
export function BhimUpiLogo({ className = "" }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 border border-line/60 shadow-sm select-none ${className}`}>
      <img src={bhimLogo} alt="BHIM - Bharat Interface for Money" className="h-4.5 w-auto object-contain" style={{ maxHeight: "20px" }} />
      <span className="w-[1px] h-3.5 bg-gray-300" />
      <img src={upiLogo} alt="UPI - Unified Payments Interface" className="h-4 w-auto object-contain" style={{ maxHeight: "17px" }} />
    </div>
  );
}

/**
 * Official Real BHIM Logo standalone.
 */
export function BhimLogo({ className = "h-5 w-auto" }) {
  return (
    <img src={bhimLogo} alt="BHIM" className={`object-contain ${className}`} />
  );
}

/**
 * Official Real UPI Logo standalone.
 */
export function UpiLogo({ className = "h-5 w-auto" }) {
  return (
    <img src={upiLogo} alt="UPI" className={`object-contain ${className}`} />
  );
}

/**
 * Anchored or inline "Powered by UPI" compliance emblem using the authentic UPI logo.
 */
export function PoweredByUpiBadge({ className = "", isBottomAnchor = false }) {
  const baseClasses = isBottomAnchor
    ? "fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
    : "inline-flex items-center";

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-line/80 shadow-lg backdrop-blur-md">
        <span className="text-[9px] uppercase tracking-[1.5px] font-black text-[#444]">POWERED BY</span>
        <img src={upiLogo} alt="UPI - Unified Payments Interface" className="h-3.5 w-auto object-contain" style={{ maxHeight: "16px" }} />
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
