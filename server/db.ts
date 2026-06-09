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
      try {
        const client = createClient(DB_AUTH ? { url: DB_URL, authToken: DB_AUTH } : { url: DB_URL });
        await client.executeMultiple(CREATE_TABLES_SQL);
        _db = drizzle(client);
        return _db;
      } catch (e) {
        // 콜드스타트/일시적 Turso 연결 실패가 _initPromise를 영구 reject 상태로
        // 박제해 서버 재시작 전까지 앱이 죽는 것을 막는다. 리셋 -> 다음 요청이 재시도.
        _initPromise = null;
        console.error("[db] 초기화 실패 (다음 요청에서 재시도):", e);
        throw e;
      }
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
export async function createUser(data: { openId: string; name?: string | null; loginMethod?: string | null }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(users)
    .values({ openId: data.openId, name: data.name ?? null, loginMethod: data.loginMethod ?? null })
    .returning({ id: users.id });
  return row.id;
}

/** 기존(익명) 계정을 소셜 신원으로 연결하거나 프로필 갱신 */
export async function updateUserIdentity(
  id: number,
  data: { openId: string; name?: string | null; loginMethod?: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: Record<string, unknown> = { openId: data.openId };
  if (data.name !== undefined) set.name = data.name;
  if (data.loginMethod !== undefined) set.loginMethod = data.loginMethod;
  await db.update(users).set(set).where(eq(users.id, id));
}

/** 게스트 계정의 데이터(절약기록·커스텀 카테고리)를 다른 계정으로 합친다(로그인 시 데이터 보존). */
export async function mergeUserData(fromUserId: number, toUserId: number): Promise<void> {
  if (fromUserId === toUserId) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and, inArray } = await import("drizzle-orm");

  // 절약기록 이동: 같은 내용(date+title+category+originalAmount+actualAmount)이
  // 이미 to에 있으면 중복이므로 옮기지 않고(게스트 중복 사본은 정리), 없는 것만 옮긴다.
  const keyOf = (e: {
    date: string; title: string; category: string;
    originalAmount: number; actualAmount: number;
  }) => `${e.date} ${e.title} ${e.category} ${e.originalAmount} ${e.actualAmount}`;

  const [fromEntries, toEntries] = await Promise.all([
    db.select().from(savingsEntries).where(eq(savingsEntries.userId, fromUserId)),
    db.select().from(savingsEntries).where(eq(savingsEntries.userId, toUserId)),
  ]);

  const existingKeys = new Set(toEntries.map(keyOf));
  const moveIds: number[] = [];
  const dupIds: number[] = [];
  for (const e of fromEntries) {
    if (existingKeys.has(keyOf(e))) dupIds.push(e.id); // 이미 to에 있는 중복 → 옮기지 않음
    else moveIds.push(e.id);
  }

  if (moveIds.length > 0) {
    await db.update(savingsEntries).set({ userId: toUserId }).where(inArray(savingsEntries.id, moveIds));
  }
  if (dupIds.length > 0) {
    // 옮기지 않은 게스트 중복분은 남기면 고아 레코드가 되므로 삭제(데이터는 to에 보존됨).
    await db.delete(savingsEntries).where(inArray(savingsEntries.id, dupIds));
  }

  // 기본 카테고리는 양쪽에 다 있어 중복되니 직접 만든(커스텀) 카테고리만 이동
  await db
    .update(userCategories)
    .set({ userId: toUserId })
    .where(and(eq(userCategories.userId, fromUserId), eq(userCategories.isDefault, "no")));
}

/** 사용자 표시 이름(닉네임) 변경 */
export async function updateUserName(id: number, name: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ name }).where(eq(users.id, id));
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
