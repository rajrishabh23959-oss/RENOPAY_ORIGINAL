import { useState } from "react";
import { AuthAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Btn, Card } from "../components/ui";

const sectionCls = "text-accent text-[12px] font-bold tracking-wider mb-2 mt-4 border-b border-line pb-1 uppercase";

export function LoginScreen({ onDone, initialMode = "login" }) {
  const { login, register, refreshProfile } = useAuth();
  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Login form state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");

  // Registration form state
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    pin: "",
    pan: "",
    aadhaar: "",
  });

  const handleLoginSubmit = async (e) => {
    e?.preventDefault?.();
    setErr("");
    const cleanPhone = loginPhone.replace(/\D/g, "");
    if (!cleanPhone) {
      setErr("Please enter your registered phone number");
      return;
    }
    if (cleanPhone.length < 10) {
      setErr("Please enter a valid 10-digit phone number");
      return;
    }
    if (loginPin.trim() && loginPin.trim().length !== 6) {
      setErr("PIN must be exactly 6 digits (or leave empty if not set)");
      return;
    }
    setLoading(true);
    try {
      await login(cleanPhone, loginPin.trim() || null);
      await refreshProfile?.();
      onDone?.();
    } catch (e2) {
      const detail = e2.response?.data?.detail;
      let msg = "";
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d) => d.msg || d.message).join(", ");
      } else if (detail?.message) {
        msg = detail.message;
      } else if (e2.response?.status === 404) {
        msg = "No account found with this number. Please click Register to create your account!";
      } else if (e2.response?.status === 401) {
        msg = "Incorrect PIN. Please try again.";
      } else if (!e2.response) {
        msg = "Unable to connect to RenoPay server. Please check your internet connection.";
      } else {
        msg = "Invalid phone number or PIN";
      }
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegSubmit = async (e) => {
    e?.preventDefault?.();
    setErr("");
    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (!formData.fullName.trim() || !cleanPhone || !formData.email.trim()) {
      setErr("Please fill in Full Name, Phone Number, and Email");
      return;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setErr("Phone number must contain 10 to 15 digits");
      return;
    }
    if (formData.pin && formData.pin.length !== 6) {
      setErr("PIN must be exactly 6 digits");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        full_name: formData.fullName.trim(),
        phone_number: cleanPhone,
        email: formData.email.trim() || null,
        pan_number: formData.pan.trim() || null,
        aadhaar_number: formData.aadhaar.trim() || null,
      };

      if (register) {
        await register(payload);
      } else {
        await AuthAPI.register(payload);
      }

      // If user entered a PIN during registration, save it
      if (formData.pin && formData.pin.length === 6) {
        try {
          await AuthAPI.setPin(formData.pin, formData.pin);
        } catch {
          // Non-critical PIN setup error, user can set later
        }
      }

      await refreshProfile?.();
      onDone?.();
    } catch (e2) {
      const detail = e2.response?.data?.detail;
      let msg = "Registration failed. Please check details.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d) => d.msg || d.message).join(", ");
      } else if (detail?.message) {
        msg = detail.message;
      } else if (!e2.response) {
        msg = "Unable to connect to RenoPay server. Please check your internet connection.";
      }
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (phone, pin = "123456") => {
    setLoginPhone(phone);
    setLoginPin(pin);
    setErr("");
  };

  return (
    <div className="min-h-screen bg-bg px-5 pt-[44px] pb-10 relative flex flex-col items-center">
      {/* Ambient background glow */}
      <div className="glow-hero w-full max-w-[430px] flex flex-col items-center">
        {/* Brand Header */}
        <div className="relative z-10 flex flex-col items-center mb-5 text-center">
          <div className="w-[58px] h-[58px] rounded-full overflow-hidden shadow-accentGlow mb-2.5 bg-accent/20 border-2 border-accent/40 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="RenoPay Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-[22px] font-black tracking-tight text-textLight">
            Reno<span className="text-accent">Pay</span>
          </h2>
          <p className="text-[12px] text-muted font-medium">
            Mindful Banking & Smart Denomination Wallet
          </p>
        </div>

        {/* Top Segmented Tab Toggle: Log In | Register */}
        <div className="w-full max-w-[390px] bg-card border border-line p-1 rounded-2xl flex gap-1 mb-5 shadow-inner">
          <button
            type="button"
            className={`flex-1 py-2.5 text-center text-[13.5px] font-bold rounded-xl transition-all duration-200 cursor-pointer ${
              mode === "login"
                ? "bg-gradient-to-r from-accent to-[#D9480F] text-white shadow-md"
                : "text-muted hover:text-textLight hover:bg-surf"
            }`}
            onClick={() => {
              setMode("login");
              setErr("");
            }}
          >
            🔑 Log In
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 text-center text-[13.5px] font-bold rounded-xl transition-all duration-200 cursor-pointer ${
              mode === "register"
                ? "bg-gradient-to-r from-accent to-[#D9480F] text-white shadow-md"
                : "text-muted hover:text-textLight hover:bg-surf"
            }`}
            onClick={() => {
              setMode("register");
              setErr("");
            }}
          >
            📝 Register
          </button>
        </div>

        {/* Main Card Container */}
        <div className="w-full max-w-[390px]">
          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="animate-fadeUp bg-card border border-line rounded-[24px] p-5 shadow-lg">
              <div className="mb-4">
                <h1 className="text-[20px] font-black text-textLight">Welcome back</h1>
                <p className="text-muted text-[12.5px] mt-0.5">
                  Enter your mobile number and PIN to continue
                </p>
              </div>

              {/* Phone Field */}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  required
                  type="tel"
                  placeholder="Phone Number"
                  className="mb-0 text-sm font-medium"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                />
              </div>

              {/* PIN Field */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider">
                    6-digit PIN (optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin((s) => !s)}
                    className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                  >
                    {showPin ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    maxLength={6}
                    placeholder="6-digit PIN (optional)"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ""))}
                    className="tracking-[6px] text-base text-center mb-0"
                  />
                </div>
              </div>

              {/* Demo Fast-Fill helper buttons */}
              <div className="mb-4 p-2.5 rounded-xl bg-surf border border-line">
                <p className="text-[10.5px] text-muted uppercase font-bold tracking-wider mb-2">
                  ⚡ Quick Demo Login:
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemo("9876543210", "123456")}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-card hover:bg-surf border border-line text-[11.5px] text-textLight font-medium transition cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span>👤</span>
                    <div>
                      <div className="font-bold text-accent leading-none">Rishab</div>
                      <div className="text-[9.5px] text-muted">9876543210</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo("9876543211", "123456")}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-card hover:bg-surf border border-line text-[11.5px] text-textLight font-medium transition cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span>👤</span>
                    <div>
                      <div className="font-bold text-accent leading-none">Alex</div>
                      <div className="text-[9.5px] text-muted">9876543211</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {err && (
                <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-[12px] font-medium mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{err}</span>
                </div>
              )}

              {/* Submit Button */}
              <Btn type="submit" disabled={loading} className="w-full py-3.5 font-bold text-sm">
                {loading ? "Logging in..." : "Log In →"}
              </Btn>

              <div className="mt-3.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErr("");
                  }}
                  className="text-xs text-muted hover:text-accent font-semibold transition cursor-pointer"
                >
                  New to RenoPay? <span className="text-accent underline">Create an account</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegSubmit} className="animate-fadeUp bg-card border border-line rounded-[24px] p-5 shadow-lg">
              <div className="mb-2">
                <h1 className="text-[20px] font-black text-textLight">Welcome to RenoPay</h1>
                <p className="text-muted text-[12.5px] mt-0.5">
                  Create your account with your details below
                </p>
              </div>

              {/* Section 1 */}
              <h2 className={sectionCls}>1. Personal Information</h2>
              <div className="flex flex-col gap-2.5 mb-2">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Full Name <span className="text-accent">*</span>
                  </label>
                  <input
                    required
                    placeholder="Full Name"
                    className="mb-0 text-sm"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Email Address <span className="text-accent">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    className="mb-0 text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Phone Number <span className="text-accent">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="Phone Number"
                    className="mb-0 text-sm"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Section 2 */}
              <h2 className={sectionCls}>2. Identity & Security</h2>
              <div className="flex flex-col gap-2.5 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Set 6-Digit App PIN (Optional)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="6-digit PIN (optional)"
                    className="mb-0 text-sm tracking-[4px]"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    PAN Number (Optional Demo)
                  </label>
                  <input
                    placeholder="PAN Number (ABCDE1234F)"
                    className="mb-0 text-sm uppercase"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Aadhaar Number (Optional Demo)
                  </label>
                  <input
                    placeholder="Aadhaar Number"
                    className="mb-0 text-sm"
                    value={formData.aadhaar}
                    onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                  />
                </div>
              </div>

              {/* Error Display */}
              {err && (
                <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-[12px] font-medium mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{err}</span>
                </div>
              )}

              {/* Submit Button */}
              <Btn type="submit" disabled={loading} className="w-full py-3.5 font-bold text-sm">
                {loading ? "Creating Account..." : "Continue →"}
              </Btn>

              <div className="mt-3.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErr("");
                  }}
                  className="text-xs text-muted hover:text-accent font-semibold transition cursor-pointer"
                >
                  Already have an account? Log in →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
