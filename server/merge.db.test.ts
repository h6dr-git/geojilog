// B1 (#54 게이트) — 게스트→카카오 병합이 전 테이블을 옮기는지 라운드트립 검증
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = `file:/tmp/geoji-merge-${Date.now()}.db`;

describe("mergeUserData — 전 테이블 병합", () => {
  it("기록·서가·커스텀 수익원·단골·이벤트가 모두 따라온다 (유니크 충돌은 to 우선)", async () => {
    const db = await import("./db");
    const guest = 901, kakao = 902;

    // 게스트 데이터 일습
    await db.createSavingsEntry({ userId: guest, date: "2026-06-10", title: "학식", category: "식비", ticker: "FOOD-001", originalAmount: 8000, actualAmount: 3000, profit: 5000, aiEstimated: "no", incomeSource: "학식/구내" });
    await db.upsertReportCard(guest, { periodType: "week", startDate: "2026-06-08", theme: "gold", stickers: '["jar"]' });
    await db.upsertReportCard(guest, { periodType: "month", startDate: "2026-06-01", theme: "hanji", stickers: "[]" });
    await db.createUserIncomeSource(guest, "중고거래");
    await db.createUserIncomeSource(guest, "쿠폰조합");
    await db.upsertItemFromEntry(guest, { title: "학식", category: "식비", originalAmount: 8000, actualAmount: 3000, date: "2026-06-10" });
    await db.logUsageEvent(guest, "entry_create");

    // 카카오 쪽에 충돌 데이터 (같은 주 카드, 같은 이름 수익원)
    await db.upsertReportCard(kakao, { periodType: "week", startDate: "2026-06-08", theme: "forest", stickers: "[]" });
    await db.createUserIncomeSource(kakao, "중고거래");

    await db.mergeUserData(guest, kakao);

    // 기록 이동
    expect((await db.getSavingsEntries(kakao)).length).toBe(1);
    expect((await db.getSavingsEntries(guest)).length).toBe(0);
    // 서가: 주간(충돌)=to의 forest 유지, 월간(비충돌)=이동 → 총 2장, 게스트 0장
    const cards = await db.listReportCards(kakao);
    expect(cards).toHaveLength(2);
    expect(cards.find((c) => c.periodType === "week")?.theme).toBe("forest");
    expect(await db.listReportCards(guest)).toHaveLength(0);
    // 커스텀 수익원: 중고거래(충돌)=1개 유지 + 쿠폰조합 이동 → 2개
    const srcs = await db.listUserIncomeSources(kakao);
    expect(srcs.map((s) => s.name).sort()).toEqual(["중고거래", "쿠폰조합"]);
    expect(await db.listUserIncomeSources(guest)).toHaveLength(0);
    // 단골 이동
    expect(await db.getItemByName(kakao, "학식")).not.toBeNull();
    expect(await db.getItemByName(guest, "학식")).toBeNull();
  });
});
