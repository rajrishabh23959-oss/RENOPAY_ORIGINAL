import { Badge, Card } from "./ui";

export function HeartbeatGauge({ spendScore }) {
  const col = spendScore < 40 ? "#22C55E" : spendScore < 70 ? "#FFA000" : "#ff3d60";
  const msg = spendScore < 40 ? "Financial Heartbeat Stable 💚" : spendScore < 70 ? "Moderate Spending ⚠️" : "High Spending Fever! 🚨";
  const r = 50, cx = 85, cy = 68;
  const polar = (ang) => ({ x: cx + r * Math.cos((ang * Math.PI) / 180), y: cy + r * Math.sin((ang * Math.PI) / 180) });
  const arcPath = (startDeg, endDeg) => {
    const s = polar(startDeg), e = polar(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y}`;
  };
  const needleDeg = -180 + spendScore * 1.8;
  const nx = cx + 42 * Math.cos((needleDeg * Math.PI) / 180);
  const ny = cy + 42 * Math.sin((needleDeg * Math.PI) / 180);

  return (
    <Card className="px-[18px] pt-4 pb-3" style={{ border: `1px solid ${col}33` }}>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-bold text-muted tracking-wide">SENTINAI HEARTBEAT</p>
        <Badge color={col} size={10}>{spendScore < 40 ? "STABLE" : spendScore < 70 ? "CAUTION" : "CRITICAL"}</Badge>
      </div>
      <div className="flex items-end gap-3">
        <svg width="170" height="92" viewBox="0 0 170 92" className="overflow-visible flex-shrink-0">
          <path d={arcPath(-180, 0)} fill="none" stroke="currentColor" className="text-line" strokeWidth="9" strokeLinecap="round" />
          <path d={arcPath(-180, -108)} fill="none" stroke="#22C55E88" strokeWidth="9" strokeLinecap="round" />
          <path d={arcPath(-108, -54)} fill="none" stroke="#FFA00088" strokeWidth="9" strokeLinecap="round" />
          <path d={arcPath(-54, 0)} fill="none" stroke="#ff3d6088" strokeWidth="9" strokeLinecap="round" />
          <path
            d={arcPath(-180, Math.min(0, -180 + spendScore * 1.8))} fill="none" stroke={col} strokeWidth="9"
            strokeLinecap="round" style={{ transition: "all 1s ease", filter: `drop-shadow(0 0 5px ${col})` }}
          />
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "all 1s ease" }} />
          <circle cx={cx} cy={cy} r="4.5" fill={col} />
          <text x="28" y="86" textAnchor="middle" fontSize="11" fontWeight="800" fill="#22C55E">Safe</text>
          <text x="85" y="14" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFA000">Mid</text>
          <text x="142" y="86" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ff3d60">Risk</text>
        </svg>
        <div className="flex-1 pb-1">
          <p className="text-[13px] font-bold leading-tight" style={{ color: col }}>{msg}</p>
          <p className="text-[10px] text-muted mt-1">SentinAI emotional analysis</p>
        </div>
      </div>
    </Card>
  );
}
