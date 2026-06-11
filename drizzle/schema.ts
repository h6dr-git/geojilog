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

// ── 사용량 이벤트 (측정 + AI 호출 제한) ──────────────────────────────
// type 예: "entry_create" | "ai_analyze_image" | "ai_parse_sms"
export const usageEvents = sqliteTable("usage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  type: text("type").notNull(),
  meta: text("meta"), // 선택: 부가정보(JSON 문자열 등)
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;

// ── 웹 푸시 구독 (기기 단위) ──────────────────────────────────────
// endpoint가 기기·브라우저 식별자. 만료/해지(410) 시 서버가 정리한다.
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .default(sql`(unixepoch())`),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ── 단골 사전 (P2 2차 · #37) ──────────────────────────────────────
// 기록에서 자동 축적되는 '내 항목' 사전. 기준가(usualOriginal=시중가)와
// 평소가(usualActual=평소 내가 내는 돈)를 분리 보관 → 이중 할인(#37)의 세 층을 표현.
// pinned='yes'면 사용자가 직접 관리하는 항목 — 가격 자동 갱신을 멈춘다.
export const userItems = sqliteTable("user_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  normName: text("normName").notNull(), // lower(trim(name)) — 매칭키
  category: text("category").notNull(),
  usualOriginal: integer("usualOriginal").notNull(),
  usualActual: integer("usualActual").notNull(),
  pinned: text("pinned").notNull().default("no"),
  timesUsed: integer("timesUsed").notNull().default(1),
  lastDate: text("lastDate"),
  createdAt: integer("createdAt")
    .notNull()
    .default(sql`(unixepoch())`),
});

export type UserItem = typeof userItems.$inferSelect;
export type InsertUserItem = typeof userItems.$inferInsert;
