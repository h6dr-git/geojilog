// #51 통계 블록 — 서재 보고서 카드 안에서 쓰는 미니 차트들 (인라인 SVG/div, 라이브러리 없음).
// 톤: butler 카드 내부 (빈 바탕 #efe4cd, 강조 emerald, 하이라이트 gold) — 구성 그래프와 동일 문법.
import { fmt, KO_DAYS } from "@/lib/ledger";

const TRACK = "#efe4cd";
const PAST = "#d9cba6";
const EMERALD = "rgba(52,211,153,0.85)";
const GOLD = "rgba(224,169,46,0.9)";
const INK_SOFT = "#5c5647";
const LABEL = "#8a7f63";

// ── 요일 리듬 — 최근 8주 요일별 평균 (월~일) ──
export function WeekRhythm({ data }: { data: { day: number; avg: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.avg));
  const top = data.reduce((a, b) => (b.avg > a.avg ? b : a));
  const dayName = (i: number) => KO_DAYS[(i + 1) % 7]; // 0=월 → KO_DAYS[1]
  return (
    <div>
      <p className="voice-label mb-1.5">요일 리듬 — 최근 8주 평균</p>
      <div className="flex items-end gap-1.5" style={{ height: "56px" }}>
        {data.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(d.avg > 0 ? 8 : 2, Math.round((d.avg / max) * 44))}px`,
                background: d.avg === 0 ? TRACK : d.day === top.day ? GOLD : EMERALD,
              }}
            />
            <span className="text-micro mt-1" style={{ color: d.day === top.day ? "#B07F1E" : LABEL }}>{dayName(d.day)}</span>
          </div>
        ))}
      </div>
      {top.avg > 0 && (
        <p className="text-micro mt-1" style={{ color: "#B07F1E" }}>황금 요일 — {dayName(top.day)}요일 (평균 +₩{fmt(top.avg)})</p>
      )}
    </div>
  );
}

// ── 추이 바 — 주간(최근 8주) / 월간(최근 6개월) 공용 ──
export function TrendBars({
  title,
  data,
}: {
  title: string;
  data: { label: string; profit: number; current: boolean }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.profit));
  const cur = data.find((d) => d.current);
  return (
    <div>
      <p className="voice-label mb-1.5">{title}</p>
      <div className="flex items-end gap-1.5" style={{ height: "64px" }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            {d.current && d.profit > 0 && (
              <span className="text-micro font-mono tabular-nums mb-0.5 whitespace-nowrap" style={{ color: "#059669" }}>+{Math.round(d.profit / 1000)}k</span>
            )}
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(d.profit > 0 ? 6 : 2, Math.round((d.profit / max) * 40))}px`,
                background: d.profit === 0 ? TRACK : d.current ? EMERALD : PAST,
              }}
            />
            <span className="text-micro mt-1 truncate" style={{ color: d.current ? INK_SOFT : LABEL }}>{d.label}</span>
          </div>
        ))}
      </div>
      {cur && cur.profit === 0 && <p className="text-micro mt-1" style={{ color: LABEL }}>이번 기간은 아직 시작 전입니다</p>}
    </div>
  );
}

// ── 월간 히트맵 — 일별 수익 강도 달력 ──
export function MonthHeat({
  ym,
  data,
}: {
  ym: string; // YYYY-MM
  data: { day: number; profit: number; intensity: number }[];
}) {
  const [y, m] = ym.split("-").map(Number);
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0=월
  const best = data.reduce((a, b) => (b.profit > a.profit ? b : a), { day: 0, profit: 0, intensity: 0 });
  const cells: ({ day: number; profit: number; intensity: number } | null)[] = [
    ...Array(firstDow).fill(null),
    ...data,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div>
      <p className="voice-label mb-1.5">수익 히트맵 — 언제 벌었나</p>
      <div className="grid grid-cols-7 gap-1">
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
          <div key={d} className="text-center text-micro" style={{ color: LABEL }}>{d}</div>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <div key={`e${i}`} />
          ) : (
            <div
              key={c.day}
              className="aspect-square rounded flex items-center justify-center"
              style={{
                background: c.profit > 0 ? `rgba(16,185,129,${0.15 + 0.6 * c.intensity})` : TRACK,
                border: c.day === best.day && best.profit > 0 ? "1.5px solid rgba(224,169,46,0.9)" : "none",
              }}
            >
              <span className="text-micro tabular-nums" style={{ color: c.profit > 0 ? "#1A4731" : "#b3a888", fontSize: "9px" }}>{c.day}</span>
            </div>
          )
        )}
      </div>
      {best.profit > 0 && (
        <p className="text-micro mt-1.5" style={{ color: "#B07F1E" }}>베스트 데이 — {m}.{best.day} (+₩{fmt(best.profit)})</p>
      )}
    </div>
  );
}

// ── 기록 지표 — 끼당 평균 · 최고 주간 · 최장 연속 ──
export function RecordsRow({
  avgPerEntry,
  bestWeek,
  longestStreak,
}: {
  avgPerEntry: number;
  bestWeek: { start: string; profit: number } | null;
  longestStreak: number;
}) {
  const cell = (label: string, value: string, sub?: string) => (
    <div className="flex-1 rounded-xl px-2.5 py-2.5 text-center" style={{ background: "rgba(239,228,205,0.55)" }}>
      <p className="text-micro" style={{ color: LABEL }}>{label}</p>
      <p className="text-caption font-mono font-semibold tabular-nums mt-0.5" style={{ color: INK_SOFT }}>{value}</p>
      {sub && <p className="text-micro mt-0.5" style={{ color: LABEL }}>{sub}</p>}
    </div>
  );
  return (
    <div className="flex gap-1.5">
      {cell("끼당 평균", `+₩${fmt(avgPerEntry)}`)}
      {cell("최고 주간", bestWeek ? `+₩${fmt(bestWeek.profit)}` : "—", bestWeek ? `${Number(bestWeek.start.slice(5, 7))}.${Number(bestWeek.start.slice(8, 10))}~` : undefined)}
      {cell("최장 연속", `${longestStreak}일`)}
    </div>
  );
}

// ── 누적 우상향 곡선 — 총람의 얼굴 ──
export function CumulativeCurve({ points }: { points: { date: string; cum: number }[] }) {
  if (points.length === 0) return null;
  const W = 280, H = 72, P = 4;
  const max = points[points.length - 1].cum;
  const t0 = new Date(points[0].date + "T00:00:00").getTime();
  const t1 = new Date(points[points.length - 1].date + "T00:00:00").getTime();
  const span = Math.max(1, t1 - t0);
  const xy = points.map((p) => {
    const x = P + ((new Date(p.date + "T00:00:00").getTime() - t0) / span) * (W - P * 2);
    const y = H - P - (p.cum / Math.max(1, max)) * (H - P * 2);
    return [x, y] as const;
  });
  // 시작점이 하나뿐이면 점만
  const path = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${xy[xy.length - 1][0].toFixed(1)},${H - P} L${xy[0][0].toFixed(1)},${H - P} Z`;
  const last = xy[xy.length - 1];
  return (
    <div>
      <p className="voice-label mb-1.5">누적 수익 곡선</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "72px" }}>
        <path d={area} fill="rgba(52,211,153,0.14)" />
        <path d={path} fill="none" stroke="rgba(16,185,129,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="3" fill="#E0A92E" />
      </svg>
      <p className="text-micro text-right -mt-1" style={{ color: "#B07F1E" }}>지금 +₩{fmt(max)}</p>
    </div>
  );
}
