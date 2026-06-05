// ============================================================
// 절약 수익 리포트 — 카테고리별 수익 차트
// Design: Bloomberg Terminal Parody × Financial Report
// ============================================================

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#10b981", // emerald-500
  "#34d399", // emerald-400
  "#6ee7b7", // emerald-300
  "#a7f3d0", // emerald-200
  "#d1fae5", // emerald-100
  "#059669", // emerald-600
];

interface Props {
  data: Record<string, number>;
}

export default function ProfitChart({ data }: Props) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 font-mono text-xs text-muted-foreground tracking-widest">
        NO DATA AVAILABLE
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₩${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            background: "#fff",
          }}
          formatter={(v: number) => [`₩${v.toLocaleString()}`, "PROFIT"]}
          cursor={{ fill: "rgba(16,185,129,0.06)" }}
        />
        {chartData.map((entry, index) => (
          <Bar key={entry.name} dataKey="value" radius={[2, 2, 0, 0]}>
            <Cell fill={COLORS[index % COLORS.length]} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
