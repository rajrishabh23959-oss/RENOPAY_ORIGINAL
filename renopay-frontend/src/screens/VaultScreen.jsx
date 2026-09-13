import { useState, useEffect } from "react";
import { VaultAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useRenoSocket } from "../hooks/useRenoSocket";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt, ago } from "../lib/format";

function VaultCard({ vault, onRefresh }) {
  const { profile, refreshProfile } = useAuth();
  const pct = Math.min(100, (vault.balance / vault.target) * 100);
  const isFull = vault.balance >= vault.target;

  // Modals & action states
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributePinOpen, setContributePinOpen] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const [withdrawMyPinOpen, setWithdrawMyPinOpen] = useState(false);
  const [myContributedAmount, setMyContributedAmount] = useState(0);

  const [vaultWithdrawPinOpen, setVaultWithdrawPinOpen] = useState(false);
  const [approvePinOpen, setApprovePinOpen] = useState(false);

  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const currentMember = vault.members?.find((m) => m.is_current_user);

  useEffect(() => {
    if (currentMember) {
      setMyContributedAmount(currentMember.contributed_amount || 0);
    }
  }, [currentMember]);

  // 1. Contribute Flow
  const startContribute = () => {
    if (isFull) {
      setErr("Vault is 100% full! No more money can be added.");
      return;
    }
    const amt = Number(contributeAmount);
    if (!amt || amt < 1) {
      setErr("Please enter a valid contribution amount");
      return;
    }
    const maxAdd = vault.target - vault.balance;
    if (amt > maxAdd) {
      setErr(`Contribution exceeds target! Maximum you can add is ${fmt(maxAdd)}`);
      return;
    }
    setErr("");
    setContributePinOpen(true);
  };

  const confirmContributePin = async (pin) => {
    try {
      await VaultAPI.contribute(vault.id, Number(contributeAmount), pin);
      setContributePinOpen(false);
      setContributeOpen(false);
      setContributeAmount("");
      setSuccessMsg(`Contributed ${fmt(Number(contributeAmount))} successfully!`);
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail?.message || e.response?.data?.detail || e.response?.data?.message || "Contribution failed — check your PIN";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setContributePinOpen(false);
    }
  };

  // 2. Add Member Flow
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberIdentifier.trim()) return;
    setErr("");
    setAddingMember(true);
    try {
      await VaultAPI.addMember(vault.id, memberIdentifier.trim());
      setAddMemberOpen(false);
      setMemberIdentifier("");
      setSuccessMsg("Member added to shared vault successfully!");
      await onRefresh();
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || "Could not add member";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setAddingMember(false);
    }
  };

  // 3. Personal Contribution Refund (NO request to other members needed)
  const confirmWithdrawMyContribution = async (pin) => {
    try {
      await VaultAPI.withdrawMyContribution(vault.id, pin);
      setWithdrawMyPinOpen(false);
      setSuccessMsg(`Withdrew your contribution of ${fmt(myContributedAmount)} directly to your main balance!`);
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail?.message || e.response?.data?.detail || e.response?.data?.message || "Withdrawal failed — check your PIN";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setWithdrawMyPinOpen(false);
    }
  };

  // 4. Full Vault Withdrawal Request (REQUIRES all other members' approval)
  const confirmRequestVaultWithdrawPin = async (pin) => {
    try {
      await VaultAPI.requestWithdrawal(vault.id, vault.balance, pin);
      setVaultWithdrawPinOpen(false);
      setSuccessMsg(`Withdrawal request sent to all vault members! Once they accept & pay, funds will be released.`);
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail?.message || e.response?.data?.detail || e.response?.data?.message || "Failed to initiate vault withdrawal";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setVaultWithdrawPinOpen(false);
    }
  };

  // 5. Approve Withdrawal Request
  const confirmApprovePin = async (pin) => {
    try {
      await VaultAPI.approveWithdrawal(vault.id, pin);
      setApprovePinOpen(false);
      setSuccessMsg("You accepted and approved the full vault withdrawal with your UPI PIN!");
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail?.message || e.response?.data?.detail || e.response?.data?.message || "Approval failed — check your PIN";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setApprovePinOpen(false);
    }
  };

  const handleRejectWithdrawal = async () => {
    try {
      await VaultAPI.rejectWithdrawal(vault.id);
      setSuccessMsg("Withdrawal request rejected.");
      await onRefresh();
    } catch (e) {
      setErr("Failed to reject withdrawal");
    }
  };

  const activeReq = vault.active_withdrawal;

  return (
    <Card className="p-[18px] mb-5 border-accent/[.3] shadow-lg relative bg-gradient-to-b from-[#211A16] to-[#171311]">
      {/* Toast Notification */}
      {successMsg && (
        <div className="mb-3 p-2.5 rounded-xl bg-success/20 border border-success/40 text-success text-xs font-semibold flex items-center justify-between animate-fadeUp">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-white text-xs cursor-pointer ml-2">✕</button>
        </div>
      )}
      {err && (
        <div className="mb-3 p-2.5 rounded-xl bg-danger/20 border border-danger/40 text-danger text-xs font-semibold flex items-center justify-between animate-fadeUp">
          <span>⚠ {err}</span>
          <button onClick={() => setErr("")} className="text-white text-xs cursor-pointer ml-2">✕</button>
        </div>
      )}

      {/* Header Info */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{vault.icon}</span>
            <h3 className="font-extrabold text-base text-white">{vault.name}</h3>
          </div>
          <p className="text-muted text-[11px] mt-0.5">
            <span className="font-mono font-bold text-accent">{fmt(vault.balance)}</span> of {fmt(vault.target)}
          </p>
        </div>
        <div className="text-right">
          <Badge color={isFull ? "#22C55E" : "#FF6A1A"} size={10}>
            {pct.toFixed(0)}% {isFull ? "COMPLETED" : "SAVED"}
          </Badge>
          {isFull && (
            <p className="text-[10px] font-extrabold text-success mt-1 flex items-center justify-end gap-1">
              <span>🎯</span> 100% Target Reached!
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-bg rounded-lg h-2.5 overflow-hidden mb-3.5 border border-line">
        <div
          className={`h-full rounded-lg transition-[width] duration-700 shadow-lg ${
            isFull
              ? "bg-gradient-to-r from-success to-emerald-400 shadow-[0_0_10px_#22C55E88]"
              : "bg-gradient-to-r from-[#FF6A1A] to-[#FFA000] shadow-[0_0_10px_#FF6A1A88]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 100% Target Reached Notice */}
      {isFull && (
        <div className="p-2.5 mb-3.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-bold text-center">
          🎉 Vault is 100% full! Goal has been achieved — no more contributions can be added.
        </div>
      )}

      {/* ACTIVE FULL VAULT WITHDRAWAL REQUEST BANNER */}
      {activeReq && (
        <div className="p-4 mb-4 rounded-2xl bg-gradient-to-r from-[#3A1E11] to-[#25150E] border-2 border-accent shadow-xl animate-fadeUp">
          <div className="flex items-start gap-3">
            <span className="text-3xl animate-bounce">🔔</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-warn text-black font-mono">
                  ACTION REQUIRED
                </span>
                <span className="text-[10px] text-muted">{ago(activeReq.created_at)}</span>
              </div>
              <p className="text-xs font-bold text-white">
                <span className="text-accent font-extrabold">{activeReq.requester_name}</span> has requested to withdraw the full vault:
              </p>
              <p className="text-2xl font-mono font-black text-white my-1 tracking-tight">
                {fmt(activeReq.amount)}
              </p>
              <p className="text-[11px] text-muted">
                Approvals received: <strong className="text-accent">{activeReq.approvals.length}</strong> of {activeReq.total_members} members
              </p>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-accent/30">
            {activeReq.has_approved ? (
              <div className="p-2.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2">
                <span>✓</span>
                <span>You have accepted this withdrawal request. Waiting for other members to enter UPI PIN.</span>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-textLight mb-2 font-semibold">
                  Accept & confirm with your UPI PIN to release full vault funds to {activeReq.requester_name}:
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErr("");
                      setApprovePinOpen(true);
                    }}
                    className="btn flex-1 py-2.5 px-3 rounded-xl bg-accent hover:brightness-110 text-white font-extrabold text-xs shadow-accentGlow cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>Accept & Pay (Enter PIN)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectWithdrawal}
                    className="btn py-2.5 px-3 rounded-xl bg-surf border border-line text-muted hover:text-white font-bold text-xs cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEMBERS & STAKE CONTRIBUTION BREAKDOWN */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>👥</span> Vault Members ({vault.members?.length || 0})
          </p>
          <button
            type="button"
            onClick={() => {
              setErr("");
              setAddMemberOpen(true);
            }}
            className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>➕</span> Add Member
          </button>
        </div>

        <div className="space-y-2">
          {vault.members?.map((m) => (
            <div
              key={m.user_id}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                m.is_current_user ? "bg-accent/[.06] border-accent/40" : "bg-card border-line"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">{m.is_creator ? "👑" : "👤"}</span>
                  <p className="text-xs font-bold text-white truncate">{m.name}</p>
                  {m.is_current_user && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-accent/20 text-accent border border-accent/30">
                      You
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted font-mono truncate">{m.vpa || m.phone_number}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-xs text-white">
                  {fmt(m.contributed_amount)}
                </p>
                <span className="text-[9px] text-muted">Contributed</span>
              </div>
            </div>
          ))}
        </div>

        {/* PERSONAL CONTRIBUTION REFUND (No other member's request needed) */}
        {myContributedAmount > 0 && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#2A1D16] border border-warn/30 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-textLight">Your Personal Contribution</p>
              <p className="font-mono text-xs font-bold text-[#FFA000]">{fmt(myContributedAmount)}</p>
              <p className="text-[9px] text-muted">You can withdraw your own money anytime</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setErr("");
                setWithdrawMyPinOpen(true);
              }}
              className="btn py-1.5 px-3 rounded-lg bg-warn/20 hover:bg-warn/30 border border-warn/40 text-warn hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Withdraw My Money ↩
            </button>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS: Contribute & Withdraw Full Vault */}
      <div className="pt-2 border-t border-line">
        {contributeOpen ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-accent text-lg font-bold">₹</span>
              <input
                type="number"
                placeholder="Enter amount to contribute"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                className="flex-1 text-base font-semibold"
                max={vault.target - vault.balance}
              />
            </div>
            <p className="text-[10px] text-muted mb-2">
              Remaining to reach 100%: {fmt(Math.max(0, vault.target - vault.balance))}
            </p>
            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1 py-2" onClick={() => setContributeOpen(false)}>
                Cancel
              </Btn>
              <Btn className="flex-1 py-2" onClick={startContribute}>
                Enter PIN & Contribute →
              </Btn>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {!isFull && (
              <Btn className="flex-1 py-2.5" onClick={() => setContributeOpen(true)}>
                + Contribute
              </Btn>
            )}
            {vault.balance > 0 && !activeReq && (
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setVaultWithdrawPinOpen(true);
                }}
                className={`btn py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isFull
                    ? "flex-1 bg-accent hover:brightness-110 text-white shadow-accentGlow font-extrabold"
                    : "flex-1 bg-card border-accent/40 text-accent hover:border-accent"
                }`}
              >
                Withdraw Full Vault ({fmt(vault.balance)}) 🏧
              </button>
            )}
          </div>
        )}
      </div>

      {/* Activity Log Feed */}
      {vault.logs?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line">
          <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Recent Activity</p>
          <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
            {vault.logs.slice(0, 5).map((l, i) => (
              <div key={i} className="flex justify-between items-center text-[11px] py-0.5 border-b border-line/40 last:border-0">
                <span className="text-muted truncate">
                  {l.user_name} · {l.log_type === "refund" ? "withdrew contribution" : l.log_type === "withdrawal" ? "full vault payout" : "contributed"} ({ago(l.created_at)})
                </span>
                <span className={`font-mono font-bold shrink-0 ${l.log_type === "contribution" ? "text-success" : "text-warn"}`}>
                  {l.log_type === "contribution" ? "+" : "-"}{fmt(l.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Enter UPI PIN to Contribute */}
      {contributePinOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-6 max-w-[320px] w-full border-accent/40 shadow-2xl">
            <p className="text-center font-bold text-white text-sm mb-1">Confirm Contribution</p>
            <p className="text-center text-muted text-xs mb-4">
              Adding <strong className="text-accent">{fmt(Number(contributeAmount))}</strong> to {vault.name}
            </p>
            <PINPad onComplete={confirmContributePin} label="Enter 6-digit UPI PIN" actionType="pay" actionLabel="Contribute" />
            <button className="btn w-full mt-3 text-muted text-xs cursor-pointer" onClick={() => setContributePinOpen(false)}>
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* MODAL 2: Add Member (Phone Number or UPI ID) */}
      {addMemberOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-5 max-w-[340px] w-full border-accent/40 shadow-2xl">
            <h4 className="font-extrabold text-base text-white mb-1">Add Member to Vault</h4>
            <p className="text-xs text-muted mb-3">Enter the member's UPI ID or 10-digit phone number</p>
            <form onSubmit={handleAddMember}>
              <input
                placeholder="e.g. ambrish@renopay or 9876543210"
                value={memberIdentifier}
                onChange={(e) => setMemberIdentifier(e.target.value)}
                className="mb-3 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Btn variant="dark" className="flex-1 py-2 text-xs" type="button" onClick={() => setAddMemberOpen(false)}>
                  Cancel
                </Btn>
                <Btn className="flex-1 py-2 text-xs" type="submit" disabled={addingMember}>
                  {addingMember ? "Adding…" : "Add Member"}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 3: Personal Contribution Withdrawal (No one else's approval needed) */}
      {withdrawMyPinOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-6 max-w-[320px] w-full border-warn/40 shadow-2xl">
            <p className="text-center font-bold text-white text-sm mb-1">Withdraw Your Contribution</p>
            <p className="text-center text-muted text-xs mb-4">
              Refunding <strong className="text-warn">{fmt(myContributedAmount)}</strong> back to your main account balance
            </p>
            <PINPad onComplete={confirmWithdrawMyContribution} label="Enter 6-digit UPI PIN" actionType="withdraw" actionLabel="Withdraw" />
            <button className="btn w-full mt-3 text-muted text-xs cursor-pointer" onClick={() => setWithdrawMyPinOpen(false)}>
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* MODAL 4: Request Full Vault Withdrawal (Requires other members' consent) */}
      {vaultWithdrawPinOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-6 max-w-[320px] w-full border-accent/40 shadow-2xl">
            <p className="text-center font-extrabold text-white text-base mb-1">Withdraw Full Vault</p>
            <p className="text-center text-xs text-muted mb-4">
              A withdrawal request for <strong className="text-accent">{fmt(vault.balance)}</strong> will be sent to all vault members. Once all members accept with their UPI PIN, funds will be transferred to your account.
            </p>
            <PINPad onComplete={confirmRequestVaultWithdrawPin} label="Enter 6-digit UPI PIN to Request" actionType="withdraw" actionLabel="Send Request" />
            <button className="btn w-full mt-3 text-muted text-xs cursor-pointer" onClick={() => setVaultWithdrawPinOpen(false)}>
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* MODAL 5: Member Approval PIN (Accept & Pay) */}
      {approvePinOpen && activeReq && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-6 max-w-[320px] w-full border-accent/40 shadow-2xl">
            <p className="text-center font-bold text-white text-sm mb-1">Allow Vault Withdrawal</p>
            <p className="text-center text-muted text-xs mb-4">
              Allowing <strong className="text-white">{activeReq.requester_name}</strong> to withdraw full vault{" "}
              <strong className="text-accent">{fmt(activeReq.amount)}</strong>
            </p>
            <PINPad onComplete={confirmApprovePin} label="Enter 6-digit UPI PIN to Allow" actionType="withdraw" actionLabel="Accept & Pay" />
            <button className="btn w-full mt-3 text-muted text-xs cursor-pointer" onClick={() => setApprovePinOpen(false)}>
              Cancel
            </button>
          </Card>
        </div>
      )}
    </Card>
  );
}

export function VaultScreen({ onBack }) {
  const [vaults, setVaults] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    icon: "🏖️",
    target: "",
    member_phones: "",
    member_vpas: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await VaultAPI.list();
      setVaults(res.data || res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // 3-second background polling while on Vault screen so multi-party requests stay in sync
    const timer = setInterval(() => {
      load();
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Real-time WebSocket listener
  useRenoSocket((evt) => {
    if (
      evt.type === "vault_withdrawal_request" ||
      evt.type === "vault_updated" ||
      evt.type === "vault_invite" ||
      evt.type === "vault_payout" ||
      evt.type === "balance_update"
    ) {
      load();
    }
  });

  const createVault = async () => {
    if (!form.name || !Number(form.target)) {
      setErr("Please enter vault name and target amount");
      return;
    }
    setErr("");
    const memberPhones = form.member_phones.split(",").map((s) => s.trim()).filter(Boolean);
    const memberVpas = form.member_vpas.split(",").map((s) => s.trim()).filter(Boolean);

    try {
      await VaultAPI.create(form.name, form.icon, Number(form.target), memberPhones, memberVpas);
      await load();
      setShowNew(false);
      setForm({ name: "", icon: "🏖️", target: "", member_phones: "", member_vpas: "" });
    } catch {
      setErr("Could not create vault");
    }
  };

  const ICONS = ["🏖️", "🎓", "🏠", "🚗", "💍", "✈️", "🎉", "🎁"];

  return (
    <div className="min-h-screen bg-bg pb-[100px] text-textLight">
      {/* Top Header */}
      <div className="pt-[50px] pb-[16px] px-[22px] flex items-center justify-between border-b border-line bg-bg/95 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2 text-base hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
            onClick={onBack}
          >
            ←
          </button>
          <div>
            <h2 className="text-[20px] font-extrabold text-white leading-tight flex items-center gap-1.5">
              Shared Vaults <span>🏖️</span>
            </h2>
            <p className="text-[11px] text-muted">Save together with friends & multi-party consensus</p>
          </div>
        </div>
      </div>

      <div className="px-[20px] pt-4">
        {vaults.length === 0 && !showNew && !loading && (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">🏖️</p>
            <p className="text-white font-bold text-sm">No shared vaults yet</p>
            <p className="text-muted text-xs mt-1">Create a group vault with friends via phone numbers or UPI IDs!</p>
          </div>
        )}

        {vaults.map((v) => (
          <VaultCard key={v.id} vault={v} onRefresh={load} />
        ))}

        {showNew ? (
          <Card className="p-5 border-accent/[.35] shadow-2xl bg-[#1F1814] mb-6">
            <p className="font-extrabold text-base mb-3 text-accent flex items-center gap-2">
              <span>➕</span> New Shared Vault
            </p>

            {/* Icon Picker */}
            <div className="flex flex-wrap gap-2 mb-3.5">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  className="btn p-2 rounded-xl text-xl cursor-pointer transition-all active:scale-95"
                  style={{
                    background: form.icon === ic ? "#FF6A1A2A" : "#161210",
                    border: `1.5px solid ${form.icon === ic ? "#FF6A1A" : "#2A2320"}`,
                  }}
                  onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                >
                  {ic}
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-3">
              <div>
                <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Vault Name</label>
                <input
                  placeholder="e.g. Goa Trip Fund or Flat Rent"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 20000"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Member Phone Numbers (comma-separated, optional)</label>
                <input
                  placeholder="e.g. 9876543210, 9876543211"
                  value={form.member_phones}
                  onChange={(e) => setForm((f) => ({ ...f, member_phones: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Member UPI IDs (comma-separated, optional)</label>
                <input
                  placeholder="e.g. ambrish@renopay, rishab@renopay"
                  value={form.member_vpas}
                  onChange={(e) => setForm((f) => ({ ...f, member_vpas: e.target.value }))}
                />
              </div>
            </div>

            {err && <p className="text-danger text-xs mb-3 font-semibold">{err}</p>}

            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1 py-2.5" onClick={() => setShowNew(false)}>
                Cancel
              </Btn>
              <Btn className="flex-1 py-2.5" onClick={createVault}>
                Create Vault
              </Btn>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            className="btn w-full py-3.5 rounded-2xl bg-card border-[1.5px] border-dashed border-accent/40 text-accent text-sm font-bold flex items-center justify-center gap-2 hover:border-accent hover:bg-accent/[.04] active:scale-[0.98] transition-all cursor-pointer shadow-sm mb-6"
            onClick={() => setShowNew(true)}
          >
            <span>➕</span>
            <span>Create New Shared Vault</span>
          </button>
        )}
      </div>
    </div>
  );
}
