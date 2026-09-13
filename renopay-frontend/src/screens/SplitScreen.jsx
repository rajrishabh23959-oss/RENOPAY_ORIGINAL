import { useState } from "react";
import { RequestAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Btn, Badge, Card } from "../components/ui";
import { fmt } from "../lib/format";

export function SplitScreen({ onBack }) {
  const { profile } = useAuth();
  const [totalBill, setTotalBill] = useState("");
  const [people, setPeople] = useState([
    { name: profile?.full_name || "Myself", vpa: profile?.account?.vpa || "" },
    { name: "", vpa: "" },
  ]);
  const [desc, setDesc] = useState("");
  const [sentResult, setSentResult] = useState(null);
  const [err, setErr] = useState("");

  const namedCount = people.filter((p) => p.name && p.vpa).length || 1;
  const split = totalBill ? Math.ceil(Number(totalBill) / namedCount) : 0;

  const addPerson = () => setPeople((p) => [...p, { name: "", vpa: "" }]);
  const addMyself = () => {
    if (!profile?.account?.vpa) return;
    if (people.some((p) => p.vpa === profile.account.vpa)) return;
    setPeople((p) => [{ name: profile.full_name || "Myself", vpa: profile.account.vpa }, ...p]);
  };
  const removePerson = (i) => setPeople((p) => p.filter((_, idx) => idx !== i));
  const updatePerson = (i, k, v) => setPeople((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const sendRequests = async () => {
    const payers = people.filter((p) => p.name && p.vpa.trim()).map(p => ({ ...p, vpa: p.vpa.trim() }));
    if (payers.length === 0) { setErr("Add at least one person with a UPI ID"); return; }
    setErr("");
    try {
      const results = await RequestAPI.createSplit(Number(totalBill), desc, payers);
      setSentResult(results);
    } catch {
      setErr("Could not create split requests");
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Bill Splitter 🍕</h2>
      </div>
      <div className="px-[22px]">
        {!sentResult ? (
          <div className="animate-fadeUp">
            <Card className="p-5 mb-4 border-accent/[.2]">
              <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Total Bill</p>
              <div className="flex items-center gap-2 mb-3.5">
                <span className="text-[28px] text-accent">₹</span>
                <input type="number" placeholder="0" value={totalBill} onChange={(e) => setTotalBill(e.target.value)}
                       className="text-[32px] font-bold border-none border-b-2 border-accent rounded-none pl-0 bg-transparent" />
              </div>
              <input placeholder="What's this for? (e.g. Dinner)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </Card>

            {split > 0 && (
              <Card className="p-4 mb-4 text-center border-teal/[.27] bg-teal/[.03]">
                <p className="text-muted text-xs">Each person pays</p>
                <p className="font-mono text-[36px] font-bold text-teal">{fmt(split)}</p>
                <p className="text-muted text-[11px]">{namedCount} people · equal split</p>
              </Card>
            )}

            <p className="text-muted text-[11px] tracking-wide font-semibold mb-2.5 uppercase">People</p>
            {people.map((p, i) => (
              <Card key={p.name || i} className="p-3.5 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <input placeholder={`Name ${i + 1}`} value={p.name} onChange={(e) => updatePerson(i, "name", e.target.value)} className="flex-1 py-2.5 px-3 text-[13px]" />
                  {i > 1 && <button className="btn px-2.5 py-2.5 rounded-[10px] bg-surf border border-line text-danger" onClick={() => removePerson(i)}>✕</button>}
                </div>
                <input placeholder="their@upi" value={p.vpa} onChange={(e) => updatePerson(i, "vpa", e.target.value)} className="text-xs py-2 px-3" />
              </Card>
            ))}
            <button className="btn w-full py-[11px] rounded-xl bg-transparent border-[1.5px] border-dashed border-line text-muted text-[13px] mb-4" onClick={addPerson}>+ Add Person</button>
            {err && <p className="text-danger text-xs mb-3">{err}</p>}
            <Btn onClick={sendRequests} disabled={!split}>Send Split Requests →</Btn>
          </div>
        ) : (
          <div className="animate-fadeUp text-center pt-5">
            <div className="w-20 h-20 rounded-full bg-teal/[.13] border-2 border-teal/[.33] flex items-center justify-center text-4xl mx-auto mb-4">🍕</div>
            <h2 className="text-2xl font-extrabold text-teal">Split Requests Sent!</h2>
            <p className="text-muted mt-1.5 text-[13px]">{sentResult.length} requests sent</p>
            <div className="mt-5">
              {sentResult.map((r) => (
                <Card key={r.id} className="p-3 mb-2 flex justify-between items-center">
                  <p className="text-[13px] font-semibold text-textLight">{r.to_vpa}</p>
                  <Badge color="#FFA000" size={10}>⏳ {fmt(r.amount)}</Badge>
                </Card>
              ))}
            </div>
            <div className="mt-5"><Btn onClick={onBack}>← Back</Btn></div>
          </div>
        )}
      </div>
    </div>
  );
}
