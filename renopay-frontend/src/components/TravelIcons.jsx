import React from "react";

export function FlightIcon({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="planeGrad" x1="12" y1="18" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="wingGrad" x1="10" y1="20" x2="40" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <filter id="planeShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#1E3A8A" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#planeShadow)">
        {/* Left Wing */}
        <path d="M28 34L8 42L12 45L31 37Z" fill="url(#wingGrad)" />
        {/* Right Wing */}
        <path d="M38 29L56 16L54 13L35 26Z" fill="url(#wingGrad)" />
        {/* Tail fin */}
        <path d="M12 28L6 20L10 19L18 26Z" fill="#1E40AF" />
        {/* Horizontal stabilizer */}
        <path d="M14 29L10 33L8 32L12 28Z" fill="#3B82F6" />
        {/* Fuselage */}
        <path
          d="M58 24C59 25 58 27 54 29L18 38C13 39 8 36 10 32C11 29 16 28 20 28L52 23C56 22.5 57.5 23 58 24Z"
          fill="url(#planeGrad)"
        />
        {/* Cockpit windows */}
        <path d="M50 24L53 25C54 25.5 54 26.5 53 27L48 26.5C48 25.5 49 24.5 50 24Z" fill="#E0F2FE" />
        {/* Passenger windows */}
        <circle cx="43" cy="27" r="1" fill="#FFFFFF" />
        <circle cx="39" cy="28" r="1" fill="#FFFFFF" />
        <circle cx="35" cy="29" r="1" fill="#FFFFFF" />
        <circle cx="31" cy="30" r="1" fill="#FFFFFF" />
        <circle cx="27" cy="31" r="1" fill="#FFFFFF" />
        <circle cx="23" cy="32" r="1" fill="#FFFFFF" />
        {/* Engine */}
        <rect x="30" y="38" width="8" height="4" rx="2" fill="#1E293B" transform="rotate(-15 30 38)" />
      </g>
    </svg>
  );
}

export function BusIcon({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="busBody" x1="12" y1="16" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="40%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>
        <linearGradient id="busSide" x1="20" y1="18" x2="56" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
        <filter id="busShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#7F1D1D" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#busShadow)">
        {/* Isometric bus body */}
        <polygon points="26,18 48,24 48,46 26,40" fill="url(#busSide)" />
        {/* Front face */}
        <polygon points="14,24 26,18 26,40 14,44" fill="url(#busBody)" />
        {/* Top roof */}
        <polygon points="26,18 48,24 38,15 17,19" fill="#FCA5A5" opacity="0.9" />
        
        {/* Front Windshield */}
        <polygon points="15,26 24,21 24,30 15,33" fill="#BAE6FD" />
        {/* Side Windows */}
        <polygon points="28,23 33,24.5 33,31 28,29" fill="#E0F2FE" />
        <polygon points="34,24.8 39,26.2 39,32.5 34,31.2" fill="#E0F2FE" />
        <polygon points="40,26.5 45,28 45,34 40,32.8" fill="#E0F2FE" />
        
        {/* Headlights */}
        <circle cx="17" cy="38" r="1.5" fill="#FEF08A" />
        <circle cx="23" cy="35" r="1.5" fill="#FEF08A" />
        {/* Grill line */}
        <line x1="18" y1="41" x2="22" y2="39" stroke="#450A0A" strokeWidth="1.5" strokeLinecap="round" />
        
        {/* Front Wheel */}
        <ellipse cx="20" cy="45" rx="3.5" ry="4.5" fill="#1F2937" />
        <ellipse cx="20" cy="45" rx="1.5" ry="2" fill="#9CA3AF" />
        {/* Rear Wheel */}
        <ellipse cx="42" cy="47" rx="3.5" ry="4.5" fill="#1F2937" />
        <ellipse cx="42" cy="47" rx="1.5" ry="2" fill="#9CA3AF" />
      </g>
    </svg>
  );
}

export function TrainIcon({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trainFront" x1="14" y1="20" x2="34" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="60%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="trainSide" x1="30" y1="18" x2="56" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <filter id="trainShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#1E3A8A" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#trainShadow)">
        {/* Side body */}
        <polygon points="30,19 54,26 54,46 30,39" fill="url(#trainSide)" />
        {/* Front streamlined face */}
        <polygon points="14,26 30,19 30,39 14,45" fill="url(#trainFront)" />
        {/* Roof */}
        <polygon points="30,19 54,26 44,17 21,20" fill="#93C5FD" opacity="0.9" />

        {/* Front windshield */}
        <polygon points="16,28 27,23 27,31 16,35" fill="#0F172A" />
        <polygon points="17,29 26,24.5 26,29 17,33" fill="#38BDF8" />

        {/* Aerodynamic Yellow stripe (Vande Bharat / IR style) */}
        <polygon points="14,37 30,31 30,34 14,40" fill="#FACC15" />
        <polygon points="30,31 54,38 54,41 30,34" fill="#EAB308" />

        {/* Side windows */}
        <polygon points="33,25 38,26.5 38,31 33,29.5" fill="#E0F2FE" />
        <polygon points="40,27 45,28.5 45,33 40,31.5" fill="#E0F2FE" />
        <polygon points="47,29 52,30.5 52,35 47,33.5" fill="#E0F2FE" />

        {/* Headlight */}
        <polygon points="19,41 23,39.5 23,41.5 19,43" fill="#FEF08A" />

        {/* Wheels / Undercarriage */}
        <polygon points="15,45 54,46 52,49 17,48" fill="#334155" />
        <ellipse cx="23" cy="48" rx="3.5" ry="3" fill="#0F172A" />
        <ellipse cx="44" cy="49" rx="3.5" ry="3" fill="#0F172A" />
      </g>
    </svg>
  );
}

export function HotelIcon({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hotelWall" x1="16" y1="20" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <filter id="hotelShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#9A3412" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#hotelShadow)">
        {/* Main Building Front */}
        <rect x="18" y="20" width="28" height="28" rx="2" fill="url(#hotelWall)" />
        {/* Roof Overhang */}
        <polygon points="15,20 32,13 49,20" fill="#9A3412" />
        <polygon points="17,20 32,15 47,20" fill="#C2410C" />

        {/* Windows Row 1 */}
        <rect x="22" y="24" width="5" height="5" rx="1" fill="#FEF08A" stroke="#7C2D12" strokeWidth="0.8" />
        <rect x="30" y="24" width="5" height="5" rx="1" fill="#FEF08A" stroke="#7C2D12" strokeWidth="0.8" />
        <rect x="38" y="24" width="5" height="5" rx="1" fill="#FEF08A" stroke="#7C2D12" strokeWidth="0.8" />

        {/* Windows Row 2 */}
        <rect x="22" y="32" width="5" height="5" rx="1" fill="#FEF08A" stroke="#7C2D12" strokeWidth="0.8" />
        <rect x="38" y="32" width="5" height="5" rx="1" fill="#FEF08A" stroke="#7C2D12" strokeWidth="0.8" />

        {/* Red Awning Canopy over entrance */}
        <path d="M28 35L37 35L38 39L27 39Z" fill="#DC2626" />
        <path d="M27 39C27 40 28.5 40.5 30 40C31.5 40.5 33.5 40.5 35 40C36.5 40.5 38 40 38 39" fill="#EF4444" />

        {/* Main Entrance Door */}
        <rect x="29" y="39" width="7" height="9" fill="#7C2D12" />
        <rect x="30" y="40" width="2.5" height="7" fill="#FDE047" opacity="0.8" />
        <rect x="33.5" y="40" width="2.5" height="7" fill="#FDE047" opacity="0.8" />

        {/* Base / Porch */}
        <rect x="15" y="48" width="34" height="2" fill="#78716C" />
      </g>
    </svg>
  );
}
