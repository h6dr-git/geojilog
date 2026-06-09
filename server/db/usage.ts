import { eq } from "drizzle-orm";
import { usageEvents } from "../../drizzle/schema";
import { getDb } from "./client";

// ── Usage events (사용량 측정 + AI 호출 제한) ──────────────────────────
// AI 호출로 집계되는 이벤트 타입(하루 한도에 포함).
export const AI_EVENT_TYPES = ["ai_analyze_image", "ai_parse_sms"] as const;

/** KST(UTC+9) 기준 오늘 자정의 시각. 하루 한도/일별 집계 기준. */
function kstStartOfToday(): Date {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const utcMidnight = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  return new Date(utcMidnight - 9 * 60 * 60 * 1000);
}

/** 사용량 이벤트 1건 기록. 측정 실패가 본 기능을 막지 않도록 조용히 무시한다. */
export async function logUsageEvent(userId: number, type: string, meta?: string | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(usageEvents).values({ userId, type, meta: meta ?? null });
  } catch (e) {
    console.warn("[usage] 이벤트 기록 실패:", e);
  }
}

/** 오늘(KST) 이 유저의 AI 분석 호출 횟수. 하루 한도 체크에 사용. */
export async function countAiCallsToday(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { and, count, gte, inArray } = await import("drizzle-orm");
  const [row] = await db
    .select({ n: count() })
    .from(usageEvents)
    .where(and(
      eq(usageEvents.userId, userId),
      inArray(usageEvents.type, [...AI_EVENT_TYPES]),
      gte(usageEvents.createdAt, kstStartOfToday()),
    ));
  return row?.n ?? 0;
}

/** 운영 지표: 오늘/최근 7일 활성 유저·AI 호출·기록 수. (admin 전용) */
export async function getUsageStats() {
  const empty = {
    today: { activeUsers: 0, aiCalls: 0, entries: 0 },
    last7d: { activeUsers: 0, aiCalls: 0 },
  };
  const db = await getDb();
  if (!db) return empty;
  const { and, count, countDistinct, gte, inArray } = await import("drizzle-orm");
  const aiTypes = [...AI_EVENT_TYPES];
  const startToday = kstStartOfToday();
  const start7d = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [tActive] = await db.select({ n: countDistinct(usageEvents.userId) })
    .from(usageEvents).where(gte(usageEvents.createdAt, startToday));
  const [tAi] = await db.select({ n: count() })
    .from(usageEvents).where(and(gte(usageEvents.createdAt, startToday), inArray(usageEvents.type, aiTypes)));
  const [tEntries] = await db.select({ n: count() })
    .from(usageEvents).where(and(gte(usageEvents.createdAt, startToday), eq(usageEvents.type, "entry_create")));
  const [wActive] = await db.select({ n: countDistinct(usageEvents.userId) })
    .from(usageEvents).where(gte(usageEvents.createdAt, start7d));
  const [wAi] = await db.select({ n: count() })
    .from(usageEvents).where(and(gte(usageEvents.createdAt, start7d), inArray(usageEvents.type, aiTypes)));

  return {
    today: { activeUsers: tActive?.n ?? 0, aiCalls: tAi?.n ?? 0, entries: tEntries?.n ?? 0 },
    last7d: { activeUsers: wActive?.n ?? 0, aiCalls: wAi?.n ?? 0 },
  };
}
