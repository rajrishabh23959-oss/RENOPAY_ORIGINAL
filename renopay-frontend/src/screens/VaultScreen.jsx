import { useState, useEffect } from "react";
import { VaultAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Btn, Badge, Card } from "../components/ui";
import { PINPad } from "../components/PINPad";
import { fmt, ago } from "../lib/format";

function VaultCard({ vault, onRefresh }) {
  const { profile, refreshProfile } = useAuth();
  const pct = Math.min(100, (vault.balance / vault.target) * 100);

  // Modals & action states
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributePinOpen, setContributePinOpen] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const [withdrawMyPinOpen, setWithdrawMyPinOpen] = useState(false);
  const [myContributedAmount, setMyContributedAmount] = useState(0);

  const [vaultWithdrawOpen, setVaultWithdrawOpen] = useState(false);
  const [vaultWithdrawAmount, setVaultWithdrawAmount] = useState(String(vault.balance));
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
    if (!Number(contributeAmount) || Number(contributeAmount) < 1) {
      setErr("Please enter a valid contribution amount");
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
      const msg = e.response?.data?.detail?.message || e.response?.data?.message || "Contribution failed — check your PIN";
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

  // 3. Conflict / Exit Withdrawal Flow (Withdraw My Contribution)
  const confirmWithdrawMyContribution = async (pin) => {
    try {
      await VaultAPI.withdrawMyContribution(vault.id, pin);
      setWithdrawMyPinOpen(false);
      setSuccessMsg(`Withdrew your contribution of ${fmt(myContributedAmount)} back to your main balance!`);
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || "Withdrawal failed — check your PIN";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setWithdrawMyPinOpen(false);
    }
  };

  // 4. Request Vault Withdrawal (Consensus)
  const startVaultWithdraw = () => {
    const amt = Number(vaultWithdrawAmount);
    if (!amt || amt <= 0 || amt > vault.balance) {
      setErr(`Enter an amount up to available vault balance of ${fmt(vault.balance)}`);
      return;
    }
    setErr("");
    setVaultWithdrawOpen(false);
    setVaultWithdrawPinOpen(true);
  };

  const confirmRequestVaultWithdrawPin = async (pin) => {
    try {
      await VaultAPI.requestWithdrawal(vault.id, Number(vaultWithdrawAmount), pin);
      setVaultWithdrawPinOpen(false);
      setSuccessMsg(`Withdrawal request initiated! Waiting for members to approve.`);
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || "Failed to initiate vault withdrawal";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setVaultWithdrawPinOpen(false);
    }
  };

  // 5. Approve Withdrawal Request
  const confirmApprovePin = async (pin) => {
    try {
      await VaultAPI.approveWithdrawal(vault.id, pin);
      setApprovePinOpen(false);
      setSuccessMsg("You approved the withdrawal request with your UPI PIN!");
      await onRefresh();
      await refreshProfile?.();
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || "Approval failed — check your PIN";
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
          <Badge color="#FF6A1A" size={10}>{pct.toFixed(0)}% Saved</Badge>
          {vault.balance >= vault.target && (
            <p className="text-[10px] font-bold text-success mt-1">🎯 100% Target Reached!</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-bg rounded-lg h-2.5 overflow-hidden mb-3.5 border border-line">
        <div
          className="h-full rounded-lg transition-[width] duration-700 bg-gradient-to-r from-[#FF6A1A] to-[#FFA000] shadow-[0_0_10px_#FF6A1A88]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ACTIVE MULTI-PARTY WITHDRAWAL REQUEST BANNER */}
      {activeReq && (
        <div className="p-3.5 mb-4 rounded-2xl bg-[#2D1B12] border border-accent/50 shadow-inner">
          <div className="flex items-start gap-2.5">
            <span className="text-2xl animate-bounce">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-white">
                Withdrawal Requested by <span className="text-accent">{activeReq.requester_name}</span>
              </p>
              <p className="text-sm font-mono font-black text-[#FF9E66] my-0.5">
                {fmt(activeReq.amount)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted">
                  Approvals: <strong className="text-white">{activeReq.approvals.length}</strong> of {activeReq.total_members} members approved
                </span>
              </div>
            </div>
          </div>

          {/* Approval Buttons for Current User */}
          <div className="mt-3 pt-2.5 border-t border-accent/20 flex items-center justify-between gap-2">
            {activeReq.has_approved ? (
              <span className="text-[11px] font-bold text-success flex items-center gap-1">
                <span>✓</span> You approved. Waiting for other members to enter UPI PIN.
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setErr("");
                    setApprovePinOpen(true);
                  }}
                  className="btn flex-1 py-2 px-3 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs shadow-accentGlow cursor-pointer"
                >
                  ✓ Allow (Enter PIN)
                </button>
                <button
                  type="button"
                  onClick={handleRejectWithdrawal}
                  className="btn py-2 px-3 rounded-xl bg-surf border border-line text-muted hover:text-white font-bold text-xs cursor-pointer"
                >
                  Reject
                </button>
              </>
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

        {/* CONFLICT / INDIVIDUAL CONTRIBUTION WITHDRAWAL ("Withdraw My Contribution") */}
        {myContributedAmount > 0 && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#2A1D16] border border-warn/30 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-textLight">Your Contributed Stake</p>
              <p className="font-mono text-xs font-bold text-[#FFA000]">{fmt(myContributedAmount)}</p>
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

      {/* Main Action Buttons: Contribute & Withdraw Full Vault */}
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
              />
            </div>
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
            <Btn className="flex-1 py-2.5" onClick={() => setContributeOpen(true)}>
              + Contribute
            </Btn>
            {vault.balance > 0 && !activeReq && (
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setVaultWithdrawAmount(String(vault.balance));
                  setVaultWithdrawOpen(true);
                }}
                className="btn flex-1 py-2.5 rounded-xl bg-card border border-accent/40 text-accent hover:border-accent font-bold text-xs transition-all cursor-pointer"
              >
                Withdraw Vault Funds 🏧
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
                  {l.user_name} · {l.log_type === "refund" ? "withdrew contribution" : l.log_type === "withdrawal" ? "vault payout" : "contributed"} ({ago(l.created_at)})
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
            <p className="text-xs text-muted mb-3">Enter the user's UPI ID or phone number</p>
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

      {/* MODAL 3: Conflict Withdrawal PIN Confirmation */}
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

      {/* MODAL 4: Specify Vault Withdrawal Amount */}
      {vaultWithdrawOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-5 max-w-[340px] w-full border-accent/40 shadow-2xl">
            <h4 className="font-extrabold text-base text-white mb-1">Request Vault Withdrawal</h4>
            <p className="text-xs text-muted mb-3">
              All vault members will be asked to approve with their UPI PIN before funds are released.
            </p>
            <div className="mb-3">
              <label className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Withdrawal Amount (₹)</label>
              <input
                type="number"
                value={vaultWithdrawAmount}
                onChange={(e) => setVaultWithdrawAmount(e.target.value)}
                placeholder="Amount"
                max={vault.balance}
                className="text-base font-semibold"
              />
              <p className="text-[10px] text-muted mt-1">Available in vault: {fmt(vault.balance)}</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="dark" className="flex-1 py-2 text-xs" onClick={() => setVaultWithdrawOpen(false)}>
                Cancel
              </Btn>
              <Btn className="flex-1 py-2 text-xs" onClick={startVaultWithdraw}>
                Next: Enter PIN →
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 5: PIN for Requesting Vault Withdrawal */}
      {vaultWithdrawPinOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-6 max-w-[320px] w-full border-accent/40 shadow-2xl">
            <p className="text-center font-bold text-white text-sm mb-1">Sign Withdrawal Request</p>
            <p className="text-center text-muted text-xs mb-4">
              Enter your UPI PIN to initiate request for <strong className="text-accent">{fmt(Number(vaultWithdrawAmount))}</strong>
            </p>
            <PINPad onComplete={confirmRequestVaultWithdrawPin} label="Enter 6-digit UPI PIN" actionType="withdraw" actionLabel="Submit" />
            <button className="btn w-full mt-3 text-muted text-xs cursor-pointer" onClick={() => setVaultWithdrawPinOpen(false)}>
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* MODAL 6: Member Approval PIN */}
      {approvePinOpen && activeReq && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 animate-fadeUp">
          <Card className="p-6 max-w-[320px] w-full border-accent/40 shadow-2xl">
            <p className="text-center font-bold text-white text-sm mb-1">Allow Vault Withdrawal</p>
            <p className="text-center text-muted text-xs mb-4">
              Allowing <strong className="text-white">{activeReq.requester_name}</strong> to withdraw{" "}
              <strong className="text-accent">{fmt(activeReq.amount)}</strong>
            </p>
            <PINPad onComplete={confirmApprovePin} label="Enter 6-digit UPI PIN to Allow" actionType="withdraw" actionLabel="Allow" />
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
      setLoading(true);
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
  }, []);

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
