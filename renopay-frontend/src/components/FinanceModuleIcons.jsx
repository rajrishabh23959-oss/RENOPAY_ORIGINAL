import React from "react";

export function TravelActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="travelGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="50%" stopColor="#EA580C" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
        <filter id="travelGlow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#EA580C" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#251C18" stroke="#EA580C" strokeOpacity="0.4" strokeWidth="1.5" />
      <g filter="url(#travelGlow)">
        {/* Train front */}
        <rect x="15" y="16" width="22" height="28" rx="6" fill="url(#travelGrad)" />
        <rect x="18" y="20" width="16" height="10" rx="3" fill="#FFE8D6" />
        <circle cx="21" cy="37" r="2" fill="#FFFFFF" />
        <circle cx="31" cy="37" r="2" fill="#FFFFFF" />
        <rect x="19" y="44" width="6" height="3" rx="1" fill="#7C2D12" />
        <rect x="27" y="44" width="6" height="3" rx="1" fill="#7C2D12" />
        {/* Flight above */}
        <path d="M37 20L48 15L47 13L35 18L30 14L28 15L32 19L30 22L40 21L37 20Z" fill="#FDBA74" />
      </g>
    </svg>
  );
}

export function LoanActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loanGrad" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <filter id="loanGlow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#059669" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#15241C" stroke="#10B981" strokeOpacity="0.4" strokeWidth="1.5" />
      <g filter="url(#loanGlow)">
        {/* Bank roof */}
        <path d="M32 15L16 23H48L32 15Z" fill="url(#loanGrad)" />
        {/* Pillars */}
        <rect x="19" y="25" width="4" height="15" rx="1.5" fill="#A7F3D0" />
        <rect x="27" y="25" width="4" height="15" rx="1.5" fill="#A7F3D0" />
        <rect x="35" y="25" width="4" height="15" rx="1.5" fill="#A7F3D0" />
        <rect x="43" y="25" width="4" height="15" rx="1.5" fill="#A7F3D0" />
        {/* Base */}
        <rect x="14" y="41" width="36" height="4" rx="2" fill="url(#loanGrad)" />
        {/* Rupee coin Badge */}
        <circle cx="43" cy="22" r="7" fill="#F59E0B" />
        <path d="M41 19H45M41 21H45M41 19C43 19 44 20 44 21.5C44 22.5 43 23 41.5 23L44.5 26M42.5 21V26" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function RechargeActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rechGrad" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <filter id="rechGlow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0284C7" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#14212D" stroke="#0284C7" strokeOpacity="0.4" strokeWidth="1.5" />
      <g filter="url(#rechGlow)">
        {/* Phone body */}
        <rect x="21" y="14" width="22" height="36" rx="5" fill="url(#rechGrad)" />
        <rect x="24" y="18" width="16" height="26" rx="2" fill="#0C1520" />
        {/* Lightning bolt on screen */}
        <path d="M33 22L27 30H32L30 38L37 29H32L33 22Z" fill="#FACC15" />
        {/* Home bar */}
        <rect x="29" y="46" width="6" height="1.5" rx="0.75" fill="#BAE6FD" />
      </g>
    </svg>
  );
}

export function InvestActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="invGrad" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="50%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#7E22CE" />
        </linearGradient>
        <filter id="invGlow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#9333EA" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#22182B" stroke="#9333EA" strokeOpacity="0.4" strokeWidth="1.5" />
      <g filter="url(#invGlow)">
        {/* Growth bars */}
        <rect x="17" y="36" width="5" height="12" rx="2" fill="#E9D5FF" />
        <rect x="25" y="30" width="5" height="18" rx="2" fill="#C084FC" />
        <rect x="33" y="24" width="5" height="24" rx="2" fill="url(#invGrad)" />
        <rect x="41" y="18" width="5" height="30" rx="2" fill="#F43F5E" />
        {/* Growth Arrow line */}
        <path d="M16 35L26 28L34 22L44 14M44 14H38M44 14V20" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
