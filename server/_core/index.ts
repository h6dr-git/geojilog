import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getUserById } from "../db";

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
      res.json({ ok: true, db: "up", env });
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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
