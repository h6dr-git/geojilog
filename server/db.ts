import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, savingsEntries, InsertSavingsEntry, userCategories, InsertUserCategory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Savings Entries ──────────────────────────────────────────

export async function getSavingsEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(savingsEntries)
    .where(eq(savingsEntries.userId, userId))
    .orderBy(desc(savingsEntries.createdAt));
}

export async function createSavingsEntry(data: InsertSavingsEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(savingsEntries).values(data).$returningId();
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
  // profit 재계산
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

// ── User Categories ──────────────────────────────────────────

const DEFAULT_CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"];
const DEFAULT_COLORS: Record<string, string> = {
  "식비": "amber", "카페": "orange", "교통": "blue",
  "쇼핑": "purple", "문화/여가": "pink", "기타": "gray",
};

export async function getUserCategories(userId: number) {
  const db = await getDb();
  if (!db) return DEFAULT_CATEGORIES.map((name, i) => ({
    id: -(i + 1), userId, name, color: DEFAULT_COLORS[name] ?? "gray",
    isDefault: "yes" as const, createdAt: new Date(),
  }));

  const rows = await db.select().from(userCategories)
    .where(eq(userCategories.userId, userId))
    .orderBy(userCategories.createdAt);

  // 커스텀 카테고리가 없으면 기본값 시드
  if (rows.length === 0) {
    await db.insert(userCategories).values(
      DEFAULT_CATEGORIES.map(name => ({
        userId, name, color: DEFAULT_COLORS[name] ?? "gray", isDefault: "yes" as const,
      }))
    );
    return getUserCategories(userId);
  }
  return rows;
}

export async function createUserCategory(data: InsertUserCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(userCategories).values(data).$returningId();
  return result;
}

export async function deleteUserCategory(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and } = await import("drizzle-orm");
  await db.delete(userCategories)
    .where(and(eq(userCategories.id, id), eq(userCategories.userId, userId)));
}

export async function renameUserCategory(id: number, userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and } = await import("drizzle-orm");
  await db.update(userCategories).set({ name })
    .where(and(eq(userCategories.id, id), eq(userCategories.userId, userId)));
}
