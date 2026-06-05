import { defineConfig } from "drizzle-kit";

// 개인/로컬용: SQLite 파일 DB.
// 평소엔 서버가 시작될 때 테이블을 자동 생성하므로 이 설정 없이도 동작합니다.
// (drizzle-kit 명령을 직접 쓰고 싶을 때만 사용)
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:local.db",
  },
});
