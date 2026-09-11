import { useState, useEffect } from "react";
import { AnalyticsAPI } from "../lib/api";
import { Card } from "../components/ui";
import { fmt } from "../lib/format";

export function ExpensesScreen({ onBack }) {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);

  useEffect(() => { AnalyticsAPI.expenses(period).then(setData); }, [period]);

  if (!data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accent"></div>
      </div>
    );
  }
  const bpct = data.budget_used_percent;

  return (
    <div className="min-h-screen bg-bg pb-[100px]">
      <div className="pt-[50px] pb-[18px] px-[22px] flex items-center gap-3">
        <button className="btn bg-card border border-line text-textLight rounded-xl px-3.5 py-2.5 text-base" onClick={onBack}>←</button>
        <h2 className="text-[22px] font-extrabold text-textLight">Expense Tracker</h2>
      </div>
      <div className="px-[22px] flex flex-col gap-3.5">
        <div className="flex gap-2">
          {[["week", "Week"], ["month", "Month"], ["all", "All"]].map(([v, l]) => (
            <button key={v} className="btn flex-1 py-2 rounded-[10px] text-xs font-semibold"
                    style={{ background: period === v ? "#FF6A1A" : "#151210", color: period === v ? "#fff" : "#5C564F", border: `1px solid ${period === v ? "#FF6A1A" : "#2A2320"}` }}
                    onClick={() => setPeriod(v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 border-danger/[.2]"><p className="text-muted text-[10px] tracking-wide font-semibold uppercase">Total Spent</p><p className="font-mono text-xl font-bold text-danger mt-1.5">{fmt(data.total_spent)}</p></Card>
          <Card className="p-4 border-teal/[.2]"><p className="text-muted text-[10px] tracking-wide font-semibold uppercase">Income</p><p className="font-mono text-xl font-bold text-teal mt-1.5">{fmt(data.total_income)}</p><p className="text-muted text-[10px] mt-1">Net: {fmt(data.net)}</p></Card>
        </div>
        <Card className="p-[18px]">
          <div className="flex justify-between mb-2.5"><p className="text-[13px] font-bold text-textLight">Monthly Budget</p><p className="font-mono text-[11px]" style={{ color: bpct > 80 ? "#ff3d60" : bpct > 60 ? "#FFA000" : "#22C55E" }}>{fmt(data.total_spent)} / {fmt(data.budget)}</p></div>
          <div className="bg-bg rounded-lg h-2.5 overflow-hidden"><div className="h-full rounded-lg transition-[width] duration-700" style={{ width: `${bpct}%`, background: bpct > 80 ? "#ff3d60" : bpct > 60 ? "#FFA000" : "#22C55E" }} /></div>
          <p className="text-muted text-[11px] mt-2">{bpct > 80 ? "🚨 Over budget soon!" : bpct > 60 ? "⚠ Moderate" : "✅ On track"} · {(100 - bpct).toFixed(0)}% left</p>
        </Card>
        {data.by_category.length > 0 && (
          <Card className="p-[18px]">
            <p className="text-sm font-bold mb-3.5 text-textLight">By Category</p>
            {data.by_category.map((c) => (
              <div key={c.category} className="mb-3.5">
                <div className="flex justify-between items-center mb-1.5"><span className="text-[13px] font-semibold text-textLight">{c.category}</span><span className="text-[10px] text-muted">{c.percent}%</span></div>
                <div className="bg-bg rounded-md h-1.5 overflow-hidden"><div className="h-full rounded-md bg-accent transition-[width] duration-500" style={{ width: `${c.percent}%` }} /></div>
                <p className="text-right text-[11px] font-mono text-accent mt-0.5">{fmt(c.amount)}</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
