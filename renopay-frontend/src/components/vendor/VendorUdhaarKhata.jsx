import React, { useState, useEffect } from "react";
import { getTranslation } from "./VendorTranslations";
import { VendorAPI } from "../../lib/api";

export function VendorUdhaarKhata({
  currentLang = "ta",
  merchantName = "RenoPay Merchant",
  merchantVpa = "merchant@renopay",
}) {
  const t = getTranslation(currentLang);
  const [activeTab, setActiveTab] = useState("diya"); // "diya" (receivable) | "liya" (payable)
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Seed customer list with native localization
  const [customers, setCustomers] = useState(() => t.sample_customers || []);

  useEffect(() => {
    if (t.sample_customers) {
      setCustomers(t.sample_customers);
    }
  }, [currentLang]);

  // Load from backend if available
  useEffect(() => {
    VendorAPI.getKhata()
      .then((res) => {
        if (res.customers && res.customers.length > 0) {
          setCustomers(res.customers);
        }
      })
      .catch(() => {});
  }, []);

  // Form states for Add Customer
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newType, setNewType] = useState("diya");
  const [newPhoto, setNewPhoto] = useState("👤");

  // Calculations
  const totalReceivable = customers
    .filter((c) => c.type === "diya" && c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalPayable = customers
    .filter((c) => c.type === "liya" && c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const displayList = customers.filter(
    (c) => c.type === activeTab && c.status === "pending"
  );

  // Mark customer debt as paid
  const handleMarkPaid = async (khataId) => {
    const cust = customers.find((c) => c.khata_id === khataId);
    if (!cust) return;

    setCustomers(
      customers.map((c) => (c.khata_id === khataId ? { ...c, status: "paid" } : c))
    );

    const alert = t.customer_paid_alert
      .replace("{name}", cust.customer_name)
      .replace("{amount}", cust.amount);
    setToastMsg(alert);
    setTimeout(() => setToastMsg(""), 3500);

    try {
      await VendorAPI.markKhataPaid(khataId);
    } catch {
      // Local state is updated
    }
  };

  // Trigger WhatsApp reminder directly to customer's phone
  const handleWhatsAppReminder = (cust) => {
    const paymentLink = `https://renopay.app/pay?vpa=${merchantVpa}&am=${cust.amount}`;
    const message = t.whatsapp_msg
      .replace("{name}", cust.customer_name)
      .replace("{amount}", cust.amount)
      .replace("{link}", paymentLink);

    const cleanPhone = cust.customer_mobile.replace(/\D/g, "");
    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  // Add new customer submission
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newAmount || Number(newAmount) <= 0) return;
    const amt = Number(newAmount);

    const newEntry = {
      khata_id: `kh_${Date.now()}`,
      customer_name: newName.trim(),
      customer_mobile: newMobile.trim() || "9999999999",
      customer_photo: newPhoto,
      amount: amt,
      type: newType,
      date: "Just now",
      note: newNote.trim() || "Store credit",
      status: "pending",
    };

    setCustomers([newEntry, ...customers]);
    setShowAddModal(false);
    setNewName("");
    setNewMobile("");
    setNewAmount("");
    setNewNote("");

    try {
      await VendorAPI.addKhataCustomer({
        customer_name: newEntry.customer_name,
        customer_mobile: newEntry.customer_mobile,
        customer_photo: newPhoto,
        initial_amount_rupees: amt,
        entry_type: newType,
        note: newEntry.note,
      });
    } catch {
      // Local state is preserved
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center animate-fade-in shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* Top Outstanding Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#2a1715] via-[#1f1210] to-[#140b0a] border border-red-500/30 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
            {t.khata_title}
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1 rounded-full bg-accent hover:brightness-110 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1"
          >
            <span>{t.add_customer}</span>
          </button>
        </div>

        {/* Large Receivable Summary */}
        <div className="my-2.5">
          <h2 className="text-2xl font-black text-red-400 tracking-tight">
            {t.total_receivable.replace("{total}", totalReceivable.toLocaleString("en-IN"))}
          </h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {t.total_payable.replace("{total}", totalPayable.toLocaleString("en-IN"))}
          </p>
        </div>
      </div>

      {/* Tabs: Maine Diya vs Maine Liya */}
      <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
        <button
          onClick={() => setActiveTab("diya")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "diya"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <span>📉</span>
          <span>{t.tab_diya} (₹{totalReceivable})</span>
        </button>
        <button
          onClick={() => setActiveTab("liya")}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "liya"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <span>📈</span>
          <span>{t.tab_liya} (₹{totalPayable})</span>
        </button>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {displayList.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 text-neutral-400 text-xs">
            <span className="text-3xl block mb-2">🎉</span>
            <p>{t.all_clear_msg}</p>
          </div>
        ) : (
          displayList.map((cust) => (
            <div
              key={cust.khata_id}
              className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2.5 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl shadow-inner">
                    {cust.customer_photo}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm leading-tight">
                      {cust.customer_name}
                    </h4>
                    <p className="text-neutral-400 text-[11px] font-mono">
                      +91 {cust.customer_mobile}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-base font-black ${
                      cust.type === "diya" ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    ₹{Number(cust.amount).toLocaleString("en-IN")}
                  </span>
                  <span className="block text-[10px] text-neutral-500">
                    {cust.date}
                  </span>
                </div>
              </div>

              {cust.note && (
                <p className="text-[11px] text-neutral-300 bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5">
                  📝 {cust.note}
                </p>
              )}

              {/* Action Buttons: Mark Paid & WhatsApp Reminder */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <button
                  onClick={() => handleMarkPaid(cust.khata_id)}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1 border border-emerald-500/30 transition-all"
                >
                  {t.mark_paid}
                </button>

                {cust.type === "diya" && (
                  <button
                    onClick={() => handleWhatsAppReminder(cust)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] font-bold text-xs flex items-center justify-center gap-1 border border-[#25D366]/40 transition-all"
                  >
                    <span>💬</span>
                    <span>{t.whatsapp_remind}</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-[380px] bg-[#1a1614] border border-white/15 rounded-2xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-white font-bold text-base">{t.add_customer}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewType("diya")}
                  className={`flex-1 py-2 rounded-xl font-bold ${
                    newType === "diya" ? "bg-red-500 text-white" : "bg-white/5 text-neutral-400"
                  }`}
                >
                  {t.tab_diya}
                </button>
                <button
                  type="button"
                  onClick={() => setNewType("liya")}
                  className={`flex-1 py-2 rounded-xl font-bold ${
                    newType === "liya" ? "bg-emerald-500 text-white" : "bg-white/5 text-neutral-400"
                  }`}
                >
                  {t.tab_liya}
                </button>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  {t.customer_name}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  {t.customer_phone}
                </label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  {t.amount_label}
                </label>
                <input
                  type="number"
                  required
                  placeholder="₹ 500"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  {t.item_note_placeholder}
                </label>
                <input
                  type="text"
                  placeholder="Rations / Breakfast"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
                />
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
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
