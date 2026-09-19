function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--color-bg"),
        surf: withOpacity("--color-surf"),
        card: withOpacity("--color-card"),
        line: withOpacity("--color-line"),
        accent: "#FF6A1A",
        teal: "#22C55E",
        gold: "#FF6A1A",
        danger: "#ff3d60",
        warn: "#FFA000",
        text: withOpacity("--color-text"),
        textLight: withOpacity("--color-textLight"),
        muted: withOpacity("--color-muted"),
        success: "#22C55E",
      },
      fontFamily: {
        sans: ["Outfit", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
      boxShadow: {
        accentGlow: "0 6px 22px rgba(255,106,26,0.28)",
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseScale: { "0%,100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.06)" } },
        heartbeat: {
          "0%,100%": { transform: "scale(1)" }, "14%": { transform: "scale(1.12)" },
          "28%": { transform: "scale(1)" }, "42%": { transform: "scale(1.08)" }, "70%": { transform: "scale(1)" },
        },
        voiceWave: { "0%,100%": { height: "4px" }, "50%": { height: "16px" } },
        goldShimmer: { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "100% 50%" } },
        glowPulse: { "0%,100%": { opacity: 0.18 }, "50%": { opacity: 0.32 } },
      },
      animation: {
        fadeUp: "fadeUp .38s ease both",
        fadeIn: "fadeIn .3s ease both",
        pulseScale: "pulseScale 2s ease infinite",
        heartbeat: "heartbeat .6s ease",
        voiceWave: "voiceWave .8s ease-in-out infinite",
        goldShimmer: "goldShimmer 2s linear infinite",
        glowPulse: "glowPulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
