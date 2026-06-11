// 단골 사전 (P2 2차 · #37) — 기록에서 자동 축적되는 '내 항목'과 가격(기준가·평소가).
import { and, desc, eq } from "drizzle-orm";
import { userItems, savingsEntries } from "../../drizzle/schema";
import { getDb } from "./client";

const norm = (s: string) => s.trim().toLowerCase();
// 자동 생성 제목("06.10.(화) 식비")은 사전에 넣지 않는다 — 항목이 아니라 날짜라서
const isAutoDateTitle = (t: string) => /^\d{2}\.\d{2}\.\(/.test(t.trim());

// 기록 저장 시 사전 자동 축적: 새 항목이면 생성, 있으면 사용횟수·날짜 갱신.
// pinned(사용자 관리) 항목은 가격을 자동으로 덮어쓰지 않는다.
export async function upsertItemFromEntry(
  userId: number,
  e: { title: string; category: string; originalAmount: number; actualAmount: number; date: string }
) {
  const db = await getDb();
  if (!db) return;
  const n = norm(e.title);
  if (!n || isAutoDateTitle(e.title)) return;
  const existing = await db
    .select()
    .from(userItems)
    .where(and(eq(userItems.userId, userId), eq(userItems.normName, n)))
    .limit(1);
  if (existing[0]) {
    const it = existing[0];
    await db
      .update(userItems)
      .set({
        timesUsed: it.timesUsed + 1,
        lastDate: e.date,
        name: e.title.trim(),
        category: e.category,
        ...(it.pinned === "yes"
          ? {}
          : { usualOriginal: e.originalAmount, usualActual: e.actualAmount }),
      })
      .where(eq(userItems.id, it.id));
  } else {
    await db.insert(userItems).values({
      userId,
      name: e.title.trim(),
      normName: n,
      category: e.category,
      usualOriginal: e.originalAmount,
      usualActual: e.actualAmount,
      lastDate: e.date,
    });
  }
}

// 사전 목록 — 고정(pinned) 우선, 그다음 자주 쓴 순.
// 사전이 비어 있으면 기존 기록으로 1회 백필(단골 사전 도입 전 사용자 대응).
export async function listItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  let rows = await db
    .select()
    .from(userItems)
    .where(eq(userItems.userId, userId))
    .orderBy(desc(userItems.pinned), desc(userItems.timesUsed), desc(userItems.lastDate));
  if (rows.length === 0) {
    const entries = await db
      .select()
      .from(savingsEntries)
      .where(eq(savingsEntries.userId, userId))
      .orderBy(desc(savingsEntries.date));
    const seen = new Map<string, { count: number }>();
    for (const e of entries) {
      const n = norm(e.title);
      if (!n || isAutoDateTitle(e.title)) continue;
      if (!seen.has(n)) {
        seen.set(n, { count: 1 });
        await upsertItemFromEntry(userId, e);
      } else {
        // 빈도 반영: upsert가 timesUsed를 올린다
        await upsertItemFromEntry(userId, e);
      }
    }
    rows = await db
      .select()
      .from(userItems)
      .where(eq(userItems.userId, userId))
      .orderBy(desc(userItems.pinned), desc(userItems.timesUsed), desc(userItems.lastDate));
  }
  return rows;
}

export async function getItemByName(userId: number, title: string) {
  const db = await getDb();
  if (!db) return null;
  const n = norm(title);
  if (!n) return null;
  const rows = await db
    .select()
    .from(userItems)
    .where(and(eq(userItems.userId, userId), eq(userItems.normName, n)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateItem(
  userId: number,
  id: number,
  data: { name?: string; category?: string; usualOriginal?: number; usualActual?: number; pinned?: "yes" | "no" }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: Record<string, unknown> = { ...data };
  if (data.name !== undefined) set.normName = norm(data.name);
  await db.update(userItems).set(set as never).where(and(eq(userItems.userId, userId), eq(userItems.id, id)));
}

export async function deleteItem(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userItems).where(and(eq(userItems.userId, userId), eq(userItems.id, id)));
}

export { norm as normItemName, isAutoDateTitle };
