import type { Client } from "@libsql/client";

export const CREATE_TABLES_SQL = `
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
  savingsSteps TEXT,
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
CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  text TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS report_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  periodType TEXT NOT NULL,
  startDate TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'forest',
  stickers TEXT NOT NULL DEFAULT '[]',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(userId, periodType, startDate)
);
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

export const COMPATIBILITY_DDL = [
  "ALTER TABLE savings_entries ADD COLUMN aiPeopleCount INTEGER",
  "ALTER TABLE savings_entries ADD COLUMN aiGroupOriginalAmount INTEGER",
  "ALTER TABLE savings_entries ADD COLUMN aiGroupActualAmount INTEGER",
  "ALTER TABLE savings_entries ADD COLUMN savingsSteps TEXT",
  "ALTER TABLE savings_entries ADD COLUMN incomeSource TEXT",
  "ALTER TABLE savings_entries ADD COLUMN imageSig TEXT",
  "ALTER TABLE savings_entries ADD COLUMN profitKind TEXT DEFAULT 'save'",
  "ALTER TABLE savings_entries ADD COLUMN userPriceNote TEXT",
  "CREATE INDEX IF NOT EXISTS idx_savings_user_sig ON savings_entries(userId, imageSig)",
] as const;

export async function ensureDatabaseSchema(client: Client): Promise<void> {
  await client.executeMultiple(CREATE_TABLES_SQL);
  for (const ddl of COMPATIBILITY_DDL) {
    try {
      await client.execute(ddl);
    } catch {
      // Existing legacy databases already have most compatibility columns.
    }
  }
}
