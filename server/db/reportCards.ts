// #50 서가 — 소장된 결산 카드. 같은 기간은 1장(재소장 = 스킨 갱신).
import { and, desc, eq } from "drizzle-orm";
import { reportCards } from "../../drizzle/schema";
import { getDb } from "./client";

export async function listReportCards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reportCards)
    .where(eq(reportCards.userId, userId))
    .orderBy(desc(reportCards.startDate), desc(reportCards.createdAt));
}

export async function upsertReportCard(
  userId: number,
  data: { periodType: "week" | "month"; startDate: string; theme: string; stickers: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select({ id: reportCards.id })
    .from(reportCards)
    .where(and(
      eq(reportCards.userId, userId),
      eq(reportCards.periodType, data.periodType),
      eq(reportCards.startDate, data.startDate)
    ))
    .limit(1);
  if (existing[0]) {
    await db.update(reportCards)
      .set({ theme: data.theme, stickers: data.stickers })
      .where(eq(reportCards.id, existing[0].id));
    return { id: existing[0].id, updated: true };
  }
  const [row] = await db.insert(reportCards)
    .values({ userId, ...data })
    .returning({ id: reportCards.id });
  return { id: row.id, updated: false };
}

export async function deleteReportCard(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reportCards).where(and(eq(reportCards.userId, userId), eq(reportCards.id, id)));
}
