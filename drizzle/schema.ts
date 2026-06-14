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
  // #37+#38 — 수익원("어떻게 번 돈인가"). null=미분류. 목록은 shared/incomeSources.ts
  incomeSource: text("incomeSource"),
  ticker: text("ticker").notNull(),

  originalAmount: integer("originalAmount").notNull(), // 원래 지출 예정 금액
  actualAmount: integer("actualAmount").notNull(), // 실제 지출 금액
  profit: integer("profit").notNull(), // originalAmount - actualAmount

  // 수익 4분류 — save|receive|restrain|earn (shared/profitKinds.ts)
  profitKind: text("profitKind", { enum: ["save", "receive", "restrain", "earn"] })
    .notNull()
    .default("save"),
  // AI 추정 가격에 대한 사장님 코멘트/반박 (학습·보정 데이터용)
  userPriceNote: text("userPriceNote"),

  // AI 추정 관련 메타데이터
  aiEstimated: text("aiEstimated", { enum: ["yes", "no"] })
    .notNull()
    .default("no"),
  aiReason: text("aiReason"),
  // #43 — AI 단체 추론값 보존 (전체 원가·전체 실제·인원). 내 몫은 클라 표시값(originalAmount 등)에.
  aiPeopleCount: integer("aiPeopleCount"),
  aiGroupOriginalAmount: integer("aiGroupOriginalAmount"),
  aiGroupActualAmount: integer("aiGroupActualAmount"), // AI가 기준가를 추정한 근거
  savingsSteps: text("savingsSteps"), // #50 연쇄 할인 단계 JSON (null=단일 폴백)
  imageUrl: text("imageUrl"), // 저장된 사진 경로/URL
  imageSig: text("imageSig"), // #48 — 원본 파일 sha256 (크로스 세션 중복 감지)
  memo: text("memo"), // 사용자 메모

  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SavingsEntry = typeof savingsEntries.$inferSelect;
export type InsertSavingsEntry = typeof savingsEntries.$inferInsert;

// ── 사용자 커스텀 카테고리 ──────────────────────────────────────────
// #58 — 사장님 업무 지시(서면 피드백). 베타 루프의 수집 창구 — /ops 계기판 인박스로 흐른다.
export const feedbacks = sqliteTable("feedbacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  text: text("text").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// #50 — 서가: 소장된 결산 카드 (완결된 세계 — 만든 카드는 앱 안에 남는다)
// 데이터는 기간 메타+스킨만: 금액·구성은 열 때 장부에서 재계산 (장부가 원본 원칙)
export const reportCards = sqliteTable("report_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  periodType: text("periodType", { enum: ["week", "month"] }).notNull(),
  startDate: text("startDate").notNull(), // 주=월요일, 월=1일 (YYYY-MM-DD)
  theme: text("theme").notNull().default("forest"),
  stickers: text("stickers").notNull().default("[]"), // JSON 배열
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
export type ReportCard = typeof reportCards.$inferSelect;

// #47 — 사용자 커스텀 수익원 (기본 9종은 shared/incomeSources.ts 상수, 여기는 추가분만)
export const userIncomeSources = sqliteTable("user_income_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
export type UserIncomeSource = typeof userIncomeSources.$inferSelect;
export type InsertUserIncomeSource = typeof userIncomeSources.$inferInsert;

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
