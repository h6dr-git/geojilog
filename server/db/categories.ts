import { eq } from "drizzle-orm";
import { userCategories, InsertUserCategory } from "../../drizzle/schema";
import { getDb } from "./client";

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
