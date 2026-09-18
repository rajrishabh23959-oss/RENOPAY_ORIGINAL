import React, { useState } from "react";
import { getTranslation } from "./VendorTranslations";

export function VendorStaffAccess({
  currentLang = "hi",
  activeRole = "owner",
  onRoleChange,
}) {
  const t = getTranslation(currentLang);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("staff");

  const [staffList, setStaffList] = useState([
    {
      staff_id: "st_1",
      name: "Chhotu (Counter)",
      role: "staff",
      permissions: ["COLLECT_PAYMENT", "VIEW_TODAY_QR"],
      today_collected: 3150,
      linked_qr_id: "qr_counter_1",
    },
    {
      staff_id: "st_2",
      name: "Pooja (Cashier)",
      role: "staff",
      permissions: ["COLLECT_PAYMENT", "VIEW_TODAY_QR"],
      today_collected: 1850,
      linked_qr_id: "qr_counter_2",
    },
  ]);

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    const newMember = {
      staff_id: `st_${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      permissions: ["COLLECT_PAYMENT", "VIEW_TODAY_QR"],
      today_collected: 0,
      linked_qr_id: `qr_${Date.now()}`,
    };
    setStaffList([...staffList, newMember]);
    setNewStaffName("");
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Role Switcher (Owner vs Staff Mode) */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-200">
            {t.staff_heading}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent">
            Active: {activeRole === "owner" ? "Owner Mode" : "Staff Mode"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onRoleChange("owner")}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeRole === "owner"
                ? "bg-accent text-white shadow-lg"
                : "bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            <span>👑 {t.role_owner}</span>
            <span className="text-[9px] opacity-80">Full Control</span>
          </button>

          <button
            onClick={() => onRoleChange("staff")}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeRole === "staff"
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            <span>💼 {t.role_staff}</span>
            <span className="text-[9px] opacity-80">Collect Only</span>
          </button>
        </div>

        {activeRole === "staff" && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
            🛡️ {t.staff_restricted_note}
          </div>
        )}
      </div>

      {/* Staff Collection Insights (Owner View) */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-neutral-200">
            Staff Daily Collection
          </h4>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-[11px] font-bold text-accent hover:underline"
          >
            {t.add_staff_btn}
          </button>
        </div>

        <div className="space-y-2.5">
          {staffList.map((st) => (
            <div
              key={st.staff_id}
              className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold">
                  👤
                </div>
                <div>
                  <h5 className="text-white font-bold">{st.name}</h5>
                  <p className="text-neutral-400 text-[10px]">
                    Role: {st.role === "owner" ? "Owner" : "Helper / Cashier"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-emerald-400 font-bold text-sm">
                  ₹{st.today_collected.toLocaleString("en-IN")}
                </span>
                <span className="block text-[10px] text-neutral-500">
                  collected today
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] bg-[#1a1614] border border-white/15 rounded-2xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-white font-bold text-base">{t.add_staff_btn}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Staff Member Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Raju Helper"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Role
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
                >
                  <option value="staff">Staff (Payment Collection Only)</option>
                  <option value="owner">Co-Owner (Full Access)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-accent hover:brightness-110 text-white font-bold shadow-md"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
