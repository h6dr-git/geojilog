// #50 — 결산 계산 헬퍼: 기간 메타(periodType+startDate)만 저장하고, 내용은 장부에서 재계산한다.
// (장부가 원본 원칙 — 기록을 고치면 소장 카드도 따라 바뀐다)
import { SavingsEntry } from "@/lib/ledger";
import { cpaWeeklyComment } from "@/lib/voice";
import { PROFIT_KIND_LABELS, resolveProfitKind, type ProfitKind } from "@shared/profitKinds";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mmdd = (s: string) => s.slice(5).replace("-", ".");

export type TopProfitKind = { kind: ProfitKind; label: string; profit: number };

export type ReportData = {
  start: string;
  end: string;
  cardLabel: string;   // "거지로그 주간 결산"
  cardPeriod: string;  // "06.08 – 06.14" / "2026.06"
  shelfLabel: string;  // 서가 썸네일용 — "6.8~ 주간" / "6월"
  profit: number;
  count: number;
  best: SavingsEntry | null;
  topSource: { name: string; profit: number } | null;
  topProfitKind: TopProfitKind | null;
  comment: string;
};

export function aggregateTopProfitKind(entries: SavingsEntry[]): TopProfitKind | null {
  const m: Partial<Record<ProfitKind, number>> = {};
  entries.forEach((e) => {
    const k = resolveProfitKind(e);
    m[k] = (m[k] ?? 0) + (e.profit || 0);
  });
  const arr = (Object.entries(m) as [ProfitKind, number][]).sort((a, b) => b[1] - a[1]);
  const top = arr[0];
  return top && top[1] > 0 ? { kind: top[0], label: PROFIT_KIND_LABELS[top[0]], profit: top[1] } : null;
}

export function computeReport(
  entries: SavingsEntry[],
  periodType: "week" | "month",
  startDate: string,
  todayIso?: string
): ReportData {
  const today = todayIso ?? iso(new Date());
  const start = startDate;
  let end: string;
  let cardLabel: string, cardPeriod: string, shelfLabel: string;

  if (periodType === "week") {
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    end = iso(e) < today ? iso(e) : today;
    cardLabel = "거지로그 주간 결산";
    cardPeriod = `${mmdd(start)} – ${mmdd(end)}`;
    shelfLabel = `${s.getMonth() + 1}.${s.getDate()}~ 주간`;
  } else {
    const s = new Date(startDate + "T00:00:00");
    const last = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    end = iso(last) < today ? iso(last) : today;
    cardLabel = `거지로그 ${s.getMonth() + 1}월 결산`;
    cardPeriod = `${s.getFullYear()}.${pad(s.getMonth() + 1)}`;
    shelfLabel = `${s.getMonth() + 1}월`;
  }

  const scoped = entries.filter((e) => e.date >= start && e.date <= end);
  const profit = scoped.reduce((s2, e) => s2 + (e.profit || 0), 0);
  const count = scoped.length;
  const best = scoped.length ? scoped.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
  const m: Record<string, number> = {};
  scoped.forEach((e) => { if (e.incomeSource) m[e.incomeSource] = (m[e.incomeSource] ?? 0) + e.profit; });
  const arr = Object.entries(m).sort((a, b) => b[1] - a[1]);
  const topSource = arr[0] ? { name: arr[0][0], profit: arr[0][1] } : null;
  const topProfitKind = aggregateTopProfitKind(scoped);
  const comment =
    count === 0
      ? "이 기간엔 기록이 없습니다."
      : periodType === "week"
        ? cpaWeeklyComment(count, profit)
        : `${count}건을 정리해 두었습니다.`;

  return { start, end, cardLabel, cardPeriod, shelfLabel, profit, count, best, topSource, topProfitKind, comment };
}
