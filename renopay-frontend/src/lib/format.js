export const fmt = (n) => "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const ago = (ts) => {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  return Math.floor(d / 86400000) + "d ago";
};

export const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

// A lightweight, stable per-browser fingerprint — good enough to let
// SentinAI's "new device" check work without a native app's hardware
// APIs. Not spoof-proof (that needs a real device-attestation SDK),
// but consistent across sessions on the same browser profile.
export function getDeviceFingerprint() {
  let fp = localStorage.getItem("renopay_device_fp");
  if (!fp) {
    const raw = [
      navigator.userAgent, navigator.language, screen.width, screen.height,
      screen.colorDepth, new Date().getTimezoneOffset(), Math.random().toString(36).slice(2),
    ].join("|");
    fp = "dev-" + btoa(raw).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
    localStorage.setItem("renopay_device_fp", fp);
  }
  return fp;
}

export function getDeviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Win/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Device";
  return `${browser} on ${os}`;
}
