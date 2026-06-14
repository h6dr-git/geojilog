import { describe, it, expect } from "vitest";
import { aggregateTopProfitKind, computeReport } from "./report";
import type { SavingsEntry } from "./ledger";

const entry = (over: Partial<SavingsEntry> & Pick<SavingsEntry, "id" | "profit">): SavingsEntry => ({
  date: "2026-06-10",
  title: "테스트",
  category: "식비",
  ticker: "T",
  originalAmount: 10000,
  actualAmount: 5000,
  aiEstimated: "no",
  createdAt: new Date("2026-06-10"),
  userId: 1,
  ...over,
});

describe("aggregateTopProfitKind", () => {
  it("수익 합이 가장 큰 4분류를 반환한다", () => {
    const entries = [
      entry({ id: 1, profit: 3000, profitKind: "save" }),
      entry({ id: 2, profit: 8000, profitKind: "receive", incomeSource: "얻어먹음", actualAmount: 0 }),
      entry({ id: 3, profit: 2000, profitKind: "save" }),
    ];
    const top = aggregateTopProfitKind(entries);
    expect(top?.kind).toBe("receive");
    expect(top?.label).toBe("받음형");
    expect(top?.profit).toBe(8000);
  });

  it("기록이 없거나 수익 0이면 null", () => {
    expect(aggregateTopProfitKind([])).toBeNull();
    expect(aggregateTopProfitKind([entry({ id: 1, profit: 0 })])).toBeNull();
  });
});

describe("computeReport", () => {
  it("기간 내 topProfitKind를 포함한다", () => {
    const entries = [
      entry({ id: 1, date: "2026-06-09", profit: 1000, profitKind: "earn", incomeSource: "알바" }),
      entry({ id: 2, date: "2026-06-10", profit: 5000, profitKind: "save" }),
    ];
    const report = computeReport(entries, "week", "2026-06-09", "2026-06-14");
    expect(report.topProfitKind?.kind).toBe("save");
    expect(report.topProfitKind?.profit).toBe(5000);
  });
});
