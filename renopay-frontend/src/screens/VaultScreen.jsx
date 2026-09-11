import { useState, useEffect } from "react";
import { VaultAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt, ago } from "../lib/format";

function VaultCard({ vault, onContribute }) {
  const pct = Math.min(100, (vault.balance / vault.target) * 100);
  const [contributing, setContributing] = useState(false);
  const [amount, setAmount] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState("");

  const startContribute = () => {
    if (!Number(amount) || Number(amount) < 1) { setErr("Enter valid amount"); return; }
    setErr("");
    setShowPin(true);
  };

  const confirmPin = async (pin) => {
    try {
      await onContribute(vault.id, Number(amount), pin);
      setShowPin(false); setContributing(false); setAmount("");
    } catch (e) {
      setErr(e.response?.data?.detail?.message || "Contribution failed — check your PIN");
      setShowPin(false);
    }
  };

  return (
    <Card className="p-[18px] mb-4 border-accent/[.27]">
      {showPin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-6">
          <Card className="p-6 max-w-[320px] w-full border-accent/[.33]">
            <p className="text-center text-muted text-xs mb-4">Enter your UPI PIN to contribute {fmt(Number(amount))}</p>
            <PINPad onComplete={confirmPin} label="6-digit PIN" />
            <button className="btn w-full mt-4 text-muted text-xs" onClick={() => setShowPin(false)}>Cancel</button>
          </Card>
        </div>
      )}
      <div className="flex justify-between items-start mb-3">
        <div><p className="font-extrabold text-base text-textLight">{vault.icon} {vault.name}</p><p className="text-muted text-[11px]">{fmt(vault.balance)} of {fmt(vault.target)}</p></div>
        <Badge color="#FF6A1A" size={10}>{pct.toFixed(0)}%</Badge>
      </div>
      <div className="bg-bg rounded-lg h-2 overflow-hidden mb-3">
        <div className="h-full rounded-lg transition-[width] duration-700 bg-accent" style={{ width: `${pct}%` }} />
      </div>

      {vault.logs?.length > 0 && (
        <div className="mb-3 max-h-32 overflow-y-auto">
          {vault.logs.slice(0, 5).map((l, i) => (
            <div key={l.note || i} className="flex justify-between text-[11px] py-1 border-b border-line last:border-0">
              <span className="text-muted">{l.user_name} · {ago(l.created_at)}</span>
              <span className="font-mono text-teal">+{fmt(l.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {contributing ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-accent text-lg">₹</span>
            <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 text-base font-semibold" />
          </div>
          {err && <p className="text-danger text-[11px] mb-2">{err}</p>}
          <div className="flex gap-2">
            <Btn variant="dark" className="flex-1 py-2.5" onClick={() => { setContributing(false); setErr(""); }}>Cancel</Btn>
            <Btn className="flex-1 py-2.5" onClick={startContribute}>Contribute →</Btn>
          </div>
        </div>
      ) : (
        <Btn onClick={() => setContributing(true)}>+ Contribute</Btn>
      )}
    </Card>
  );
}

export function VaultScreen({ onBack }) {
  const [vaults, setVaults] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "🏖️", target: "", members: "" });
  const [err, setErr] = useState("");

  const load = () => VaultAPI.list().then((res) => setVaults(res.data || res)).catch(console.error);
  useEffect(() => { load(); }, []);

  const createVault = async () => {
    if (!form.name || !Number(form.target)) { setErr("Fill all fields"); return; }
    setErr("");
    const memberPhones = form.members.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await VaultAPI.create(form.name, form.icon, Number(form.target), memberPhones);
      await load();
      setShowNew(false);
      setForm({ name: "", icon: "🏖️", target: "", members: "" });
    } catch {
      setErr("Could not create vault");
    }
  };

  const contribute = (vaultId, amount, pin) => VaultAPI.contribute(vaultId, amount, pin).then(load);

  const ICONS = ["🏖️", "🎓", "🏠", "🚗", "💍", "✈️", "🎉", "🎁"];

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Shared Vaults 🏖️</h2>
      </div>
      <div className="px-[22px]">
        {vaults.length === 0 && !showNew && (
          <p className="text-muted text-center py-10">No shared vaults yet — create one to save toward a goal together.</p>
        )}
        {vaults.map((v) => <VaultCard key={v.id} vault={v} onContribute={contribute} />)}

        {showNew ? (
          <Card className="p-[18px] border-accent/[.27]">
            <p className="font-bold text-sm mb-3.5 text-accent">➕ New Shared Vault</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ICONS.map((ic) => (
                <button key={ic} className="btn p-2 rounded-[10px] text-lg" style={{ background: form.icon === ic ? "#FF6A1A22" : "#151210", border: `1px solid ${form.icon === ic ? "#FF6A1A" : "#2A2320"}` }}
                        onClick={() => setForm((f) => ({ ...f, icon: ic }))}>
                  {ic}
                </button>
              ))}
            </div>
            <input placeholder="Vault name (e.g. Goa Trip Fund)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mb-2.5" />
            <input type="number" placeholder="Target amount (₹)" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} className="mb-2.5" />
            <input placeholder="Member phone numbers, comma-separated (optional)" value={form.members} onChange={(e) => setForm((f) => ({ ...f, members: e.target.value }))} className="mb-2.5" />
            {err && <p className="text-danger text-xs mb-2.5">{err}</p>}
            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Btn>
              <Btn className="flex-1" onClick={createVault}>Create Vault</Btn>
            </div>
          </Card>
        ) : (
          <button className="btn w-full py-[13px] rounded-[14px] bg-transparent border-[1.5px] border-dashed border-accent/[.33] text-accent text-[13px] font-semibold" onClick={() => setShowNew(true)}>
            + New Shared Vault
          </button>
        )}
      </div>
    </div>
  );
}
