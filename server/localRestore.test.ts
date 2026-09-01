import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import {
  chooseNewestSource,
  restoreSnapshot,
  type RecoverySnapshot,
  verifyRestoredSnapshot,
} from "../scripts/local-restore-core";

const snapshot: RecoverySnapshot = {
  source: "test",
  ownerId: 2,
  newestCreatedAt: 1_780_000_000,
  lastEntryDate: "2026-06-20",
  tables: {
    users: [
      {
        id: 2,
        openId: "kakao_test_owner",
        name: "사장님",
        email: null,
        loginMethod: "kakao",
        role: "user",
        createdAt: 1_780_000_000,
        updatedAt: 1_780_000_000,
        lastSignedIn: 1_780_000_000,
      },
    ],
    savings_entries: [
      {
        id: 10,
        userId: 2,
        date: "2026-06-20",
        title: "복구 테스트",
        description: null,
        category: "기타",
        incomeSource: null,
        ticker: "ETC-001",
        originalAmount: 1000,
        actualAmount: 500,
        profit: 500,
        aiEstimated: "no",
        aiReason: null,
        savingsSteps: null,
        imageUrl: "/manus-storage/u2/test.jpg",
        imageSig: null,
        memo: null,
        createdAt: 1_780_000_000,
        aiPeopleCount: null,
        aiGroupOriginalAmount: null,
        aiGroupActualAmount: null,
        profitKind: "save",
        userPriceNote: null,
      },
    ],
    user_categories: [],
    usage_events: [],
    push_subscriptions: [],
    feedbacks: [],
    report_cards: [],
    user_income_sources: [],
    user_items: [],
  },
};

describe("local restore core", () => {
  it("selects the freshest owner source", () => {
    const backup = {
      source: "backup-json" as const,
      ownerId: 2,
      entries: 18,
      newestCreatedAt: 100,
      lastEntryDate: "2026-06-14",
    };
    const remote = {
      source: "remote-readonly" as const,
      ownerId: 2,
      entries: 30,
      newestCreatedAt: 200,
      lastEntryDate: "2026-06-20",
    };
    expect(chooseNewestSource(backup, remote)).toBe(remote);
    expect(chooseNewestSource(backup, null)).toBe(backup);
  });

  it("restores and verifies an isolated in-memory database", async () => {
    const db = createClient({ url: "file::memory:" });
    await restoreSnapshot(db, snapshot);
    const verified = await verifyRestoredSnapshot(db, snapshot);
    expect(verified.integrity).toBe("ok");
    expect(verified.counts.users).toBe(1);
    expect(verified.counts.savings_entries).toBe(1);
    const row = await db.execute("SELECT title, profit FROM savings_entries WHERE userId = 2");
    expect(row.rows[0]).toMatchObject({ title: "복구 테스트", profit: 500 });
    db.close();
  });
});
