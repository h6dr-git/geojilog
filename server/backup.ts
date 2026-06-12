// 자동 백업 (#61) — "백업을 폰에 받는 건 아니다, 시스템이 이중으로" (상욱 2026-06-12).
// 매일 KST 04시대에 DB 전체를 JSON으로 덤프 → 영속 볼륨(UPLOAD_DIR)/backups/에 7일 롤링 보존.
// 레이어: ① Turso 원격(서비스 자체 내구성) ② 본 일일 덤프(볼륨 — 재배포와 무관) ③ /ops/backup 수동(비상).
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";

const BACKUP_KEEP_DAYS = 7;

export async function buildBackupDump() {
  const db = await getDb();
  if (!db) throw new Error("db unavailable");
  return {
    exportedAt: new Date().toISOString(),
    users: await db.select().from(schema.users),
    savings_entries: await db.select().from(schema.savingsEntries),
    user_categories: await db.select().from(schema.userCategories),
    user_items: await db.select().from(schema.userItems),
    user_income_sources: await db.select().from(schema.userIncomeSources),
    report_cards: await db.select().from(schema.reportCards),
    feedbacks: await db.select().from(schema.feedbacks),
    push_subscriptions: await db.select().from(schema.pushSubscriptions),
  };
}

function backupDir(): string {
  const base = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
  return path.join(base, "backups");
}

const kstDateStr = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function runDailyBackup(): Promise<void> {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `geojilog-backup-${kstDateStr()}.json`);
  if (fs.existsSync(file)) return; // 오늘 치 이미 있음
  const dump = await buildBackupDump();
  fs.writeFileSync(file, JSON.stringify(dump), "utf-8");
  // 7일 롤링 — 오래된 것 정리
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("geojilog-backup-")).sort();
  while (files.length > BACKUP_KEEP_DAYS) {
    const old = files.shift()!;
    try { fs.unlinkSync(path.join(dir, old)); } catch { /* 무시 */ }
  }
  console.log(`[backup] 일일 백업 완료: ${file}`);
}

/** 백업 스케줄러 — 15분 간격 체크, KST 04시대에 하루 1번. 실패해도 앱 동작엔 영향 없음. */
export function startBackupScheduler(): void {
  const tick = async () => {
    const kstHour = (new Date().getUTCHours() + 9) % 24;
    if (kstHour !== 4) return;
    try { await runDailyBackup(); } catch (e) { console.warn("[backup] 실패:", e); }
  };
  setInterval(tick, 15 * 60 * 1000);
  tick(); // 부팅 직후 1회 체크 (04시대 재배포 대응)
  console.log("[backup] 일일 백업 스케줄러 시작 (KST 04시대, 볼륨/backups, 7일 보존)");
}

/** 계기판용 — 최근 백업 상태 */
export function lastBackupInfo(): { file: string; at: string } | null {
  try {
    const dir = backupDir();
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("geojilog-backup-")).sort();
    if (!files.length) return null;
    const f = files[files.length - 1];
    return { file: f, at: fs.statSync(path.join(dir, f)).mtime.toISOString() };
  } catch { return null; }
}
