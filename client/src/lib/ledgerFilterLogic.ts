import { UNCLASSIFIED } from "@shared/incomeSources";
import type { SavingsEntry } from "@/lib/ledger";
import { UNCLASSIFIED_KEY } from "../pages/ledger/types";

export function filterByWeekOrDate(
  entries: SavingsEntry[],
  monthEntries: SavingsEntry[],
  weekFilter: { start: string; end: string } | null,
  filterDate: string | null,
): SavingsEntry[] {
  if (weekFilter) return entries.filter((e) => e.date >= weekFilter.start && e.date <= weekFilter.end);
  if (filterDate) return monthEntries.filter((e) => e.date === filterDate);
  return monthEntries;
}

export function filterBySearch(entries: SavingsEntry[], search: string): SavingsEntry[] {
  const q = search.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.title.toLowerCase().includes(q) || (e.memo ?? "").toLowerCase().includes(q),
  );
}

export function buildSourceCounts(entries: SavingsEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const k = e.incomeSource ?? UNCLASSIFIED_KEY;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function filterBySource(entries: SavingsEntry[], sourceFilter: string | null): SavingsEntry[] {
  if (!sourceFilter) return entries;
  return entries.filter((e) =>
    sourceFilter === UNCLASSIFIED_KEY ? !e.incomeSource : e.incomeSource === sourceFilter,
  );
}

export function groupEntriesByDate(entries: SavingsEntry[]): [string, SavingsEntry[]][] {
  const map = new Map<string, SavingsEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function buildPeriodLabel(
  weekFilter: { start: string; end: string } | null,
  filterDate: string | null,
  search: string,
  sourceFilter: string | null,
  month: number,
  koDays: readonly string[],
): string {
  if (weekFilter) return `${weekFilter.start.slice(5).replace("-", ".")} ~ ${weekFilter.end.slice(5).replace("-", ".")}`;
  if (filterDate) {
    const d = new Date(filterDate + "T00:00:00");
    return `${d.getDate()}일 (${koDays[d.getDay()]})`;
  }
  if (search.trim()) return "검색";
  if (sourceFilter) return sourceFilter === UNCLASSIFIED_KEY ? UNCLASSIFIED : sourceFilter;
  return `${month + 1}월`;
}

export function buildCalWeeks(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function profitByDateFromEntries(entries: SavingsEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) map[e.date] = (map[e.date] ?? 0) + e.profit;
  return map;
}
