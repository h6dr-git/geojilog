import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

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
  incomeSource TEXT,
  ticker TEXT NOT NULL,
  originalAmount INTEGER NOT NULL,
  actualAmount INTEGER NOT NULL,
  profit INTEGER NOT NULL,
  aiEstimated TEXT NOT NULL DEFAULT 'no',
  aiReason TEXT,
  imageUrl TEXT,
  imageSig TEXT,
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
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  meta TEXT,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_events(userId, createdAt);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(userId);
CREATE TABLE IF NOT EXISTS user_income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(userId, name)
);
CREATE TABLE IF NOT EXISTS user_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  normName TEXT NOT NULL,
  category TEXT NOT NULL,
  usualOriginal INTEGER NOT NULL,
  usualActual INTEGER NOT NULL,
  pinned TEXT NOT NULL DEFAULT 'no',
  timesUsed INTEGER NOT NULL DEFAULT 1,
  lastDate TEXT,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(userId, normName)
);
CREATE INDEX IF NOT EXISTS idx_items_user ON user_items(userId, timesUsed);
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
        // #43 — 기존 테이블에 단체 추론값 컬럼 추가 (이미 있으면 무시).
        // CREATE IF NOT EXISTS는 기존 테이블을 못 바꾸므로 ALTER를 개별 try로.
        for (const ddl of [
          "ALTER TABLE savings_entries ADD COLUMN aiPeopleCount INTEGER",
          "ALTER TABLE savings_entries ADD COLUMN aiGroupOriginalAmount INTEGER",
          "ALTER TABLE savings_entries ADD COLUMN aiGroupActualAmount INTEGER",
          "ALTER TABLE savings_entries ADD COLUMN incomeSource TEXT",
          "ALTER TABLE savings_entries ADD COLUMN imageSig TEXT",
          "CREATE INDEX IF NOT EXISTS idx_savings_user_sig ON savings_entries(userId, imageSig)",
        ]) {
          try { await client.execute(ddl); } catch { /* duplicate column — 무시 */ }
        }
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
