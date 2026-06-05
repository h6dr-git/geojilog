import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// 개인/로컬용: SQLite 스키마.
// MySQL 버전과 컬럼 이름은 동일하게 유지했고, 타입만 SQLite에 맞췄습니다.
// (int → integer, varchar/enum → text, timestamp → integer{mode:"timestamp"})

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── 절약 수익 항목 ──────────────────────────────────────────
export const savingsEntries = sqliteTable("savings_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),

  date: text("date").notNull(), // YYYY-MM-DD
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  ticker: text("ticker").notNull(),

  originalAmount: integer("originalAmount").notNull(), // 원래 지출 예정 금액
  actualAmount: integer("actualAmount").notNull(), // 실제 지출 금액
  profit: integer("profit").notNull(), // originalAmount - actualAmount

  // AI 추정 관련 메타데이터
  aiEstimated: text("aiEstimated", { enum: ["yes", "no"] })
    .notNull()
    .default("no"),
  aiReason: text("aiReason"), // AI가 기준가를 추정한 근거
  imageUrl: text("imageUrl"), // 저장된 사진 경로/URL
  memo: text("memo"), // 사용자 메모

  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SavingsEntry = typeof savingsEntries.$inferSelect;
export type InsertSavingsEntry = typeof savingsEntries.$inferInsert;

// ── 사용자 커스텀 카테고리 ──────────────────────────────────────────
export const userCategories = sqliteTable("user_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("gray"), // tailwind color name
  isDefault: text("isDefault", { enum: ["yes", "no"] })
    .notNull()
    .default("no"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type UserCategory = typeof userCategories.$inferSelect;
export type InsertUserCategory = typeof userCategories.$inferInsert;
