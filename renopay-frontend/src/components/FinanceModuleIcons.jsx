import React from "react";
import iconTravel from "../assets/actions/travel.png";
import iconRecharge from "../assets/actions/recharge.png";
import iconInvest from "../assets/actions/invests.png";

export function TravelActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <img
      src={iconTravel}
      alt="Travel"
      className={`${className} object-contain`}
    />
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
    <img
      src={iconRecharge}
      alt="Recharge"
      className={`${className} object-contain`}
    />
  );
}

export function InvestActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <img
      src={iconInvest}
      alt="Invest"
      className={`${className} object-contain`}
    />
  );
}
