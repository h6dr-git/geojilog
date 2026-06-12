// #58 — 업무 지시(서면 피드백) 라우터. 세계관: 사장님이 회시생에게 내리는 지시.
// 수집 → /ops 인박스 → 반영 → 회신(close the loop)이 베타 루프의 골격.
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getDb } from "../db";
import { feedbacks } from "../../drizzle/schema";
import { desc, eq, gte, count, and } from "drizzle-orm";

const DAILY_LIMIT = 10; // 도배 방어

export const feedbackRouter = router({
  submit: protectedProcedure
    .input(z.object({ text: z.string().trim().min(2).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [n] = await db.select({ n: count() }).from(feedbacks)
        .where(and(eq(feedbacks.userId, ctx.user.id), gte(feedbacks.createdAt, dayAgo)));
      if ((n?.n ?? 0) >= DAILY_LIMIT) throw new Error("오늘 지시가 많았습니다. 내일 다시 부탁드립니다.");
      await db.insert(feedbacks).values({ userId: ctx.user.id, text: input.text });
      return { ok: true };
    }),

  // 운영(ops)용 — 최근 지시 목록 (계기판이 서버 렌더로 직접 호출)
});

export async function listRecentFeedbacks(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt)).limit(limit);
}
