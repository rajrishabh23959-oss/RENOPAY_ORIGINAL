import { useState, useEffect, useRef } from "react";
import { RewardAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui";
import { fmt } from "../lib/format";

function ScratchCard({ card, onScratch }) {
  const [done, setDone] = useState(card.scratched);
  const canvasRef = useRef();
  const isDrawing = useRef(false);

  useEffect(() => {
    if (done) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#2A2320"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Orange shimmer pattern
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#2A2320"); grad.addColorStop(0.5, "#3D2E1E"); grad.addColorStop(1, "#2A2320");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,106,26,0.25)"; ctx.font = "bold 13px Outfit"; ctx.textAlign = "center";
    ctx.fillText("SCRATCH TO REVEAL", canvas.width / 2, canvas.height / 2 - 8);
    ctx.fillText("YOUR REWARD →", canvas.width / 2, canvas.height / 2 + 12);
  }, [done]);

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const cl = e.touches ? e.touches[0] : e;
    return { x: cl.clientX - r.left, y: cl.clientY - r.top };
  };

  const scratch = (e) => {
    if (done || !isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
    if (transparent / (canvas.width * canvas.height) > 0.55 && !done) {
      setDone(true);
      onScratch(card.id);
    }
  };

  return (
    <Card className="p-5 text-center relative overflow-hidden mb-3" style={{ border: `1.5px solid ${done ? "#FF6A1A66" : "#FF6A1A44"}` }}>
      <p className="text-muted text-[11px] font-semibold mb-2 tracking-wide uppercase">Scratch Card</p>
      <div className="relative rounded-xl overflow-hidden h-[100px] flex items-center justify-center bg-bg border border-line">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-4xl">{card.reward_type === "cashback" ? "💰" : "🪙"}</span>
          <p className="font-mono font-bold text-xl text-accent">{card.label}</p>
        </div>
        {!done && (
          <canvas
            ref={canvasRef} width={280} height={100}
            className="absolute inset-0 w-full h-full cursor-crosshair rounded-xl touch-none"
            onMouseDown={(e) => { isDrawing.current = true; scratch(e); }}
            onMouseMove={scratch}
            onMouseUp={() => (isDrawing.current = false)}
            onTouchStart={(e) => { isDrawing.current = true; scratch(e); }}
            onTouchMove={scratch}
            onTouchEnd={() => (isDrawing.current = false)}
          />
        )}
      </div>
      {done && <p className="text-accent font-bold text-[13px] mt-2.5">{card.reward_type === "cashback" ? "💰 Cashback added!" : "🪙 Gold deposited!"}</p>}
      {!done && <p className="text-muted text-[11px] mt-2">Drag to scratch!</p>}
    </Card>
  );
}

export function RewardsScreen({ onBack }) {
  const { profile, refreshProfile } = useAuth();
  const [cards, setCards] = useState([]);

  const load = () => RewardAPI.listScratchCards().then((res) => setCards(res.data || res)).catch(console.error);
  useEffect(() => { load(); }, []);

  const doScratch = async (cardId) => {
    await RewardAPI.scratch(cardId);
    await load();
    await refreshProfile();
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Rewards 🎰</h2>
      </div>
      <div className="px-[22px]">
        <Card className="p-4 mb-4 border-accent/[.27] bg-accent/[.03] flex gap-3.5 items-center">
          <span className="text-3xl">🪙</span>
          <div><p className="font-bold text-sm text-accent">Digital Gold: {fmt(profile?.account?.digital_gold ?? 0)}</p><p className="text-muted text-[11px]">Earn more by scratching cards!</p></div>
        </Card>
        <p className="text-muted text-[11px] font-semibold tracking-wide mb-3 uppercase">
          Your Scratch Cards ({cards.filter((c) => !c.scratched).length} unscratched)
        </p>
        {cards.length === 0 && (
          <div className="text-center py-10">
            <p className="text-4xl">🎰</p>
            <p className="text-muted mt-2.5">No scratch cards yet</p>
            <p className="text-muted text-xs mt-1">Make transactions above ₹500 to earn cards!</p>
          </div>
        )}
        {cards.map((c) => <ScratchCard key={c.id} card={c} onScratch={doScratch} />)}
      </div>
    </div>
  );
}
