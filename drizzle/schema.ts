import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── 절약 수익 항목 ──────────────────────────────────────────
export const savingsEntries = mysqlTable("savings_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),

  originalAmount: int("originalAmount").notNull(), // 원래 지출 예정 금액
  actualAmount: int("actualAmount").notNull(),     // 실제 지출 금액
  profit: int("profit").notNull(),                 // originalAmount - actualAmount

  // AI 추정 관련 메타데이터
  aiEstimated: mysqlEnum("aiEstimated", ["yes", "no"]).default("no").notNull(),
  aiReason: text("aiReason"), // AI가 기준가를 추정한 근거
  imageUrl: text("imageUrl"), // S3에 저장된 사진 URL
  memo: text("memo"),          // 사용자 메모

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavingsEntry = typeof savingsEntries.$inferSelect;
export type InsertSavingsEntry = typeof savingsEntries.$inferInsert;

// ── 사용자 커스텀 카테고리 ──────────────────────────────────────────
export const userCategories = mysqlTable("user_categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 30 }).default("gray").notNull(), // tailwind color name
  isDefault: mysqlEnum("isDefault", ["yes", "no"]).default("no").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserCategory = typeof userCategories.$inferSelect;
export type InsertUserCategory = typeof userCategories.$inferInsert;
