import fs from "node:fs";
import path from "node:path";
import type { Client, InValue, Row } from "@libsql/client";
import { ensureDatabaseSchema } from "../server/db/schemaInit";

export const RECOVERY_TABLES = [
  "users",
  "savings_entries",
  "user_categories",
  "usage_events",
  "push_subscriptions",
  "feedbacks",
  "report_cards",
  "user_income_sources",
  "user_items",
] as const;

export type RecoveryTable = (typeof RECOVERY_TABLES)[number];
export type RecoveryRow = Record<string, InValue>;

export type RecoverySnapshot = {
  source: "remote-readonly" | "backup-json" | "test";
  ownerId: number;
  newestCreatedAt: number;
  lastEntryDate: string | null;
  tables: Record<RecoveryTable, RecoveryRow[]>;
};

export type SourceFreshness = {
  source: "remote-readonly" | "backup-json";
  ownerId: number;
  entries: number;
  newestCreatedAt: number;
  lastEntryDate: string | null;
};

const timestampColumns = new Set(["createdAt", "updatedAt", "lastSignedIn"]);

function asRecoveryRow(row: Row | Record<string, unknown>): RecoveryRow {
  const out: RecoveryRow = {};
  for (const [key, raw] of Object.entries(row)) {
    let value: unknown = raw;
    if (timestampColumns.has(key) && typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) value = Math.floor(parsed / 1000);
    }
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint" ||
      typeof value === "boolean" ||
      value instanceof Uint8Array ||
      value instanceof Date
    ) {
      out[key] = value;
      continue;
    }
    throw new Error(`Unsupported recovery value for ${key}`);
  }
  return out;
}

function unixSeconds(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

function newestTimestamp(rows: RecoveryRow[]): number {
  return rows.reduce((max, row) => Math.max(max, unixSeconds(row.createdAt)), 0);
}

function lastEntryDate(rows: RecoveryRow[]): string | null {
  const dates = rows
    .map((row) => (typeof row.date === "string" ? row.date : ""))
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? null;
}

function emptyTables(): Record<RecoveryTable, RecoveryRow[]> {
  const tables = {} as Record<RecoveryTable, RecoveryRow[]>;
  for (const table of RECOVERY_TABLES) tables[table] = [];
  return tables;
}

export function chooseNewestSource(
  backup: SourceFreshness,
  remote: SourceFreshness | null,
): SourceFreshness {
  if (!remote) return backup;
  if (remote.newestCreatedAt !== backup.newestCreatedAt) {
    return remote.newestCreatedAt > backup.newestCreatedAt ? remote : backup;
  }
  if ((remote.lastEntryDate ?? "") !== (backup.lastEntryDate ?? "")) {
    return (remote.lastEntryDate ?? "") > (backup.lastEntryDate ?? "") ? remote : backup;
  }
  return remote.entries >= backup.entries ? remote : backup;
}

export function readBackupSnapshot(
  backupPath: string,
  ownerId: number,
): RecoverySnapshot {
  const raw = JSON.parse(fs.readFileSync(backupPath, "utf8")) as Record<
    string,
    Array<Record<string, unknown>> | unknown
  >;
  const tables = emptyTables();
  for (const table of RECOVERY_TABLES) {
    const rows = Array.isArray(raw[table]) ? raw[table] : [];
    tables[table] = rows
      .filter((row) =>
        table === "users" ? Number(row.id) === ownerId : Number(row.userId) === ownerId,
      )
      .map(asRecoveryRow);
  }
  if (tables.users.length !== 1) {
    throw new Error(`Backup does not contain exactly one owner row for id ${ownerId}`);
  }
  return {
    source: "backup-json",
    ownerId,
    newestCreatedAt: newestTimestamp(tables.savings_entries),
    lastEntryDate: lastEntryDate(tables.savings_entries),
    tables,
  };
}

export async function readRemoteFreshness(
  remote: Client,
  ownerId: number,
): Promise<SourceFreshness> {
  const result = await remote.execute({
    sql: `SELECT COUNT(*) AS entries, MAX(createdAt) AS newestCreatedAt, MAX(date) AS lastEntryDate
          FROM savings_entries WHERE userId = ?`,
    args: [ownerId],
  });
  const row = result.rows[0];
  return {
    source: "remote-readonly",
    ownerId,
    entries: Number(row?.entries ?? 0),
    newestCreatedAt: unixSeconds(row?.newestCreatedAt),
    lastEntryDate: row?.lastEntryDate ? String(row.lastEntryDate) : null,
  };
}

export async function readRemoteSnapshot(
  remote: Client,
  ownerId: number,
): Promise<RecoverySnapshot> {
  const tables = emptyTables();
  for (const table of RECOVERY_TABLES) {
    const where = table === "users" ? "id = ?" : "userId = ?";
    const result = await remote.execute({
      sql: `SELECT * FROM ${table} WHERE ${where} ORDER BY id`,
      args: [ownerId],
    });
    tables[table] = result.rows.map(asRecoveryRow);
  }
  if (tables.users.length !== 1) {
    throw new Error(`Remote source does not contain exactly one owner row for id ${ownerId}`);
  }
  return {
    source: "remote-readonly",
    ownerId,
    newestCreatedAt: newestTimestamp(tables.savings_entries),
    lastEntryDate: lastEntryDate(tables.savings_entries),
    tables,
  };
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

export async function restoreSnapshot(
  target: Client,
  snapshot: RecoverySnapshot,
): Promise<void> {
  await ensureDatabaseSchema(target);
  for (const table of RECOVERY_TABLES) {
    for (const row of snapshot.tables[table]) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const sql = `INSERT INTO ${quoteIdentifier(table)} (${columns
        .map(quoteIdentifier)
        .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      await target.execute({ sql, args: columns.map((column) => row[column]) });
    }
  }
}

export function snapshotCounts(snapshot: RecoverySnapshot): Record<RecoveryTable, number> {
  return Object.fromEntries(
    RECOVERY_TABLES.map((table) => [table, snapshot.tables[table].length]),
  ) as Record<RecoveryTable, number>;
}

export async function verifyRestoredSnapshot(
  target: Client,
  snapshot: RecoverySnapshot,
): Promise<{ integrity: string; counts: Record<RecoveryTable, number> }> {
  const integrityResult = await target.execute("PRAGMA quick_check");
  const integrity = String(integrityResult.rows[0]?.quick_check ?? "unknown");
  const counts = {} as Record<RecoveryTable, number>;
  for (const table of RECOVERY_TABLES) {
    const where = table === "users" ? "id = ?" : "userId = ?";
    const result = await target.execute({
      sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`,
      args: [snapshot.ownerId],
    });
    counts[table] = Number(result.rows[0]?.n ?? 0);
  }
  const expected = snapshotCounts(snapshot);
  for (const table of RECOVERY_TABLES) {
    if (counts[table] !== expected[table]) {
      throw new Error(
        `Restore count mismatch for ${table}: expected ${expected[table]}, got ${counts[table]}`,
      );
    }
  }
  if (integrity !== "ok") throw new Error(`Restored database integrity failed: ${integrity}`);
  return { integrity, counts };
}

export function copyReferencedUploads(
  snapshot: RecoverySnapshot,
  sourceRoot: string,
  targetRoot: string,
): { referenced: number; copied: number; missing: number } {
  const normalizedSource = path.resolve(sourceRoot);
  const normalizedTarget = path.resolve(targetRoot);
  if (
    normalizedSource === normalizedTarget ||
    normalizedTarget.startsWith(`${normalizedSource}${path.sep}`) ||
    normalizedSource.startsWith(`${normalizedTarget}${path.sep}`)
  ) {
    throw new Error("Recovery upload target must be isolated from the source uploads");
  }
  fs.mkdirSync(normalizedTarget, { recursive: true });

  const references = new Set(
    snapshot.tables.savings_entries
      .map((row) => (typeof row.imageUrl === "string" ? row.imageUrl : ""))
      .filter((url) => url.startsWith("/manus-storage/"))
      .map((url) => url.slice("/manus-storage/".length)),
  );

  let copied = 0;
  let missing = 0;
  for (const rel of Array.from(references)) {
    const source = path.resolve(normalizedSource, rel);
    const target = path.resolve(normalizedTarget, rel);
    if (
      !source.startsWith(`${normalizedSource}${path.sep}`) ||
      !target.startsWith(`${normalizedTarget}${path.sep}`)
    ) {
      throw new Error("Unsafe image path in recovery snapshot");
    }
    if (!fs.existsSync(source)) {
      missing += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    copied += 1;
  }
  return { referenced: references.size, copied, missing };
}
