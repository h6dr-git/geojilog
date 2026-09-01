import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { databaseConnectionConfig } from "../localMode";
import { ensureDatabaseSchema } from "./schemaInit";

// ──────────────────────────────────────────────────────────────
// DB: libsql. 로컬은 파일(local.db), 배포는 DATABASE_URL(Turso 등).
// 배포 시 DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN 을 환경변수로 준다.
// ──────────────────────────────────────────────────────────────
const DB_CONNECTION = databaseConnectionConfig();

let _db: ReturnType<typeof drizzle> | null = null;
let _initPromise: Promise<ReturnType<typeof drizzle>> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        const client = createClient(
          DB_CONNECTION.authToken
            ? { url: DB_CONNECTION.url, authToken: DB_CONNECTION.authToken }
            : { url: DB_CONNECTION.url },
        );
        await ensureDatabaseSchema(client);
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
