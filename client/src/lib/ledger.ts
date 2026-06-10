// 거지로그 — 장부 공용 타입·유틸 (Ledger·상세시트·Wrapped 등 공유)

export interface SavingsEntry {
  id: number;
  date: string;
  title: string;
  description?: string | null;
  category: string;
  ticker: string;
  originalAmount: number;
  actualAmount: number;
  profit: number;
  aiEstimated: "yes" | "no";
  aiReason?: string | null;
  imageUrl?: string | null;
  memo?: string | null;
  createdAt: Date;
  userId: number;
}

export type ExportRange = "all" | "month" | "week" | "custom";

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
  const header = "| 날짜 | 항목 | 카테고리 | 원가 | 실제지출 | 절약수익 | 메모 |";
  const sep = "|------|------|----------|------|----------|----------|------|";
  const rows = entries.map(e =>
    `| ${e.date} | ${e.title} | ${e.category} | ${fmt(e.originalAmount)}원 | ${fmt(e.actualAmount)}원 | ${fmt(e.profit)}원 | ${e.memo ?? ""} |`
  );
  const total = entries.reduce((s, e) => s + e.profit, 0);
  return [header, sep, ...rows].join("\n") + `\n\n**총 절약 수익: ${fmt(total)}원** (${entries.length}건)`;
}


export function toCsv(entries: SavingsEntry[]) {
  const header = "날짜,항목,카테고리,원가,실제지출,절약수익,메모,AI추정";
  const rows = entries.map(e =>
    [
      e.date, `"${e.title}"`, e.category,
      e.originalAmount, e.actualAmount, e.profit,
      `"${(e.memo ?? "").replace(/"/g, '""')}"`,
      e.aiEstimated === "yes" ? "Y" : "N",
    ].join(",")
  );
  return [header, ...rows].join("\n");
}
