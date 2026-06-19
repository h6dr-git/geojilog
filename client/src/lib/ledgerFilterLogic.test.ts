import { describe, it, expect } from "vitest";
import type { SavingsEntry } from "@/lib/ledger";
import { UNCLASSIFIED_KEY } from "@/pages/ledger/types";
import {
  filterBySearch,
  filterBySource,
  groupEntriesByDate,
  buildCalWeeks,
  buildPeriodLabel,
  profitByDateFromEntries,
} from "./ledgerFilterLogic";

const entry = (over: Partial<SavingsEntry> & Pick<SavingsEntry, "id" | "date" | "title" | "profit">): SavingsEntry => ({
  category: "식비",
  ticker: "식",
  originalAmount: 9000,
  actualAmount: 3000,
  memo: "",
  incomeSource: null,
  profitKind: "save",
  imageUrl: null,
  aiEstimated: "no",
  createdAt: new Date("2026-06-01"),
  userId: 1,
  ...over,
});

describe("ledgerFilterLogic", () => {
  const rows = [
    entry({ id: 1, date: "2026-06-01", title: "학식", profit: 6000, incomeSource: "학식" }),
    entry({ id: 2, date: "2026-06-01", title: "커피", profit: 3000, memo: "아아" }),
    entry({ id: 3, date: "2026-06-02", title: "버스", profit: 1500 }),
  ];

  it("검색 — 제목·메모", () => {
    expect(filterBySearch(rows, "커피").map((e) => e.id)).toEqual([2]);
    expect(filterBySearch(rows, "아아").map((e) => e.id)).toEqual([2]);
  });

  it("수익원 필터 — 미분류", () => {
    expect(filterBySource(rows, UNCLASSIFIED_KEY).map((e) => e.id)).toEqual([2, 3]);
    expect(filterBySource(rows, "학식").map((e) => e.id)).toEqual([1]);
  });

  it("날짜별 그룹 — 최신 날짜 먼저", () => {
    expect(groupEntriesByDate(rows).map(([d, items]) => [d, items.length])).toEqual([
      ["2026-06-02", 1],
      ["2026-06-01", 2],
    ]);
  });

  it("달력 주 — 6월 2026", () => {
    const weeks = buildCalWeeks(2026, 5);
    expect(weeks[0][0]).toBeNull();
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("기간 라벨", () => {
    expect(buildPeriodLabel(null, null, "", null, 5, ["일", "월", "화", "수", "목", "금", "토"])).toBe("6월");
    expect(buildPeriodLabel(null, "2026-06-03", "", null, 5, ["일", "월", "화", "수", "목", "금", "토"])).toBe("3일 (수)");
  });

  it("일별 수익 합", () => {
    expect(profitByDateFromEntries(rows)).toEqual({
      "2026-06-01": 9000,
      "2026-06-02": 1500,
    });
  });
});
