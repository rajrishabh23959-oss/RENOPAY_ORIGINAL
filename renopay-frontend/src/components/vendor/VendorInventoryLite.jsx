import React, { useState, useEffect } from "react";
import { getTranslation } from "./VendorTranslations";
import { VendorAPI } from "../../lib/api";

export function VendorInventoryLite({
  currentLang = "ta",
  onQuickBill, // Callback when vendor taps 1-click QR for an item
}) {
  const t = getTranslation(currentLang);
  const [items, setItems] = useState(() => t.sample_items || []);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Sync with native language sample items when language switches
  useEffect(() => {
    if (t.sample_items) {
      setItems(t.sample_items);
    }
  }, [currentLang]);

  // Load from backend if available
  useEffect(() => {
    VendorAPI.getInventory()
      .then((res) => {
        if (res.items && res.items.length > 0) {
          // If backend has items, merge them
          setItems(res.items);
        }
      })
      .catch(() => {
        // Fallback to localized sample items
      });
  }, []);

  // Top seller item
  const topItem =
    items.length > 0
      ? items.reduce((prev, curr) => (curr.sale_count > prev.sale_count ? curr : prev))
      : { item_name: "Item", sale_count: 0, price: 0 };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;
    const price = Number(newItemPrice);
    const newItem = {
      item_id: `itm_${Date.now()}`,
      item_name: newItemName.trim(),
      price: price,
      sale_count: 0,
      icon: "📦",
    };
    setItems([newItem, ...items]);
    setNewItemName("");
    setNewItemPrice("");
    setShowAdd(false);

    try {
      await VendorAPI.addInventory({
        item_name: newItem.item_name,
        price_rupees: price,
        icon: "📦",
      });
    } catch {
      // Local state is preserved
    }
  };

  const handleIncrementSale = async (itemId) => {
    setItems(
      items.map((it) =>
        it.item_id === itemId ? { ...it, sale_count: it.sale_count + 1 } : it
      )
    );
    try {
      await VendorAPI.quickBill(itemId);
    } catch {
      // Local state is updated
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Seller Badge */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-950/40 to-amber-950/30 border border-accent/30 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-bounce">🔥</span>
          <div>
            <h4 className="text-white font-bold text-xs">
              {t.top_seller_badge
                .replace("{name}", topItem.item_name)
                .replace("{count}", topItem.sale_count)}
            </h4>
            <p className="text-[10px] text-accent font-medium">
              ₹{topItem.price} • {topItem.sale_count * topItem.price} {t.today_total}
            </p>
          </div>
        </div>
      </div>

      {/* Item Catalogue for 1-Tap Quick Billing */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-neutral-200">
            {t.inventory_title}
          </h4>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-[11px] font-bold text-accent hover:underline"
          >
            {showAdd ? "✕" : `+ ${t.inventory_title.split("&")[0]}`}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAddItem} className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2 text-xs animate-fade-in">
            <input
              type="text"
              required
              placeholder={t.item_note_placeholder}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <input
                type="number"
                required
                placeholder={t.amount_label}
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="flex-1 bg-[#120e0c] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs shadow-md"
              >
                ✓
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-2">
          {items.map((item) => (
            <div
              key={item.item_id}
              className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs hover:border-white/15 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h5 className="text-white font-bold">{item.item_name}</h5>
                  <p className="text-neutral-400 text-[11px]">
                    ₹{item.price} • {item.sale_count} {t.payments_count_label}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 1-Tap QR Billing */}
                <button
                  onClick={() => {
                    handleIncrementSale(item.item_id);
                    if (onQuickBill) onQuickBill(item.price, `${item.item_name}`);
                  }}
                  className="py-1.5 px-3 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs border border-accent/30 transition-all flex items-center gap-1 shadow-sm"
                >
                  <span>⚡</span>
                  <span>{t.fast_bill_btn}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
