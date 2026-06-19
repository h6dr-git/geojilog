import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getUserById, getOpsReport, backfillProfitKinds } from "./db";
import { registerKakaoAuth } from "./kakao";
import { startPushScheduler } from "./push";
import { startBackupScheduler, buildBackupDump, lastBackupInfo } from "./backup";
import { renderOpsDashboardHtml } from "./opsDashboard";
import { storagePersistenceInfo } from "./storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Railway 등 리버스 프록시 뒤에서 req.protocol/secure 쿠키가 올바르게 동작하도록.
  app.set("trust proxy", 1);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── 검증 계기판 (#53) — 운영자 전용 비밀 URL. 앱 인터페이스와 완전 분리.
  // OPS_KEY 미설정이면 존재 자체를 숨긴다(404). 검색엔진 차단.
  app.get("/ops", async (req, res) => {
    const key = process.env.OPS_KEY;
    if (!key || req.query.key !== key) return res.status(404).send("Not Found");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    try {
      const r = await getOpsReport();
      const opsKey = String(req.query.key).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
      res.send(renderOpsDashboardHtml(r, opsKey));
    } catch (e) {
      res.status(500).send("계기판 오류: " + (e instanceof Error ? e.message : String(e)));
    }
  });

  // 백업 덤프 (#59) — 운영자 전용. 전 테이블 JSON 다운로드 (장부=자산: 최소한의 수동 백업 수단).
  // 사용: /ops/backup?key=<OPS_KEY> → geojilog-backup-YYYY-MM-DD.json 저장. 주 1회 권장.
  app.get("/ops/backup", async (req, res) => {
    const key = process.env.OPS_KEY;
    if (!key || req.query.key !== key) return res.status(404).send("Not Found");
    try {
      const dump = await buildBackupDump();
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename="geojilog-backup-${today}.json"`);
      res.setHeader("X-Robots-Tag", "noindex");
      res.json(dump);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // 진단용 헬스체크: DB 연결 + 필수 환경변수 존재 여부(값은 노출 안 함).
  // 로그인 화면이 뜨면 /api/health 로 "코드 문제 vs 설정(Turso/env) 문제"를 즉시 구분.
  app.get("/api/health", async (_req, res) => {
    const env = {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasTursoToken: !!(process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN),
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV ?? null,
    };
    try {
      await getUserById(0); // 실제 쿼리로 DB 연결을 가볍게 핑.
      // 배포 검증용 스탬프 (#61): 지금 도는 코드가 어느 커밋인지 + 마지막 자동 백업
      res.json({
        ok: true,
        db: "up",
        env,
        commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        lastBackup: lastBackupInfo(),
        storage: (() => {
          const s = storagePersistenceInfo();
          return { uploadDirConfigured: !!process.env.UPLOAD_DIR, persistence: s.mode, dir: s.dir };
        })(),
      });
    } catch (e) {
      res
        .status(500)
        .json({ ok: false, db: "down", error: e instanceof Error ? e.message : String(e), env });
    }
  });

  registerStorageProxy(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // 카카오 소셜 로그인 (선택) — 게스트 계정을 카카오로 연결
  registerKakaoAuth(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // 프로덕션(Railway 등)에선 주입된 PORT에 정확히 바인딩해야 외부 라우팅이 동작한다.
  // 개발에서만 포트 충돌 시 빈 포트를 탐색.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  startPushScheduler();
  startBackupScheduler(); // #61 — 일일 DB 덤프(볼륨, 7일 보존)
  backfillProfitKinds()
    .then((r) => {
      if (r.updated > 0) console.log(`[db] profitKind backfill: ${r.updated}/${r.scanned}`);
    })
    .catch((e) => console.warn("[db] profitKind backfill skipped:", e));
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
