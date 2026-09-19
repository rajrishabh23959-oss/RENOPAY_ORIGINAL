import { useState, useEffect } from "react";
import { RequestAPI } from "../lib/api";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt, ago } from "../lib/format";

export function RequestScreen({ onBack }) {
  const [tab, setTab] = useState("send");
  const [toVpa, setToVpa] = useState(""); const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const [sent, setSent] = useState([]); const [inbox, setInbox] = useState([]);
  const [payingId, setPayingId] = useState(null); // request currently awaiting PIN entry

  const loadAll = async () => {
    const [s, i] = await Promise.all([RequestAPI.sent(), RequestAPI.inbox()]);
    setSent(s); setInbox(i);
  };
  useEffect(() => { loadAll(); }, []);

  const sendRequest = async () => {
    if (!toVpa.includes("@")) { setErr("Enter valid VPA"); return; }
    if (!Number(amount) || Number(amount) < 1) { setErr("Enter valid amount"); return; }
    setErr("");
    try {
      await RequestAPI.create(toVpa, Number(amount), note);
      setDone(true);
      await loadAll();
      setTimeout(() => { setDone(false); setToVpa(""); setAmount(""); setNote(""); }, 1500);
    } catch (e) {
      setErr(e.response?.data?.detail?.message || "VPA not found");
    }
  };

  const confirmPay = async (pin) => {
    try {
      await RequestAPI.pay(payingId, pin);
      setPayingId(null);
      await loadAll();
    } catch (e) {
      setErr(e.response?.data?.detail?.message || "Payment failed — check your PIN");
      setPayingId(null);
    }
  };
  const decline = async (id) => { await RequestAPI.decline(id); await loadAll(); };

  const pendingCount = inbox.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      {payingId && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-6">
          <Card className="p-6 max-w-[320px] w-full border-accent/[.33]">
            <p className="text-center text-muted text-xs mb-4">Enter your UPI PIN to pay this request</p>
            <PINPad onComplete={confirmPay} label="6-digit PIN" />
            <button className="btn w-full mt-4 text-muted text-xs" onClick={() => setPayingId(null)}>Cancel</button>
          </Card>
        </div>
      )}
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Request Money 💌</h2>
      </div>
      <div className="px-[22px]">
        <div className="flex gap-2 mb-4">
          {[["send", "Send Request"], ["inbox", "Inbox"]].map(([v, l]) => (
            <button
              key={v}
              className={`btn flex-1 py-2.5 rounded-[10px] text-xs font-semibold transition-all ${
                tab === v
                  ? "bg-accent text-white shadow-sm border border-accent"
                  : "bg-card text-muted hover:text-textLight border border-line"
              }`}
              onClick={() => setTab(v)}
            >
              {l}{v === "inbox" && pendingCount > 0 && <span className="ml-1.5 bg-danger text-white rounded-full px-1.5 text-[10px]">{pendingCount}</span>}
            </button>
          ))}
        </div>

        {tab === "send" && (
          <div className="animate-fadeUp">
            <Card className="p-5 mb-4 border-accent/[.2]">
              <p className="text-muted text-[11px] tracking-wide mb-2 uppercase">Request from (UPI ID)</p>
              <input placeholder="rishabhraj@renopay" value={toVpa} onChange={(e) => setToVpa(e.target.value)} />
              <p className="text-muted text-[11px] tracking-wide mb-2 mt-3.5 uppercase">Amount</p>
              <div className="flex items-center gap-2">
                <span className="text-[22px] text-accent">₹</span>
                <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl font-bold" />
              </div>
              <p className="text-muted text-[11px] tracking-wide mb-2 mt-3.5 uppercase">Note (Optional)</p>
              <input placeholder="Lunch, rent, etc." value={note} onChange={(e) => setNote(e.target.value)} />
            </Card>
            {err && <p className="text-danger text-xs mb-3">{err}</p>}
            {done && <p className="text-teal text-[13px] text-center mb-3 animate-fadeIn">✅ Request sent!</p>}
            <Btn onClick={sendRequest}>Send Request →</Btn>

            {sent.length > 0 && (
              <div className="mt-5">
                <p className="text-muted text-xs font-semibold mb-2.5 tracking-wide uppercase">Sent</p>
                {sent.map((r) => (
                  <Card key={r.id} className="p-3.5 mb-2 flex items-center gap-3">
                    <div className="flex-1"><p className="font-semibold text-[13px] text-textLight">{r.to_vpa}</p><p className="text-muted text-[11px]">{r.note || "No note"} · {ago(r.created_at)}</p></div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-accent">{fmt(r.amount)}</p>
                      <Badge color={r.status === "paid" ? "#22C55E" : "#FFA000"} size={9}>{r.status === "paid" ? "✅ Paid" : "⏳ Pending"}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "inbox" && (
          <div className="animate-fadeUp">
            {inbox.length === 0 && <p className="text-muted text-center py-10">No incoming requests</p>}
            {inbox.map((r) => (
              <Card key={r.id} className={`p-4 mb-2.5 ${r.status === "pending" ? "border-warn/40" : "border-line"}`}>
                <div className="flex justify-between items-start mb-2.5">
                  <div><p className="font-bold text-sm text-textLight">{r.from_vpa}</p><p className="text-muted text-[11px]">{r.note || "No note"} · {ago(r.created_at)}</p></div>
                  <p className="font-mono font-bold text-lg text-warn">{fmt(r.amount)}</p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Btn variant="dark" className="flex-1 py-2.5" onClick={() => decline(r.id)}>Decline</Btn>
                    <Btn className="flex-1 py-2.5" onClick={() => setPayingId(r.id)}>Pay {fmt(r.amount)}</Btn>
                  </div>
                ) : <Badge color={r.status === "paid" ? "#22C55E" : "#5C564F"}>{r.status === "paid" ? "✅ Paid" : "❌ Declined"}</Badge>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
