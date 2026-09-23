import { useState, useEffect } from "react";
import { PaymentAPI, AnalyticsAPI } from "../lib/api";
import { useRenoSocket } from "../hooks/useRenoSocket";
import { Badge, TrustBadge, Card } from "../components/ui";
import { fmt, ago } from "../lib/format";
import { PdfPreviewModal } from "../components/PdfPreviewModal";
import { downloadOrSharePdf } from "../lib/download";
import { PoweredByUpiBadge } from "../components/UpiBrandBadges";

export function HistoryScreen({ onBack }) {
  const [txns, setTxns] = useState([]);
  const [filter, setFilter] = useState("all"); // "all" | "upi" | "card"
  const [loading, setLoading] = useState(true);
  const [downloadingRef, setDownloadingRef] = useState(null);
  const [viewingRef, setViewingRef] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("Payment Receipt");
  const [previewFilename, setPreviewFilename] = useState("receipt.pdf");

  const load = () => PaymentAPI.getTransactions(20, 0)
    .then((res) => { setTxns(res.data || res); })
    .catch(console.error)
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);
  useRenoSocket((evt) => { if (evt.type === "balance_update") load(); });

  const handleDownloadReceipt = async (txn_ref) => {
    if (downloadingRef) return;
    setDownloadingRef(txn_ref);
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: "transaction_receipt",
        txn_ref: txn_ref,
      });
      await downloadOrSharePdf(blob, `Receipt_${txn_ref}.pdf`);
    } catch (e) {
      alert("Failed to download PDF receipt: " + (e?.response?.data?.detail || e.message));
    } finally {
      setDownloadingRef(null);
    }
  };

  const handleViewReceipt = async (txn_ref) => {
    if (viewingRef) return;
    setViewingRef(txn_ref);
    setPreviewTitle(`Payment Receipt - ${txn_ref}`);
    setPreviewFilename(`Receipt_${txn_ref}.pdf`);
    setPreviewBlob(null);
    setPreviewModalOpen(true);
    try {
      const blob = await AnalyticsAPI.downloadReport({
        type: "transaction_receipt",
        txn_ref: txn_ref,
      });
      setPreviewBlob(blob);
    } catch (e) {
      alert("Failed to open PDF receipt: " + (e?.response?.data?.detail || e.message));
      setPreviewModalOpen(false);
    } finally {
      setViewingRef(null);
    }
  };

  const isCardTxn = (t) => {
    const desc = (t.description || "").toLowerCase();
    return t.category === "Card" || desc.includes("gift card") || desc.includes("voucher") || desc.includes("debit card");
  };

  const shown = txns.filter((t) => {
    if (filter === "all") return true;
    if (filter === "card") return isCardTxn(t);
    if (filter === "upi") return !isCardTxn(t);
    return true;
  });

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Transactions</h2>
      </div>
      <div className="px-[22px]">
        {/* NPCI Mandated 3-Tier Classification Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            ["all", "All Transactions"],
            ["upi", "UPI Transactions"],
            ["card", "Card Transactions"],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`btn flex-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all border text-center ${
                filter === v
                  ? "bg-accent text-white border-accent shadow-sm scale-[1.01]"
                  : "bg-card border-line text-muted hover:text-textLight hover:bg-surf"
              }`}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="text-muted text-center py-9">No transactions found in this category</p>}
        {shown.map((t) => {
          const descLower = (t.description || "").toLowerCase();
          const isTravel = t.category === "Transport" || descLower.includes("booking");
          const travelIcon = descLower.includes("flight") ? "✈️" : descLower.includes("bus") ? "🚌" : descLower.includes("hotel") ? "🏨" : "🚆";
          const isUpi = !isCardTxn(t);

          return (
            <Card key={t.txn_ref} className="p-3.5 mb-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-base shrink-0">
                  {isTravel ? travelIcon : isUpi ? "📲" : "💳"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate text-textLight">{t.description}</p>
                  {isUpi && t.counterparty_vpa && (
                    <p className="text-[11px] font-mono text-accent font-semibold truncate">
                      UPI ID: {t.counterparty_vpa}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <TrustBadge score={t.trust_score} />
                    <p className="text-muted text-[10px]">{ago(t.created_at)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  {/* NPCI "Powered by UPI" Top-Right Badge */}
                  {isUpi && (
                    <span className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                      Powered by UPI
                    </span>
                  )}
                  <p className="font-mono font-bold text-[13px]" style={{ color: t.type === "credit" ? "#22C55E" : "#ff3d60" }}>
                    {t.type === "credit" ? "+" : "-"}{fmt(t.amount)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(t.txn_ref)}
                        disabled={viewingRef === t.txn_ref}
                        className="btn bg-card border border-line hover:border-accent/50 text-textLight px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
                        title="View Receipt PDF"
                      >
                        {viewingRef === t.txn_ref ? "⏳" : "👁 View"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(t.txn_ref)}
                        disabled={downloadingRef === t.txn_ref}
                        className="btn bg-card border border-accent/40 hover:bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
                        title="Download Receipt PDF"
                      >
                        {downloadingRef === t.txn_ref ? "⏳" : "⬇ PDF"}
                      </button>
                    </div>
                    <Badge color="#FF6A1A" size={9}>{t.category}</Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Receipt PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        pdfBlob={previewBlob}
        title={previewTitle}
        filename={previewFilename}
        loading={viewingRef !== null}
      />
    </div>
  );
}
