import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export function PdfPreviewModal({ isOpen, onClose, pdfBlob, title = "PDF Preview", filename = "document.pdf", loading = false }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setBlobUrl(null);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfBlob]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Window */}
      <div className="relative z-10 w-full max-w-4xl h-[90vh] max-h-[850px] bg-card border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surf/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="text-[14px] font-bold text-textLight leading-tight truncate">{title}</h3>
              <p className="text-[11px] text-muted font-mono truncate">{filename}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewTab}
              disabled={!blobUrl || loading}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-bg border border-line text-textLight hover:bg-white/5 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              title="Open in new browser tab"
            >
              <span>↗</span>
              <span className="hidden sm:inline">New Tab</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!pdfBlob || loading}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-accent text-white shadow-accentGlow hover:brightness-110 transition-all disabled:opacity-40 flex items-center gap-1.5"
            >
              <span>⬇</span>
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-white hover:bg-white/10 text-lg transition-colors ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#1e293b]/20 p-2 sm:p-3 relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/70 z-20">
              <div className="w-9 h-9 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-textLight">Preparing PDF view…</p>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-full rounded-xl border border-line/60 bg-white"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted text-xs gap-2">
              <span>⚠️ Could not load preview.</span>
              <button
                onClick={handleDownload}
                className="text-accent underline font-semibold"
              >
                Click here to download directly
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
