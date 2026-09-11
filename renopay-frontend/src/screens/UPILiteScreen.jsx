import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LiteAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt } from "../lib/format";

export function UPILiteScreen({ onBack }) {
  const { profile, refreshProfile } = useAuth();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const startTopUp = () => {
    if (!amount || amount < 10) { setError("Min ₹10"); return; }
    setError("");
    setShowPin(true);
  };

  const confirmPin = async (pin) => {
    setLoading(true); setError("");
    try {
      await LiteAPI.topUp(Number(amount), pin);
      await refreshProfile();
      setAmount("");
      setShowPin(false);
    } catch (e) {
      setError(e.response?.data?.detail?.message || e.response?.data?.detail || "Top-up failed — check your PIN");
      setShowPin(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-10">
      {showPin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-6">
          <Card className="p-6 max-w-[320px] w-full border-teal/[.33]">
            <p className="text-center text-muted text-xs mb-4">Enter your UPI PIN to top up {fmt(Number(amount))}</p>
            <PINPad onComplete={confirmPin} label="6-digit PIN" accent="#22C55E" />
            <button className="btn w-full mt-4 text-muted text-xs" onClick={() => setShowPin(false)}>Cancel</button>
          </Card>
        </div>
      )}
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">UPI Lite Wallet</h2>
        <div className="ml-auto"><Badge color="#22C55E" size={10}>⚡ On-Device</Badge></div>
      </div>
      <div className="px-[22px]">
        <Card className="p-6 text-center mb-5 border-teal/[.2] bg-teal/[.04]">
          <p className="text-muted text-[11px] tracking-wide font-bold uppercase">Available Lite Balance</p>
          <h1 className="text-[48px] font-extrabold text-teal mt-2 font-mono">{fmt(profile?.account?.upi_lite_balance ?? 0)}</h1>
          <p className="text-muted text-[11px] mt-1">Max limit: ₹2,000</p>
        </Card>

        <Card className="p-5 mb-5">
          <p className="text-muted text-[11px] font-bold mb-3 uppercase">Top Up Wallet</p>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-2xl text-accent">₹</span>
            <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                   className="text-2xl font-bold border-none border-b-2 border-accent rounded-none bg-transparent" />
          </div>
          <div className="flex gap-2 flex-wrap mb-5">
            {[100, 200, 500, 1000].map((v) => (
              <button key={v} className="btn px-3 py-1.5 rounded-full text-xs" style={{ background: amount == v ? "#FF6A1A" : "#151210", color: amount == v ? "#fff" : "#5C564F", border: `1px solid ${amount == v ? "#FF6A1A" : "#2A2320"}`, width: "auto" }}
                      onClick={() => setAmount(String(v))}>
                +₹{v}
              </button>
            ))}
          </div>
          {error && <p className="text-danger text-xs mb-3">{error}</p>}
          <Btn onClick={startTopUp} disabled={loading}>{loading ? "Processing..." : "Add to Lite Wallet →"}</Btn>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-sm font-bold mb-2.5 text-textLight">Why use UPI Lite? 💡</h3>
          <ul className="list-none text-muted text-xs leading-relaxed">
            <li>• Pay instantly without any UPI PIN</li>
            <li>• Supports transactions up to ₹500</li>
            <li>• Reduces server load on your bank</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
