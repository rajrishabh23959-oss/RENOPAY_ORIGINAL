import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AccountAPI, AuthAPI } from "../lib/api";
import { getDeviceFingerprint } from "../lib/format";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);   // ProfileOut from /accounts/me
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const hasToken = !!localStorage.getItem("renopay_access_token");
    if (!hasToken) { setProfile(null); setLoading(false); return null; }
    try {
      const p = await AccountAPI.me(getDeviceFingerprint());
      setProfile(p);
      return p;
    } catch {
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const login = useCallback(async (phone, pin) => {
    await AuthAPI.login(phone, pin, getDeviceFingerprint(), navigator.userAgent.slice(0, 60));
    return refreshProfile();
  }, [refreshProfile]);

  const register = useCallback(async (formData) => {
    await AuthAPI.register(formData);
    return refreshProfile();
  }, [refreshProfile]);

  const completeRegistration = useCallback(async (phone, otp) => {
    if (otp) {
      await AuthAPI.verifyOTP(phone, otp, "registration");
    }
    return refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    await AuthAPI.logout();
    setProfile(null);
  }, []);

  const value = { profile, loading, login, logout, refreshProfile, register, completeRegistration };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
