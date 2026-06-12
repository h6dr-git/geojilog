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
import { startBackupScheduler, buildBackupDump, lastBackupInfo } from "./backup";

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
      const dot = (b: boolean | null) => (b === null ? "·" : b ? "●" : "○");
      const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
      const k = r.kill;
      // 퍼널 단계: 가입 → 첫 기록 → D1 → D7 (운영자 제외 분모)
      const stage = (label: string, num: number, den: number, rate: number | null, target?: number) => `
        <div class="st">
          <div class="sl">${label}${target != null ? `<span class="tg ${rate != null && rate >= target ? "ok" : "warn"}">기준 ${Math.round(target * 100)}%</span>` : ""}</div>
          <div class="sv">${num}<span class="sd">/${den || "—"}</span></div>
          <div class="sr">${rate == null ? "판정 전" : pct(rate)}</div>
        </div>`;
      const funnel = [
        stage("가입", k.conversion.den, k.conversion.den, null),
        stage("첫 기록", k.conversion.num, k.conversion.den, k.conversion.den ? k.conversion.value : null, k.conversion.target),
        stage("D1 재방문", k.d1.num, k.d1.den, k.d1.den ? k.d1.value : null),
        stage("D7 재방문", k.d7.num, k.d7.den, k.d7.den ? k.d7.value : null, k.d7.target),
      ].join('<div class="arrow">→</div>');
      const userRows = r.users.map((u) => `
        <tr${u.isAdmin ? ' style="opacity:.45"' : ""}>
          <td>${esc(u.name)}${u.isAdmin ? " 👑" : ""}</td><td>${u.joined.slice(5)}</td>
          <td class="num">${u.entries}</td><td class="num">${u.activeDays}</td>
          <td>${u.lastActive ? u.lastActive.slice(5) : "—"}</td>
          <td class="c">${u.firstRecord ? "●" : "○"}</td><td class="c">${dot(u.d1)}</td><td class="c">${dot(u.d7)}</td>
          <td class="c">${u.todayActive ? "🟢" : ""}</td>
        </tr>`).join("");
      const dailyRows = r.daily.map((d) => `
        <tr><td>${d.date.slice(5)}</td><td class="num">${d.signups || ""}</td><td class="num">${d.active}</td><td class="num">${d.entries}</td>
        <td><div style="height:7px;width:${Math.min(150, d.active * 14)}px;background:#10B981;border-radius:4px"></div></td></tr>`).join("");
      const inboxRows = r.inbox.length
        ? r.inbox.map((f) => `<div class="fb"><div class="fbm">${esc(f.text)}</div><div class="fbw">${esc(f.name)} · ${f.when.slice(5)}</div></div>`).join("")
        : '<div class="empty">아직 지시 없음 — 앱의 계정 시트 → 업무 지시로 들어옵니다</div>';
      res.send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>거지로그 계기판</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;background:#16201A;color:#F4EFE3;margin:0 auto;padding:20px 16px 60px;max-width:680px}
  h1{font-size:16px;letter-spacing:2px;color:#E0A92E;margin:0 0 2px} .sub{font-size:11px;color:#7E8C82;margin-bottom:16px}
  h2{font-size:11px;color:#E0A92E;letter-spacing:2px;margin:24px 0 8px;text-transform:uppercase}
  h2 .d{color:#5E6A60;letter-spacing:0;font-weight:400;margin-left:6px;text-transform:none}
  .funnel{display:flex;align-items:stretch;gap:4px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px 10px}
  .st{flex:1;text-align:center;min-width:0} .arrow{align-self:center;color:#5E6A60;font-size:12px}
  .sl{font-size:9px;color:#7E8C82;letter-spacing:.5px;white-space:nowrap} .sv{font-size:22px;font-weight:800;font-family:ui-monospace,monospace;margin-top:3px}
  .sd{font-size:11px;color:#5E6A60;font-weight:400} .sr{font-size:11px;color:#9aa89e;margin-top:1px;font-family:ui-monospace,monospace}
  .tg{display:block;font-size:8px;margin-top:1px} .tg.ok{color:#34d399} .tg.warn{color:#E0A92E}
  .row3{display:flex;gap:8px;margin-top:8px}
  .mini{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:9px 10px}
  .mini .l{font-size:9px;color:#7E8C82} .mini .v{font-size:15px;font-weight:700;font-family:ui-monospace,monospace;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{font-size:9px;color:#7E8C82;text-align:left;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12)}
  td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.05)} .num{text-align:right;font-family:ui-monospace,monospace} .c{text-align:center}
  .fb{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;margin-bottom:6px}
  .fbm{font-size:13px;line-height:1.5} .fbw{font-size:10px;color:#7E8C82;margin-top:4px}
  .empty{font-size:11px;color:#5E6A60;padding:10px 2px}
  .note{font-size:10px;color:#5E6A60;line-height:1.6;margin-top:8px}
</style></head><body>
<h1>거지로그 계기판</h1><div class="sub">${r.today} (KST) · 운영자 전용 · 새로고침 = 최신</div>

<h2>① 퍼널 <span class="d">킬 기준: 첫 기록 40%+ · D7 15%+ (가능성 평가 §4, 운영자 제외)</span></h2>
<div class="funnel">${funnel}</div>
<div class="row3">
  <div class="mini"><div class="l">오늘 활성</div><div class="v">${k.todayActive}</div></div>
  <div class="mini"><div class="l">오늘 기록</div><div class="v">${r.totals.entries ? r.daily[r.daily.length - 1]?.entries ?? 0 : 0}</div></div>
  <div class="mini"><div class="l">7일 활성</div><div class="v">${k.last7dActive}</div></div>
  <div class="mini"><div class="l">전체 기록</div><div class="v">${r.totals.entries}</div></div>
</div>

<h2>② 업무 지시 인박스 <span class="d">서면 피드백 — 반영하면 꼭 회신(루프 마감)</span></h2>
${inboxRows}

<h2>③ 일별 14일 <span class="d">가입·활성·기록</span></h2>
<table><tr><th>날짜</th><th style="text-align:right">가입</th><th style="text-align:right">활성</th><th style="text-align:right">기록</th><th></th></tr>${dailyRows}</table>

<h2>④ 사용자 (${r.users.length})</h2>
<table><tr><th>이름</th><th>가입</th><th style="text-align:right">기록</th><th style="text-align:right">활동일</th><th>마지막</th><th>첫기록</th><th>D1</th><th>D7</th><th>오늘</th></tr>${userRows}</table>

<h2>⑤ 시스템 <span class="d">비용·자산 적립</span></h2>
<div class="row3">
  <div class="mini"><div class="l">AI 오늘/7일</div><div class="v">${r.totals.aiCallsToday} / ${r.totals.aiCalls7d}</div></div>
  <div class="mini"><div class="l">AI 누적</div><div class="v">${r.totals.aiCallsAll}</div></div>
  <div class="mini"><div class="l">캡처 진입</div><div class="v">${r.totals.captureViews}</div></div>
  <div class="mini"><div class="l">가격 보정</div><div class="v">${r.totals.priceCorrections}</div></div>
</div>
<div class="note">● 달성 · ○ 미달 · &nbsp;· = 판정 전 · 👑 운영자(지표 제외) · 활동 = 앱 열람·기록·AI 등 모든 이벤트</div>
</body></html>`);
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
      res.json({ ok: true, db: "up", env, commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null, lastBackup: lastBackupInfo() });
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
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
