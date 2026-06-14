// 거지로그 — 장부 공용 타입·유틸 (Ledger·상세시트·Wrapped 등 공유)

import { PROFIT_KIND_LABELS, resolveProfitKind, type ProfitKind } from "@shared/profitKinds";
import { LEDGER_LABELS } from "@shared/ledgerLabels";

export interface SavingsEntry {
  id: number;
  date: string;
  title: string;
  description?: string | null;
  category: string;
  incomeSource?: string | null; // #37+#38 수익원 (null=미분류)
  ticker: string;
  originalAmount: number;
  actualAmount: number;
  profit: number;
  profitKind?: "save" | "receive" | "restrain" | "earn" | null;
  userPriceNote?: string | null;
  savingsSteps?: string | null; // #50 연쇄 할인 단계 JSON
  aiEstimated: "yes" | "no";
  aiReason?: string | null;
  imageUrl?: string | null;
  memo?: string | null;
  createdAt: Date;
  userId: number;
}

export type ExportRange = "all" | "month" | "week" | "custom";

// #37+#38 — 평소가 = 해당 수익원의 최근 실지출 중앙값 (서버 getIncomeSourceUsual과 같은 규칙).
// excludeId: 상세 시트에서 보고 있는 기록 자신은 '평소'에서 뺀다. 표본 2건 미만이면 null.
export function incomeSourceUsual(
  entries: SavingsEntry[],
  source: string | null | undefined,
  excludeId?: number
): { usualActual: number; sample: number } | null {
  if (!source) return null;
  const pool = entries
    .filter((e) => e.incomeSource === source && e.id !== excludeId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 20);
  if (pool.length < 2) return null;
  const sorted = pool.map((e) => e.actualAmount).sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  const usualActual =
    sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid] + sorted[mid + 1]) / 2);
  return { usualActual, sample: pool.length };
}

export const fmt = (n: number) => n.toLocaleString("ko-KR");
export const todayStr = () => new Date().toISOString().split("T")[0];
export const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function makeDefaultTitle(dateStr: string, category: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dow = KO_DAYS[d.getDay()];
  return `${mm}.${dd}.(${dow}) ${category}`;
}


export function filterByRange(entries: SavingsEntry[], range: ExportRange, from: string, to: string) {
  const now = new Date();
  if (range === "all") return entries;
  if (range === "month") {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return entries.filter(e => e.date.startsWith(ym));
  }
  if (range === "week") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const monStr = mon.toISOString().split("T")[0];
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const sunStr = sun.toISOString().split("T")[0];
    return entries.filter(e => e.date >= monStr && e.date <= sunStr);
  }
  if (range === "custom") return entries.filter(e => e.date >= from && e.date <= to);
  return entries;
}


export function toMarkdownTable(entries: SavingsEntry[]) {
  const header = "| 날짜 | 항목 | 카테고리 | 수익원 | 4분류 | 시중가 | 시장에 보낸 돈 | 수익 | 메모 |";
  const sep = "|------|------|----------|--------|-------|--------|----------------|------|------|";
  const rows = entries.map((e) => {
    const kind = PROFIT_KIND_LABELS[resolveProfitKind(e) as ProfitKind];
    return `| ${e.date} | ${e.title} | ${e.category} | ${e.incomeSource ?? "미분류"} | ${kind} | ${fmt(e.originalAmount)}원 | ${fmt(e.actualAmount)}원 | ${fmt(e.profit)}원 | ${e.memo ?? ""} |`;
  });
  const total = entries.reduce((s, e) => s + e.profit, 0);
  return [header, sep, ...rows].join("\n") + `\n\n**총 계상 수익: ${fmt(total)}원** (${entries.length}건)`;
}


export function toCsv(entries: SavingsEntry[]) {
  const header = `날짜,항목,카테고리,수익원,4분류,${LEDGER_LABELS.original},${LEDGER_LABELS.actual},수익,메모,추정`;
  const rows = entries.map((e) => {
    const kind = PROFIT_KIND_LABELS[resolveProfitKind(e) as ProfitKind];
    return [
      e.date, `"${e.title}"`, e.category, e.incomeSource ?? "미분류", kind,
      e.originalAmount, e.actualAmount, e.profit,
      `"${(e.memo ?? "").replace(/"/g, '""')}"`,
      e.aiEstimated === "yes" ? "Y" : "N",
    ].join(",");
  });
  return [header, ...rows].join("\n");
}
