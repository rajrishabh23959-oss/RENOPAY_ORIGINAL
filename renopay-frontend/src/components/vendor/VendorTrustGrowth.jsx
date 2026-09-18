import React, { useState } from "react";
import { getTranslation } from "./VendorTranslations";

export function VendorTrustGrowth({
  currentLang = "hi",
  merchantName = "RenoPay Merchant",
}) {
  const t = getTranslation(currentLang);
  const [copied, setCopied] = useState(false);

  const referralCode = "RENO-DUKAAN-88";

  const handleShareInvite = () => {
    const shareText = `Namaste! RenoPay Merchant app se apni dukaan par QR payments aur Soundbox chalu karein. Mera referral code use karein: ${referralCode} aur paayein ₹100 direct bank bonus! Download: https://renopay.app/merchant`;
    if (navigator.share) {
      navigator.share({
        title: "RenoPay Merchant Referral",
        text: shareText,
        url: "https://renopay.app/merchant",
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Verified Merchant & Trust Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1b2b20] to-[#121c15] border border-emerald-500/30 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-white font-bold text-sm">{merchantName}</h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                ✓ {t.verified_merchant}
              </span>
            </div>
            <p className="text-neutral-400 text-xs mt-0.5">
              GST &amp; Aadhaar KYC Verified • Bank Account Linked
            </p>
          </div>
        </div>
      </div>

      {/* Google-like Store Rating & Customer Reviews */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-neutral-200">
            {t.rating_label}
          </h4>
          <span className="text-[10px] text-neutral-400">{t.ratings_summary}</span>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="text-center bg-black/30 px-3 py-2 rounded-xl border border-white/5">
            <span className="text-3xl font-black text-amber-400 block">4.9</span>
            <div className="text-amber-400 text-xs">★★★★★</div>
          </div>
          <div className="space-y-1 text-[11px] text-neutral-300 flex-1">
            <p>🌟 {t.reviews_quote}</p>
          </div>
        </div>
      </div>

      {/* Merchant Referral Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#2a1d12] to-[#1a120b] border border-accent/40 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎁</span>
          <div>
            <h4 className="text-white font-bold text-xs">{t.referral_title}</h4>
            <p className="text-[11px] text-neutral-300 mt-0.5">{t.referral_desc}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono">
          <span className="text-neutral-400">Code:</span>
          <span className="text-accent font-bold tracking-wider">{referralCode}</span>
        </div>

        <button
          onClick={handleShareInvite}
          className="w-full py-2.5 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
        >
          <span>{copied ? "✓ Copied to Clipboard!" : `📲 ${t.share_invite}`}</span>
        </button>
      </div>
    </div>
  );
}
