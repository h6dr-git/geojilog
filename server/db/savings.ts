import { desc, eq } from "drizzle-orm";
import { savingsEntries, InsertSavingsEntry } from "../../drizzle/schema";
import { guessIncomeSource, type IncomeSource } from "@shared/incomeSources";
import { getDb } from "./client";

// ── Savings Entries ──────────────────────────────────────────

export async function getSavingsEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(savingsEntries)
    .where(eq(savingsEntries.userId, userId))
    // 장부는 '기록된 날짜' 기준 — 입력 시각이 아니라 (어제 사진을 오늘 올려도 제자리에)
    .orderBy(desc(savingsEntries.date), desc(savingsEntries.createdAt));
}

// P2(나만의 기준가) — 같은 제목(공백·대소문자 정규화)의 최근 확정 기록들로 기준가 제안.
// 원가는 '최근 3건의 중간값' — 한 번 잘못 적은 값에 끌려가지 않게(강건화).
// 실제 지출·날짜는 가장 최근 기록 기준. AI 추정보다 이 값을 우선 제안해 기준가 일관성을 지킨다.
export async function getLatestEntryByTitle(userId: number, title: string) {
  const db = await getDb();
  if (!db) return null;
  const { and, sql } = await import("drizzle-orm");
  const norm = title.trim().toLowerCase();
  if (!norm) return null;
  const rows = await db
    .select()
    .from(savingsEntries)
    .where(and(eq(savingsEntries.userId, userId), sql`lower(trim(${savingsEntries.title})) = ${norm}`))
    .orderBy(desc(savingsEntries.date), desc(savingsEntries.createdAt))
    .limit(3);
  if (rows.length === 0) return null;
  const originals = rows.map((r) => r.originalAmount).sort((a, b) => a - b);
  const median = originals[Math.floor((originals.length - 1) / 2)];
  return { ...rows[0], originalAmount: median };
}

export async function createSavingsEntry(data: InsertSavingsEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(savingsEntries).values(data).returning({ id: savingsEntries.id });
  return result;
}

export async function updateSavingsEntry(
  id: number,
  userId: number,
  data: {
    date?: string;
    title?: string;
    description?: string;
    category?: string;
    originalAmount?: number;
    actualAmount?: number;
    memo?: string | null;
    imageUrl?: string;
    incomeSource?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and } = await import("drizzle-orm");

  const updateData: Record<string, unknown> = {};
  if (data.date !== undefined) updateData.date = data.date;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.originalAmount !== undefined) updateData.originalAmount = data.originalAmount;
  if (data.actualAmount !== undefined) updateData.actualAmount = data.actualAmount;
  if (data.memo !== undefined) updateData.memo = data.memo;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.incomeSource !== undefined) updateData.incomeSource = data.incomeSource;
  if (data.originalAmount !== undefined || data.actualAmount !== undefined) {
    const existing = await db.select().from(savingsEntries).where(eq(savingsEntries.id, id)).limit(1);
    if (existing[0]) {
      const orig = data.originalAmount ?? existing[0].originalAmount;
      const actual = data.actualAmount ?? existing[0].actualAmount;
      updateData.profit = orig - actual;
    }
  }
  if (Object.keys(updateData).length === 0) return;
  await db
    .update(savingsEntries)
    .set(updateData as any)
    .where(and(eq(savingsEntries.id, id), eq(savingsEntries.userId, userId)));
}

export async function deleteSavingsEntry(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and } = await import("drizzle-orm");
  await db
    .delete(savingsEntries)
    .where(and(eq(savingsEntries.id, id), eq(savingsEntries.userId, userId)));
}

// #46 — 일괄 수정 (다중 선택 → 수익원/카테고리 한 번에). 금액은 단건 수정만 (실수 방지).
export async function updateMultipleSavingsEntries(
  ids: number[],
  userId: number,
  data: { incomeSource?: string | null; category?: string }
) {
  if (ids.length === 0) return;
  const set: Record<string, unknown> = {};
  if (data.incomeSource !== undefined) set.incomeSource = data.incomeSource;
  if (data.category !== undefined) set.category = data.category;
  if (Object.keys(set).length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and, inArray } = await import("drizzle-orm");
  await db
    .update(savingsEntries)
    .set(set as never)
    .where(and(inArray(savingsEntries.id, ids), eq(savingsEntries.userId, userId)));
}

export async function deleteMultipleSavingsEntries(ids: number[], userId: number) {
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and, inArray } = await import("drizzle-orm");
  await db
    .delete(savingsEntries)
    .where(and(inArray(savingsEntries.id, ids), eq(savingsEntries.userId, userId)));
}

export async function deleteAllSavingsEntries(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(savingsEntries).where(eq(savingsEntries.userId, userId));
}

export async function countSavingsEntriesByCategory(userId: number, category: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { and, count } = await import("drizzle-orm");
  const [row] = await db
    .select({ n: count() })
    .from(savingsEntries)
    .where(and(eq(savingsEntries.userId, userId), eq(savingsEntries.category, category)));
  return row?.n ?? 0;
}


// ── 수익원 (#37+#38) ─────────────────────────────────────────

// 평소가 = 해당 수익원의 최근 실지출 '중앙값'. 제목이 제각각이어도 유형으로 묶여 견고하다.
// 표본 2건 미만이면 null — '평소'라 부를 근거가 없을 때는 보너스·세 층 가격을 띄우지 않는다.
export async function getIncomeSourceUsual(userId: number, source: string) {
  const db = await getDb();
  if (!db) return null;
  const { and } = await import("drizzle-orm");
  const rows = await db
    .select({ actualAmount: savingsEntries.actualAmount })
    .from(savingsEntries)
    .where(and(eq(savingsEntries.userId, userId), eq(savingsEntries.incomeSource, source)))
    .orderBy(desc(savingsEntries.date), desc(savingsEntries.createdAt))
    .limit(20);
  if (rows.length < 2) return null;
  const sorted = rows.map((r) => r.actualAmount).sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid] + sorted[mid + 1]) / 2);
  return { source, usualActual: median, sample: rows.length };
}

// 미분류 기록 1회 정리 — 제목·메모 키워드 휴리스틱 (LLM 호출 없음, 사용자 트리거).
// 남은 미분류는 사용자가 상세 시트에서 직접 지정한다.
export async function backfillIncomeSources(userId: number) {
  const db = await getDb();
  if (!db) return { classified: 0, remaining: 0 };
  const { and, isNull } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(savingsEntries)
    .where(and(eq(savingsEntries.userId, userId), isNull(savingsEntries.incomeSource)));
  let classified = 0;
  for (const e of rows) {
    const guess: IncomeSource | null =
      guessIncomeSource(e.title) ?? guessIncomeSource(e.memo ?? "") ?? guessIncomeSource(e.description ?? "");
    if (guess) {
      await db.update(savingsEntries).set({ incomeSource: guess }).where(eq(savingsEntries.id, e.id));
      classified += 1;
    }
  }
  return { classified, remaining: rows.length - classified };
}
