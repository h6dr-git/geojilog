// #51 — 통계 헬퍼(순수 함수) 검증
import { describe, expect, it } from "vitest";
import { monthHeatmap, allTimeRecords, cumulativeCurve, dayOfWeekRhythm } from "../client/src/lib/stats";
import type { SavingsEntry } from "../client/src/lib/ledger";

const mk = (id: number, date: string, profit: number): SavingsEntry => ({
  id, date, title: `t${id}`, category: "식비", ticker: "FOOD-001",
  originalAmount: profit + 1000, actualAmount: 1000, profit,
  aiEstimated: "no", createdAt: new Date(date), userId: 1,
});

describe("monthHeatmap", () => {
  it("일별 합산과 강도(최대 기준 정규화)를 만든다", () => {
    const data = monthHeatmap([mk(1, "2026-06-03", 4000), mk(2, "2026-06-03", 2000), mk(3, "2026-06-10", 3000)], "2026-06");
    expect(data).toHaveLength(30);
    expect(data[2]).toEqual({ day: 3, profit: 6000, intensity: 1 });
    expect(data[9].profit).toBe(3000);
    expect(data[9].intensity).toBeCloseTo(0.5);
    expect(data[0].intensity).toBe(0);
  });
});

describe("allTimeRecords", () => {
  it("끼당 평균·최고 주간·최장 연속을 계산한다", () => {
    const entries = [
      mk(1, "2026-06-01", 3000), // 월 (6/1 주)
      mk(2, "2026-06-02", 5000), // 화 — 연속 2일
      mk(3, "2026-06-03", 1000), // 수 — 연속 3일
      mk(4, "2026-06-09", 2000), // 다음 주 화
    ];
    const r = allTimeRecords(entries);
    expect(r.avgPerEntry).toBe(2750); // 11000/4
    expect(r.longestStreak).toBe(3);
    expect(r.bestWeek).toEqual({ start: "2026-06-01", profit: 9000 });
  });
  it("빈 입력은 0/null", () => {
    expect(allTimeRecords([])).toEqual({ avgPerEntry: 0, bestWeek: null, longestStreak: 0 });
  });
});

describe("cumulativeCurve", () => {
  it("날짜순 누적 합을 만든다", () => {
    const pts = cumulativeCurve([mk(1, "2026-06-02", 2000), mk(2, "2026-06-01", 1000), mk(3, "2026-06-02", 500)]);
    expect(pts).toEqual([
      { date: "2026-06-01", cum: 1000 },
      { date: "2026-06-02", cum: 3500 },
    ]);
  });
});

describe("dayOfWeekRhythm", () => {
  it("요일 버킷(0=월)에 평균을 담는다", () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // 가장 최근 화요일
    const tue = new Date(today);
    tue.setDate(tue.getDate() - ((tue.getDay() + 5) % 7));
    const isoTue = `${tue.getFullYear()}-${String(tue.getMonth() + 1).padStart(2, "0")}-${String(tue.getDate()).padStart(2, "0")}`;
    const r = dayOfWeekRhythm([mk(1, isoTue, 8000)], 8);
    expect(r[1].avg).toBe(1000); // 화요일 버킷, 8주 평균
    expect(r[0].avg).toBe(0);
  });
});
