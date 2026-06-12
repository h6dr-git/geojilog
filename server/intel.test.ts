// #60 — 회시생 인텔 합성(순수 함수) 검증: 숫자 있을 때만 말하고, 표본 부족이면 침묵
import { describe, expect, it } from "vitest";
import { intelRevealLine, intelWeeklyLine, meaningOfTotal } from "../client/src/lib/intel";
import type { SavingsEntry } from "../client/src/lib/ledger";

const mk = (id: number, date: string, profit: number, src: string | null = "학식/구내"): SavingsEntry => ({
  id, date, title: `t${id}`, category: "식비", incomeSource: src, ticker: "FOOD-001",
  originalAmount: profit + 1000, actualAmount: 1000, profit,
  aiEstimated: "no", createdAt: new Date(date), userId: 1,
});

describe("intelRevealLine", () => {
  it("표본 3건부터 단건 신기록을 보고한다", () => {
    const entries = [mk(1, "2026-06-01", 3000), mk(2, "2026-06-02", 5000), mk(3, "2026-06-03", 2000)];
    expect(intelRevealLine(entries, { profit: 9000 })).toContain("최고 수익 갱신");
    expect(intelRevealLine(entries, { profit: 9000 })).toContain("5,000");
  });
  it("신기록 아니고 조건 미달이면 침묵(null)", () => {
    const entries = [mk(1, "2026-05-01", 9000), mk(2, "2026-05-02", 5000), mk(3, "2026-05-03", 2000)];
    expect(intelRevealLine(entries, { profit: 100 })).toBeNull();
  });
  it("10번째 거래 마일스톤", () => {
    const entries = Array.from({ length: 9 }, (_, i) => mk(i + 1, `2026-05-${String(i + 1).padStart(2, "0")}`, 50000));
    expect(intelRevealLine(entries, { profit: 100 })).toContain("10번째 거래");
  });
});

describe("intelWeeklyLine", () => {
  const range = { start: "2026-06-08", end: "2026-06-14" };
  it("수익원 다변화를 보고한다", () => {
    const entries = [
      mk(1, "2026-06-01", 1000, "학식/구내"), // 지난주 1종
      mk(2, "2026-06-08", 1000, "학식/구내"),
      mk(3, "2026-06-09", 1000, "천원아침"),
      mk(4, "2026-06-10", 1000, "얻어먹음"), // 이번 주 3종
    ];
    expect(intelWeeklyLine(entries, range)).toContain("3종으로 다변화");
  });
  it("지난주 기록이 없으면 페이스 비교는 침묵", () => {
    const entries = [mk(1, "2026-06-08", 1000, "학식/구내")];
    expect(intelWeeklyLine(entries, range)).toBeNull();
  });
});

describe("meaningOfTotal", () => {
  it("1만 미만은 침묵, 이상은 환산", () => {
    expect(meaningOfTotal(9000)).toBeNull();
    expect(meaningOfTotal(182000)).toContain("치킨 9마리");
    expect(meaningOfTotal(182000)).toContain("천원아침 182끼");
  });
});
