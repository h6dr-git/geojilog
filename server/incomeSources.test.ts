// #37+#38 수익원 — 휴리스틱 분류·유형 입력 검증·중앙값(클라 헬퍼) 테스트
import { describe, expect, it } from "vitest";
import { guessIncomeSource, isIncomeSource, INCOME_SOURCES } from "@shared/incomeSources";
import { incomeSourceUsual, SavingsEntry } from "../client/src/lib/ledger";
import { appRouter } from "./routers";
import type { TrpcContext } from "./context";

function createAuthContext(): { ctx: TrpcContext } {
  const user: NonNullable<TrpcContext["user"]> = {
    id: 1, openId: "test-user-001", email: "t@e.com", name: "T", loginMethod: "anonymous",
    role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

describe("guessIncomeSource — 백필 휴리스틱", () => {
  it("대표 키워드를 올바른 수익원으로 분류한다", () => {
    expect(guessIncomeSource("천원아침 학식")).toBe("천원아침"); // 우선순위: 천원 > 학식
    expect(guessIncomeSource("학생식당 제육")).toBe("학식/구내");
    expect(guessIncomeSource("도시락 싸감")).toBe("집밥/해먹음");
    expect(guessIncomeSource("선배가 사줌")).toBe("얻어먹음");
    expect(guessIncomeSource("동아리 행사 무료 피자")).toBe("공짜/이벤트");
    expect(guessIncomeSource("마감 할인 샌드위치")).toBe("할인/쿠폰");
    expect(guessIncomeSource("치킨 엔빵")).toBe("엔빵/공구");
    expect(guessIncomeSource("커피 참았다")).toBe("참음/대체");
  });
  it("단서가 없으면 null (억지 분류 금지)", () => {
    expect(guessIncomeSource("김치찌개")).toBeNull();
    expect(guessIncomeSource("")).toBeNull();
  });
});

describe("isIncomeSource — 서버 검증 가드", () => {
  it("목록 안의 값만 통과시킨다", () => {
    for (const s of INCOME_SOURCES) expect(isIncomeSource(s)).toBe(true);
    expect(isIncomeSource("점메추")).toBe(false);
    expect(isIncomeSource(null)).toBe(false);
  });
});

describe("savings.create — 수익원 입력 검증", () => {
  it("목록에 없는 수익원은 거부한다", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.savings.create({
        date: "2026-06-11", title: "학식", category: "식비",
        originalAmount: 8000, actualAmount: 3000, aiEstimated: "no",
        incomeSource: "없는유형" as never,
      })
    ).rejects.toThrow();
  });
});

describe("incomeSourceUsual — 평소가(중앙값)", () => {
  const mk = (id: number, actual: number, src: string | null, date = "2026-06-01"): SavingsEntry => ({
    id, date, title: `t${id}`, category: "식비", incomeSource: src, ticker: "FOOD-001",
    originalAmount: actual + 5000, actualAmount: actual, profit: 5000,
    aiEstimated: "no", createdAt: new Date("2026-06-01"), userId: 1,
  });
  it("홀수 표본은 중앙값, 자기 자신은 제외", () => {
    const entries = [mk(1, 1000, "학식/구내"), mk(2, 3000, "학식/구내"), mk(3, 9000, "학식/구내")];
    expect(incomeSourceUsual(entries, "학식/구내")?.usualActual).toBe(3000);
    // id=2(3000) 제외 → [1000, 9000] 짝수 표본 → 평균 5000
    expect(incomeSourceUsual(entries, "학식/구내", 2)?.usualActual).toBe(5000);
  });
  it("표본 2건 미만이거나 미분류면 null", () => {
    expect(incomeSourceUsual([mk(1, 1000, "학식/구내")], "학식/구내")).toBeNull();
    expect(incomeSourceUsual([mk(1, 1000, null), mk(2, 2000, null)], null)).toBeNull();
  });
});
