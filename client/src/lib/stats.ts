// #51 통계 다원화 — 전부 클라 계산(서버 비용 0). 서재 보고서의 기간 탭별 통계 섹션이 쓴다.
// 프레임: '번 돈'의 패턴 — 요일 리듬·추이·히트맵·기록·누적 우상향.
import { SavingsEntry } from "@/lib/ledger";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// ── 요일 리듬 — 최근 8주 기준 요일별 평균 수익 (월~일) ──
export function dayOfWeekRhythm(entries: SavingsEntry[], weeks = 8): { day: number; avg: number }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const from = new Date(today); from.setDate(from.getDate() - weeks * 7 + 1);
  const fromIso = iso(from);
  const sums = Array(7).fill(0);
  for (const e of entries) {
    if (e.date < fromIso) continue;
    const dow = new Date(e.date + "T00:00:00").getDay(); // 0=일
    sums[(dow + 6) % 7] += e.profit; // 0=월 … 6=일
  }
  return sums.map((s, i) => ({ day: i, avg: Math.round(s / weeks) }));
}

// ── 수익 추이 — 최근 n주 (월요일 시작), 이번 주 포함 ──
export function weeklyTrend(entries: SavingsEntry[], n = 8): { start: string; profit: number; current: boolean }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMon = mondayOf(today);
  const out: { start: string; profit: number; current: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const mon = new Date(thisMon); mon.setDate(thisMon.getDate() - 7 * i);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const s = iso(mon), e = iso(sun);
    const profit = entries.reduce((acc, x) => (x.date >= s && x.date <= e ? acc + x.profit : acc), 0);
    out.push({ start: s, profit, current: i === 0 });
  }
  return out;
}

// ── 수익 추이 — 최근 n개월, 이번 달 포함 ──
export function monthlyTrend(entries: SavingsEntry[], n = 6): { ym: string; label: string; profit: number; current: boolean }[] {
  const today = new Date();
  const out: { ym: string; label: string; profit: number; current: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
    const profit = entries.reduce((acc, x) => (x.date.startsWith(ym) ? acc + x.profit : acc), 0);
    out.push({ ym, label: `${m.getMonth() + 1}월`, profit, current: i === 0 });
  }
  return out;
}

// ── 월간 히트맵 — 해당 월 일별 수익 (달력 셀 강도용). max 기준 0~1 강도 ──
export function monthHeatmap(entries: SavingsEntry[], ym: string): { day: number; profit: number; intensity: number }[] {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const byDay = Array(days + 1).fill(0);
  for (const e of entries) {
    if (!e.date.startsWith(ym)) continue;
    byDay[Number(e.date.slice(8, 10))] += e.profit;
  }
  const max = Math.max(0, ...byDay);
  return Array.from({ length: days }, (_, i) => {
    const profit = byDay[i + 1];
    return { day: i + 1, profit, intensity: max > 0 ? profit / max : 0 };
  });
}

// ── 기록 지표 — 끼당 평균·최고 주간·최장 연속 기록 ──
export function allTimeRecords(entries: SavingsEntry[]): {
  avgPerEntry: number;
  bestWeek: { start: string; profit: number } | null;
  longestStreak: number;
} {
  if (entries.length === 0) return { avgPerEntry: 0, bestWeek: null, longestStreak: 0 };
  const total = entries.reduce((s, e) => s + e.profit, 0);
  const avgPerEntry = Math.round(total / entries.length);

  // 주별 합 → 최고 주간
  const weekSums = new Map<string, number>();
  for (const e of entries) {
    const mon = iso(mondayOf(new Date(e.date + "T00:00:00")));
    weekSums.set(mon, (weekSums.get(mon) ?? 0) + e.profit);
  }
  let bestWeek: { start: string; profit: number } | null = null;
  weekSums.forEach((profit, start) => {
    if (!bestWeek || profit > bestWeek.profit) bestWeek = { start, profit };
  });

  // 최장 연속 기록일
  const days = Array.from(new Set(entries.map((e) => e.date))).sort();
  let longestStreak = 0, cur = 0, prev: string | null = null;
  for (const d of days) {
    if (prev) {
      const p = new Date(prev + "T00:00:00");
      p.setDate(p.getDate() + 1);
      cur = iso(p) === d ? cur + 1 : 1;
    } else cur = 1;
    longestStreak = Math.max(longestStreak, cur);
    prev = d;
  }
  return { avgPerEntry, bestWeek, longestStreak };
}

// ── 누적 우상향 곡선 — 날짜순 누적 수익 포인트 (전체 탭) ──
export function cumulativeCurve(entries: SavingsEntry[]): { date: string; cum: number }[] {
  const byDate = new Map<string, number>();
  for (const e of entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.profit);
  const dates = Array.from(byDate.keys()).sort();
  let cum = 0;
  return dates.map((d) => {
    cum += byDate.get(d)!;
    return { date: d, cum };
  });
}
