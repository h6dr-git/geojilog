import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { InsertUser, users, savingsEntries, InsertSavingsEntry, userCategories, InsertUserCategory } from "../drizzle/schema";
import { ENV } from './_core/env';

// ──────────────────────────────────────────────────────────────
// DB: libsql. 로컬은 파일(local.db), 배포는 DATABASE_URL(Turso 등).
// 배포 시 DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN 을 환경변수로 준다.
// ──────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || "file:local.db";
const DB_AUTH = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openId TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  loginMethod TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
  lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS savings_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  ticker TEXT NOT NULL,
  originalAmount INTEGER NOT NULL,
  actualAmount INTEGER NOT NULL,
  profit INTEGER NOT NULL,
  aiEstimated TEXT NOT NULL DEFAULT 'no',
  aiReason TEXT,
  imageUrl TEXT,
  memo TEXT,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS user_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  isDefault TEXT NOT NULL DEFAULT 'no',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

let _db: ReturnType<typeof drizzle> | null = null;
let _initPromise: Promise<ReturnType<typeof drizzle>> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = (async () => {
      const client = createClient(DB_AUTH ? { url: DB_URL, authToken: DB_AUTH } : { url: DB_URL });
      await client.executeMultiple(CREATE_TABLES_SQL);
      _db = drizzle(client);
      return _db;
    })();
  }
  return _initPromise;
}

// ── Users ──────────────────────────────────────────

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 익명 자동 계정 등 새 사용자 생성, 새 id 반환 */
export async function createUser(data: { openId: string; name?: string | null }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(users)
    .values({ openId: data.openId, name: data.name ?? null })
    .returning({ id: users.id });
  return row.id;
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
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
  const [result] = await db.insert(userCategories).values(data).returning({ id: userCategories.id });
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
