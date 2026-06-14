// profitKind 백필 — 마이그레이션 DEFAULT 'save' 보정 라운드트립
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = `file:/tmp/geoji-pk-test-${Date.now()}.db`;

describe("profitKind DB backfill", () => {
  it("DEFAULT save를 수익원 패턴에 맞게 보정한다", async () => {
    const db = await import("./db");
    const userId = 88;

    await db.createSavingsEntry({
      userId,
      date: "2026-06-01",
      title: "친구가 사줌",
      category: "식비",
      ticker: "F-1",
      incomeSource: "얻어먹음",
      originalAmount: 8000,
      actualAmount: 0,
      profit: 8000,
      profitKind: "save",
      aiEstimated: "no",
    });
    await db.createSavingsEntry({
      userId,
      date: "2026-06-02",
      title: "알바",
      category: "기타",
      ticker: "J-1",
      incomeSource: "알바",
      originalAmount: 50000,
      actualAmount: 0,
      profit: 50000,
      profitKind: "save",
      aiEstimated: "no",
    });

    const r = await db.backfillProfitKinds(userId);
    expect(r.updated).toBe(2);

    const entries = await db.getSavingsEntries(userId);
    expect(entries.find((e) => e.title === "친구가 사줌")?.profitKind).toBe("receive");
    expect(entries.find((e) => e.title === "알바")?.profitKind).toBe("earn");

    // 멱등 — 두 번째 실행은 0건
    const again = await db.backfillProfitKinds(userId);
    expect(again.updated).toBe(0);
  });

  it("사용자가 save 외 유형을 고른 기록은 덮어쓰지 않는다", async () => {
    const db = await import("./db");
    const userId = 89;

    await db.createSavingsEntry({
      userId,
      date: "2026-06-03",
      title: "의도적 절약",
      category: "식비",
      ticker: "F-2",
      incomeSource: "얻어먹음",
      originalAmount: 5000,
      actualAmount: 0,
      profit: 5000,
      profitKind: "save",
      aiEstimated: "no",
    });
    await db.updateSavingsEntry(
      (await db.getSavingsEntries(userId))[0].id,
      userId,
      { profitKind: "restrain" }
    );

    const r = await db.backfillProfitKinds(userId);
    expect(r.updated).toBe(0);
    expect((await db.getSavingsEntries(userId))[0].profitKind).toBe("restrain");
  });
});
