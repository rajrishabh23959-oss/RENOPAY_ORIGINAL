import { useState, useEffect } from "react";
import { MandateAPI } from "../lib/api";
import { Btn, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt } from "../lib/format";

export function SubscriptionsScreen({ onBack }) {
  const [mandates, setMandates] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "📦", merchant_vpa: "", amount: "", max_limit: "", frequency: "monthly", category: "Bills" });
  const [err, setErr] = useState("");

  const load = () => MandateAPI.list().then((res) => setMandates(res.data || res)).catch(console.error);
  useEffect(() => { load(); }, []);

  const total = mandates.filter((m) => m.status === "active").reduce((s, m) => s + m.amount, 0);
  const toggle = async (id) => { await MandateAPI.toggle(id); await load(); };

  const startAddMandate = () => {
    if (!form.name || !form.merchant_vpa || !form.amount) { setErr("Fill name, VPA, and amount"); return; }
    setErr("");
    setShowPin(true);
  };

  const confirmPin = async (pin) => {
    try {
      await MandateAPI.create({
        ...form, amount: Number(form.amount), max_limit: Number(form.max_limit || form.amount) * 2, pin,
      });
      await load();
      setShowAdd(false); setShowPin(false);
      setForm({ name: "", icon: "📦", merchant_vpa: "", amount: "", max_limit: "", frequency: "monthly", category: "Bills" });
    } catch (e) {
      setErr(e.response?.data?.detail?.message || "Could not create mandate — check your PIN");
      setShowPin(false);
    }
  };

  const ICONS = ["📺", "🎵", "☁️", "📰", "🎮", "💪", "📦", "🎬"];

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {showPin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-6">
          <Card className="p-6 max-w-[320px] w-full border-accent/[.33]">
            <p className="text-center text-muted text-xs mb-4">Enter your UPI PIN to authorize this AutoPay mandate</p>
            <PINPad onComplete={confirmPin} label="6-digit PIN" />
            <button className="btn w-full mt-4 text-muted text-xs" onClick={() => setShowPin(false)}>Cancel</button>
          </Card>
        </div>
      )}
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Subscriptions 📋</h2>
      </div>
      <div className="px-[22px]">
        <Card className="p-[18px] mb-4 border-accent/[.2] text-center">
          <p className="text-muted text-[11px] tracking-wide font-semibold uppercase">Monthly Auto-Pay</p>
          <p className="font-mono text-[34px] font-bold text-accent mt-1">{fmt(total)}</p>
          <p className="text-muted text-[11px] mt-1">{mandates.filter((m) => m.status === "active").length} active</p>
        </Card>

        {mandates.map((m) => (
          <Card key={m.id} className="p-4 mb-2.5" style={{ opacity: m.status === "active" ? 1 : 0.6 }}>
            <div className="flex items-center gap-3">
              <div className="w-[46px] h-[46px] rounded-[14px] bg-accent/20 flex items-center justify-center text-xl">{m.icon}</div>
              <div className="flex-1">
                <p className="font-bold text-sm text-textLight">{m.name}</p>
                <p className="text-muted text-[11px]">{m.frequency} · {m.merchant_vpa}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-[15px] text-textLight">{fmt(m.amount)}</p>
                <button className="btn mt-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                        style={{ background: m.status === "active" ? "#ff3d6022" : "#22C55E22", color: m.status === "active" ? "#ff3d60" : "#22C55E" }}
                        onClick={() => toggle(m.id)}>
                  {m.status === "active" ? "Pause" : "Resume"}
                </button>
              </div>
            </div>
          </Card>
        ))}

        {showAdd ? (
          <Card className="p-[18px] mt-2.5 border-accent/[.27]">
            <p className="font-bold text-sm mb-3.5 text-accent">➕ New Subscription</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ICONS.map((ic) => (
                <button key={ic} className="btn p-2 rounded-[10px] text-lg" style={{ background: form.icon === ic ? "#FF6A1A22" : "#151210", border: `1px solid ${form.icon === ic ? "#FF6A1A" : "#2A2320"}` }}
                        onClick={() => setForm((f) => ({ ...f, icon: ic }))}>
                  {ic}
                </button>
              ))}
            </div>
            <input placeholder="Service name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mb-2.5" />
            <input placeholder="Merchant UPI ID" value={form.merchant_vpa} onChange={(e) => setForm((f) => ({ ...f, merchant_vpa: e.target.value }))} className="mb-2.5" />
            <input type="number" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mb-2.5" />
            <div className="flex gap-2 mb-3.5">
              {["monthly", "quarterly", "yearly"].map((c) => (
                <button key={c} className="btn flex-1 py-2 rounded-[10px] text-[11px] font-semibold capitalize"
                        style={{ background: form.frequency === c ? "#FF6A1A" : "#151210", color: form.frequency === c ? "#fff" : "#5C564F", border: `1px solid ${form.frequency === c ? "#FF6A1A" : "#2A2320"}` }}
                        onClick={() => setForm((f) => ({ ...f, frequency: c }))}>
                  {c}
                </button>
              ))}
            </div>
            {err && <p className="text-danger text-xs mb-2.5">{err}</p>}
            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={startAddMandate}>Add</Btn>
            </div>
          </Card>
        ) : (
          <button className="btn w-full py-[13px] rounded-[14px] bg-transparent border-[1.5px] border-dashed border-accent/[.33] text-accent text-[13px] font-semibold mt-1" onClick={() => setShowAdd(true)}>
            + Add Subscription
          </button>
        )}
      </div>
    </div>
  );
}
