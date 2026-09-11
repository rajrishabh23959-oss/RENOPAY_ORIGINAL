import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AccountAPI, AuthAPI } from "../lib/api";
import { getDeviceFingerprint, getDeviceLabel, fmt } from "../lib/format";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";

export function ProfileScreen({ onBack, onLoggedOut }) {
  const { profile, logout, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetErr, setBudgetErr] = useState("");
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinErr, setPinErr] = useState("");
  const [newPin, setNewPin] = useState("");

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accent"></div>
      </div>
    );
  }
  const acc = profile.account;
  const kycCol = profile.kyc_status === "verified" ? "#22C55E" : "#FFA000";

  const trustDevice = async () => {
    setBusy(true);
    await AccountAPI.trustDevice(getDeviceFingerprint(), getDeviceLabel());
    await refreshProfile();
    setBusy(false);
  };

  const toggleRoundUp = async () => {
    setBusy(true);
    await AccountAPI.toggleRoundUp(!acc.round_up_enabled);
    await refreshProfile();
    setBusy(false);
  };

  const saveBudget = async () => {
    if (!Number(budgetInput) || Number(budgetInput) <= 0) { setBudgetErr("Enter a valid amount"); return; }
    setBusy(true); setBudgetErr("");
    try {
      await AccountAPI.updateBudget(Number(budgetInput));
      await refreshProfile();
      setEditingBudget(false);
    } catch {
      setBudgetErr("Could not update budget");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onLoggedOut?.();
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Profile</h2>
      </div>
      <div className="px-[22px]">
        <Card className="p-7 mb-3.5 text-center border-accent/[.2] relative glow-hero">
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-full mx-auto mb-3.5 bg-gradient-to-br from-accent to-[#B8420E] flex items-center justify-center text-3xl font-extrabold border-2 border-accent/[.33]">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : profile.full_name[0]}
            </div>
            <h3 className="text-[22px] font-extrabold text-textLight">{profile.full_name}</h3>
            <p className="text-accent mt-1 text-sm">{acc.vpa}</p>
            <div className="mt-2.5 flex gap-2 justify-center flex-wrap">
              <Badge color="#22C55E">🛡 SentinAI Active</Badge>
              <Badge color={kycCol}>{profile.kyc_status === "verified" ? "✅" : "⏳"} KYC {profile.kyc_status}</Badge>
              <Badge color={profile.is_trusted_device ? "#22C55E" : "#ff3d60"} size={9}>
                {profile.is_trusted_device ? "🔒 Trusted Device" : "⚠ New Device"}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4 mb-3.5" style={{ border: `1px solid ${acc.round_up_enabled ? "#FF6A1A55" : "#2A2320"}` }}>
          <div className="flex justify-between items-center">
            <div><p className="font-bold text-sm text-textLight">🪙 Round-Up to Digital Gold</p><p className="text-muted text-[11px] mt-0.5">Vault: {fmt(acc.digital_gold)}</p></div>
            <button className="btn w-[52px] h-7 rounded-full relative" disabled={busy} style={{ background: acc.round_up_enabled ? "#FF6A1A" : "#5C564F44" }} onClick={toggleRoundUp}>
              <div className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all" style={{ left: acc.round_up_enabled ? 26 : 3 }} />
            </button>
          </div>
        </Card>

        <Card className="p-4 mb-3.5 border-accent/[.2]">
          {editingBudget ? (
            <div>
              <p className="font-bold text-sm mb-2.5 text-textLight">📊 Monthly Budget</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg text-accent">₹</span>
                <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="text-base font-semibold" autoFocus />
              </div>
              {budgetErr && <p className="text-danger text-[11px] mb-2">{budgetErr}</p>}
              <div className="flex gap-2">
                <Btn variant="dark" className="flex-1 py-2" onClick={() => setEditingBudget(false)}>Cancel</Btn>
                <Btn className="flex-1 py-2" disabled={busy} onClick={saveBudget}>Save</Btn>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <div><p className="font-bold text-sm text-textLight">📊 Monthly Budget</p><p className="text-muted text-[11px] mt-0.5">Used for spending predictions & tracker</p></div>
              <div className="text-right flex items-center gap-2.5">
                <p className="font-mono font-bold text-sm text-accent">{fmt(acc.monthly_budget)}</p>
                <button className="btn text-accent text-xs font-semibold" onClick={() => { setBudgetInput(String(acc.monthly_budget)); setEditingBudget(true); }}>Edit</button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 mb-3.5 border-accent/[.2]">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="font-bold text-sm text-textLight">🔐 UPI PIN</p>
              <p className="text-muted text-[11px] mt-0.5">
                {profile.has_upi_pin ? "UPI PIN is set" : "You haven't set a UPI PIN yet — set one to start making payments"}
              </p>
            </div>
            <button className="btn text-accent text-xs font-semibold" onClick={() => { setShowPinPad(true); setPinErr(""); setNewPin(""); }}>
              {profile.has_upi_pin ? "Change PIN" : "Set UPI PIN"}
            </button>
          </div>
          {showPinPad && (
            <div className="mt-4 pt-4 border-t border-line">
              <PINPad 
                label={newPin ? "Confirm new UPI PIN" : "Enter new 6-digit UPI PIN"}
                onComplete={async (enteredPin) => {
                  if (!newPin) {
                    setNewPin(enteredPin);
                    setPinErr("");
                  } else {
                    if (enteredPin !== newPin) {
                      setPinErr("PINs do not match. Try again.");
                      setNewPin("");
                    } else {
                      setBusy(true); setPinErr("");
                      try {
                        await AuthAPI.setPin(newPin, enteredPin);
                        await refreshProfile();
                        setShowPinPad(false);
                        setNewPin("");
                      } catch (e) {
                        setPinErr(e.response?.data?.detail?.message || e.response?.data?.detail || "Could not set PIN");
                        setNewPin("");
                      } finally {
                        setBusy(false);
                      }
                    }
                  }
                }}
              />
              {pinErr && <p className="text-danger text-xs text-center mt-2">{pinErr}</p>}
              <Btn variant="dark" className="mt-3 w-full" onClick={() => { setShowPinPad(false); setNewPin(""); }}>Cancel</Btn>
            </div>
          )}
        </Card>

        <Card className="p-4 mb-3.5" style={{ border: `1px solid ${kycCol}33` }}>
          <p className="text-muted text-[10px] tracking-wide font-semibold mb-3 uppercase">🪪 KYC & Virtual Account</p>
          {[
            { l: "Virtual A/c", v: acc.virtual_acc_no },
            { l: "IFSC", v: acc.ifsc_code },
            { l: "Linked Bank", v: acc.linked_bank_name },
            { l: "Device", v: profile.is_trusted_device ? "🔒 Trusted" : "⚠ New — Privacy check on next txn" },
          ].map((r) => (
            <div key={r.l} className="flex justify-between py-1.5 border-b border-line last:border-0">
              <span className="text-muted text-xs">{r.l}</span><span className="text-xs font-semibold text-textLight">{r.v}</span>
            </div>
          ))}
        </Card>

        {[
          { l: "Phone", v: profile.phone_number },
          { l: "Balance", v: fmt(acc.balance) },
          { l: "UPI Lite Balance", v: fmt(acc.upi_lite_balance) },
          { l: "Digital Gold", v: fmt(acc.digital_gold) },
        ].map((r) => (
          <Card key={r.l} className="p-4 mb-2.5 flex justify-between items-center">
            <p className="text-muted text-[13px]">{r.l}</p><p className="text-[13px] font-semibold text-textLight">{r.v}</p>
          </Card>
        ))}

        {!profile.is_trusted_device && (
          <div className="mb-2.5"><Btn variant="teal" onClick={trustDevice} disabled={busy}>Trust This Device</Btn></div>
        )}
        <div className="mt-2.5"><Btn variant="danger" onClick={handleLogout}>Logout</Btn></div>
      </div>
    </div>
  );
}
