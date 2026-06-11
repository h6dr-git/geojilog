import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getUserById, getOpsReport } from "./db";
import { registerKakaoAuth } from "./kakao";
import { startPushScheduler } from "./push";

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
      const pct = (v: number) => `${Math.round(v * 100)}%`;
      const ok = (good: boolean) => (good ? "✅" : "⚠️");
      const dot = (b: boolean | null) => (b === null ? "·" : b ? "●" : "○");
      const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
      const userRows = r.users.map((u) => `
        <tr${u.isAdmin ? ' style="opacity:.45"' : ""}>
          <td>${esc(u.name)}${u.isAdmin ? " 👑" : ""}</td>
          <td>${u.joined.slice(5)}</td>
          <td class="num">${u.entries}</td>
          <td class="num">${u.activeDays}</td>
          <td>${u.lastActive ? u.lastActive.slice(5) : "—"}</td>
          <td class="c">${u.firstRecord ? "●" : "○"}</td>
          <td class="c">${dot(u.d1)}</td>
          <td class="c">${dot(u.d7)}</td>
          <td class="c">${u.todayActive ? "🟢" : ""}</td>
        </tr>`).join("");
      const dailyRows = r.daily.map((d) => `
        <tr><td>${d.date.slice(5)}</td><td class="num">${d.signups || ""}</td><td class="num">${d.active}</td><td class="num">${d.entries}</td>
        <td><div style="height:8px;width:${Math.min(160, d.active * 14)}px;background:#10B981;border-radius:4px"></div></td></tr>`).join("");
      res.send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>거지로그 계기판</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;background:#16201A;color:#F4EFE3;margin:0;padding:20px 16px 60px;max-width:680px;margin:0 auto}
  h1{font-size:16px;letter-spacing:2px;color:#E0A92E;margin:0 0 2px} .sub{font-size:11px;color:#7E8C82;margin-bottom:18px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:18px}
  .kpi{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:12px}
  .kpi .l{font-size:10px;color:#7E8C82;letter-spacing:1px} .kpi .v{font-size:20px;font-weight:800;font-family:ui-monospace,monospace;margin-top:3px}
  .kpi .s{font-size:10px;color:#9aa89e;margin-top:2px}
  h2{font-size:12px;color:#E0A92E;letter-spacing:2px;margin:22px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{font-size:10px;color:#7E8C82;text-align:left;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12)}
  td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.05)} .num{text-align:right;font-family:ui-monospace,monospace} .c{text-align:center}
  .note{font-size:10px;color:#5E6A60;line-height:1.6;margin-top:6px}
</style></head><body>
<h1>거지로그 계기판</h1><div class="sub">${r.today} (KST) · 운영자 전용 · 킬 기준 출처: 가능성 평가 §4</div>
<div class="grid">
  <div class="kpi"><div class="l">가입 → 첫 기록 ${ok(r.kill.conversion.value >= r.kill.conversion.target || r.kill.conversion.den === 0)}</div>
    <div class="v">${pct(r.kill.conversion.value)}</div><div class="s">${r.kill.conversion.num}/${r.kill.conversion.den} · 기준 40%+</div></div>
  <div class="kpi"><div class="l">D1 재방문</div><div class="v">${pct(r.kill.d1.value)}</div><div class="s">${r.kill.d1.num}/${r.kill.d1.den} 판정 가능분</div></div>
  <div class="kpi"><div class="l">D7 재방문 ${ok(r.kill.d7.value >= r.kill.d7.target || r.kill.d7.den === 0)}</div>
    <div class="v">${pct(r.kill.d7.value)}</div><div class="s">${r.kill.d7.num}/${r.kill.d7.den} · 기준 15%+ (가입+6~8일 창)</div></div>
  <div class="kpi"><div class="l">오늘 활성 / 7일 활성</div><div class="v">${r.kill.todayActive} / ${r.kill.last7dActive}</div><div class="s">전체 ${r.totals.users}명 · 기록 ${r.totals.entries}건</div></div>
  <div class="kpi"><div class="l">AI 호출 (비용 감시)</div><div class="v">${r.totals.aiCallsToday} / ${r.totals.aiCalls7d}</div><div class="s">오늘 / 7일 · 누적 ${r.totals.aiCallsAll}</div></div>
  <div class="kpi"><div class="l">공유 행동 / 가격 보정</div><div class="v">${r.totals.captureViews} / ${r.totals.priceCorrections}</div><div class="s">캡처 진입 · 데이터 해자 적립</div></div>
</div>
<h2>일별 14일</h2>
<table><tr><th>날짜</th><th style="text-align:right">가입</th><th style="text-align:right">활성</th><th style="text-align:right">기록</th><th></th></tr>${dailyRows}</table>
<h2>사용자 (${r.users.length})</h2>
<table><tr><th>이름</th><th>가입</th><th style="text-align:right">기록</th><th style="text-align:right">활동일</th><th>마지막</th><th>첫기록</th><th>D1</th><th>D7</th><th>오늘</th></tr>${userRows}</table>
<div class="note">● 달성 · ○ 미달 · &nbsp;· = 아직 판정 불가 · 👑 운영자(킬 지표에서 제외) · 활동 = 앱 열람(app_open)·기록·AI 호출 등 모든 이벤트 · 새로고침하면 최신</div>
</body></html>`);
    } catch (e) {
      res.status(500).send("계기판 오류: " + (e instanceof Error ? e.message : String(e)));
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
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
