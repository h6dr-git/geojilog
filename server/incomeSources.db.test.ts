// #37+#38 — 실제 libsql 파일 DB로 마이그레이션(ALTER)·백필·평소가 중앙값 라운드트립 검증.
// DATABASE_URL을 임시 파일로 바꾼 뒤 동적 import — 모듈 로드 시점 캐시를 피한다.
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = `file:/tmp/geoji-test-${Date.now()}.db`;

describe("수익원 DB 라운드트립 (마이그레이션·백필·중앙값)", () => {
  it("생성→백필→평소가 계산이 한 사이클로 돈다", async () => {
    const db = await import("./db");
    const userId = 77;

    // 미분류로 3건 생성 (제목에 휴리스틱 단서)
    await db.createSavingsEntry({ userId, date: "2026-06-01", title: "학생식당 제육", category: "식비", ticker: "FOOD-001", originalAmount: 8000, actualAmount: 3000, profit: 5000, aiEstimated: "no" });
    await db.createSavingsEntry({ userId, date: "2026-06-02", title: "학식 김치찌개", category: "식비", ticker: "FOOD-002", originalAmount: 8000, actualAmount: 4000, profit: 4000, aiEstimated: "no" });
    await db.createSavingsEntry({ userId, date: "2026-06-03", title: "김밥", category: "식비", ticker: "FOOD-003", originalAmount: 5000, actualAmount: 2000, profit: 3000, aiEstimated: "no" });

    // 백필 — 학식 2건 분류, 김밥은 단서 없음 → 미분류 잔류
    const r = await db.backfillIncomeSources(userId);
    expect(r.classified).toBe(2);
    expect(r.remaining).toBe(1);

    // 평소가 = 학식/구내 실지출 [3000, 4000] 중앙값 = 3500
    const usual = await db.getIncomeSourceUsual(userId, "학식/구내");
    expect(usual?.usualActual).toBe(3500);
    expect(usual?.sample).toBe(2);

    // 표본 1건 이하인 유형은 null
    expect(await db.getIncomeSourceUsual(userId, "천원아침")).toBeNull();

    // update로 수익원 직접 지정 → 미분류 해소
    const entries = await db.getSavingsEntries(userId);
    const gimbap = entries.find((e) => e.title === "김밥")!;
    await db.updateSavingsEntry(gimbap.id, userId, { incomeSource: "참음/대체" });
    const after = await db.getSavingsEntries(userId);
    expect(after.find((e) => e.id === gimbap.id)?.incomeSource).toBe("참음/대체");
  });
});
