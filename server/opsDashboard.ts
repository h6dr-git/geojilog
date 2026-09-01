import type { getOpsReport } from "./db/ops";
import { lastBackupInfo } from "./backup";
import { storagePersistenceInfo } from "./storage";

type OpsReport = Awaited<ReturnType<typeof getOpsReport>>;

const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

/** /ops 계기판 HTML — server/index.ts에서 분리 */
export function renderOpsDashboardHtml(r: OpsReport, opsKey: string): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const dot = (b: boolean | null) => (b === null ? "·" : b ? "●" : "○");
  const k = r.kill;
  const MIN_RATE_DEN = 5;
  const delta = (cur: number, prev: number) => {
    if (prev === 0 && cur === 0) return '<span class="dflat">—</span>';
    if (prev === 0) return `<span class="dup">+${cur}</span>`;
    const diff = cur - prev;
    const cls = diff > 0 ? "dup" : diff < 0 ? "ddn" : "dflat";
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
    return `<span class="${cls}">${arrow}${Math.abs(diff)}</span>`;
  };
  const badge = (s: "pass" | "warn" | "pending") =>
    ({ pass: "충족", warn: "미달", pending: "대기" }[s]);
  const sigVal = (s: typeof r.signals[0]) =>
    s.kind === "rate" ? (s.value == null ? "—" : pct(s.value)) : String(s.value ?? 0);
  const sigTarget = (s: typeof r.signals[0]) =>
    s.id === "d1" ? "참고" : s.kind === "rate" ? `≥${Math.round(s.target * 100)}%` : `≥${s.target}`;
  const v = r.verdict;
  const signalCards = r.signals.map((s) => `
    <div class="sig sig-${s.status}">
      <div class="sig-top"><span class="sig-label">${s.label}</span><span class="badge badge-${s.status}">${badge(s.status)}</span></div>
      <div class="sig-val">${sigVal(s)}</div>
      <div class="sig-sub">${s.num}/${s.den || "—"} · ${sigTarget(s)} · ${esc(s.hint)}</div>
    </div>`).join("");
  const verdictClass = v.status === "pass" ? "verdict-pass" : v.status === "warn" ? "verdict-warn" : "verdict-pending";
  const pulse = [
    ["오늘 활성", k.todayActive, null],
    ["오늘 기록", r.daily[r.daily.length - 1]?.entries ?? 0, null],
    ["7일 활성", k.last7dActive, delta(r.weekCompare.active.cur, r.weekCompare.active.prev)],
    ["7일 기록", r.weekCompare.entries.cur, delta(r.weekCompare.entries.cur, r.weekCompare.entries.prev)],
    ["7일 캡처", r.weekCompare.capture.cur, delta(r.weekCompare.capture.cur, r.weekCompare.capture.prev)],
    ["전체 기록", r.totals.entries, null],
  ] as const;
  const pulseHtml = pulse.map(([label, val, d]) => `
    <div class="mini"><div class="l">${label}</div><div class="v">${val}${d ? ` <span class="dwrap">${d}</span>` : ""}</div></div>`).join("");
  const attentionHtml = r.needsAttention.length
    ? r.needsAttention.map((a) => `
      <div class="alert"><span class="alert-name">${esc(a.name)}</span><span class="alert-reason">${esc(a.reason)}</span><span class="alert-when">${a.joined.slice(5)}</span></div>`).join("")
    : '<div class="empty ok">주의 대상 없음 — 전원 정상 궤도</div>';
  const maxDaily = Math.max(1, ...r.daily.map((d) => Math.max(d.active, d.entries)));
  const dailyRows = r.daily.map((d) => `
    <tr>
      <td>${d.date.slice(5)}</td>
      <td class="num">${d.signups || ""}</td>
      <td class="num">${d.active}</td>
      <td class="num">${d.entries}</td>
      <td><div class="bars">
        <div class="bar bar-a" style="width:${Math.round(d.active / maxDaily * 100)}%"></div>
        <div class="bar bar-e" style="width:${Math.round(d.entries / maxDaily * 100)}%"></div>
      </div></td>
    </tr>`).join("");
  const userRows = r.users.map((u) => `
    <tr class="${u.attention ? "row-warn" : ""}${u.isAdmin ? " row-admin" : ""}">
      <td>${esc(u.name)}${u.isAdmin ? " 👑" : ""}${u.attention ? `<span class="tag-warn">${esc(u.attention)}</span>` : ""}</td>
      <td>${u.joined.slice(5)}</td>
      <td class="num">${u.entries}</td>
      <td class="num${u.weekEntries >= 2 ? " hi" : ""}">${u.weekEntries}</td>
      <td class="num">${u.activeDays}</td>
      <td>${u.lastActive ? u.lastActive.slice(5) : "—"}</td>
      <td class="c">${u.firstRecord ? "●" : "○"}</td>
      <td class="c">${dot(u.d1)}</td>
      <td class="c">${dot(u.d7)}</td>
      <td class="c">${u.todayActive ? "🟢" : ""}</td>
    </tr>`).join("");
  const storage = storagePersistenceInfo();
  const inboxRows = r.inbox.length
    ? r.inbox.map((f) => `<div class="fb"><div class="fbm">${esc(f.text)}</div><div class="fbw">${esc(f.name)} · ${f.when.slice(5)}</div></div>`).join("")
    : '<div class="empty">아직 지시 없음 — 앱의 계정 시트 → 업무 지시로 들어옵니다</div>';
  const priceRows = r.priceFeedback.recent.length
    ? r.priceFeedback.recent.map((p) => `<div class="fb"><div class="fbm"><span class="kind">${esc(p.kind)}</span>${esc(p.text)}</div><div class="fbw">${esc(p.user)} · ${p.when.slice(5)}</div></div>`).join("")
    : '<div class="empty">아직 가격 코멘트/보정 없음 — 확인 시트에서 회시생 추정에 반박하면 쌓입니다</div>';

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="60">
<title>거지로그 계기판</title>
<style>
  :root{--pass:#34d399;--warn:#E0A92E;--pending:#7E8C82;--emerald:#10B981;--gold:#E0A92E;--bg:#16201A;--text:#F4EFE3;--muted:#7E8C82;--faint:#5E6A60}
  *{box-sizing:border-box}
  body{font-family:-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--text);margin:0 auto;padding:16px 16px 72px;max-width:760px;line-height:1.4}
  h1{font-size:17px;letter-spacing:2px;color:var(--gold);margin:0 0 2px}
  .sub{font-size:11px;color:var(--muted);margin-bottom:14px}
  h2{font-size:11px;color:var(--gold);letter-spacing:2px;margin:22px 0 8px;text-transform:uppercase}
  h2 .d{color:var(--faint);letter-spacing:0;font-weight:400;margin-left:6px;text-transform:none}
  .verdict{border-radius:16px;padding:16px 18px;margin-bottom:14px;border:1px solid rgba(255,255,255,.1)}
  .verdict-pass{background:linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.06));border-color:rgba(52,211,153,.35)}
  .verdict-warn{background:linear-gradient(135deg,rgba(224,169,46,.18),rgba(224,169,46,.06));border-color:rgba(224,169,46,.35)}
  .verdict-pending{background:rgba(255,255,255,.04)}
  .verdict-status{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:4px}
  .verdict-pass .verdict-status{color:var(--pass)} .verdict-warn .verdict-status{color:var(--warn)} .verdict-pending .verdict-status{color:var(--pending)}
  .verdict-head{font-size:22px;font-weight:800;margin-bottom:4px}
  .verdict-detail{font-size:12px;color:var(--muted)}
  .siggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:10px}
  .sig{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 11px}
  .sig-pass{border-color:rgba(52,211,153,.3)} .sig-warn{border-color:rgba(224,169,46,.35)} .sig-pending{opacity:.85}
  .sig-top{display:flex;justify-content:space-between;align-items:flex-start;gap:4px;margin-bottom:4px}
  .sig-label{font-size:10px;color:var(--muted);line-height:1.3}
  .badge{font-size:8px;font-weight:700;padding:2px 5px;border-radius:4px;letter-spacing:.3px;white-space:nowrap}
  .badge-pass{background:rgba(52,211,153,.2);color:var(--pass)} .badge-warn{background:rgba(224,169,46,.2);color:var(--warn)} .badge-pending{background:rgba(255,255,255,.08);color:var(--pending)}
  .sig-val{font-size:20px;font-weight:800;font-family:ui-monospace,monospace}
  .sig-sub{font-size:9px;color:var(--faint);margin-top:3px;line-height:1.4}
  .row3,.row6{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .row6 .mini{flex:1 1 calc(16.66% - 8px);min-width:90px}
  .row3 .mini{flex:1 1 calc(33% - 8px);min-width:100px}
  .mini{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:9px 10px}
  .mini .l{font-size:9px;color:var(--muted)} .mini .v{font-size:15px;font-weight:700;font-family:ui-monospace,monospace;margin-top:2px}
  .dwrap{font-size:11px;font-weight:600;margin-left:2px} .dup{color:var(--pass)} .ddn{color:#f87171} .dflat{color:var(--faint)}
  .alert{display:flex;align-items:center;gap:8px;background:rgba(224,169,46,.08);border:1px solid rgba(224,169,46,.25);border-radius:10px;padding:9px 12px;margin-bottom:6px;font-size:12px}
  .alert-name{font-weight:700;min-width:60px} .alert-reason{flex:1;color:var(--warn)} .alert-when{font-size:10px;color:var(--faint);font-family:ui-monospace,monospace}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{font-size:9px;color:var(--muted);text-align:left;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12);white-space:nowrap}
  td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
  .num{text-align:right;font-family:ui-monospace,monospace} .num.hi{color:var(--pass);font-weight:700}
  .c{text-align:center} .row-warn{background:rgba(224,169,46,.06)} .row-admin{opacity:.45}
  .tag-warn{display:block;font-size:9px;color:var(--warn);margin-top:1px}
  .bars{display:flex;flex-direction:column;gap:2px;min-width:80px}
  .bar{height:5px;border-radius:3px;min-width:2px}
  .bar-a{background:var(--emerald)} .bar-e{background:var(--gold);opacity:.7}
  .fb{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;margin-bottom:6px}
  .fbm{font-size:13px;line-height:1.5} .fbw{font-size:10px;color:var(--muted);margin-top:4px}
  .kind{color:var(--gold);font-size:10px;margin-right:6px}
  .empty{font-size:11px;color:var(--faint);padding:10px 2px} .empty.ok{color:var(--pass)}
  .note{font-size:10px;color:var(--faint);line-height:1.6;margin-top:8px}
  .legend{font-size:9px;color:var(--faint);display:flex;gap:12px;margin-top:4px}
  .legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:3px;vertical-align:middle}
</style></head><body>
<h1>거지로그 계기판</h1>
<div class="sub">${r.today} (KST) · 운영자 ${r.totals.users}명 · 가입자 ${k.conversion.den} · 판정대기 D1 ${r.pendingJudgments.d1} · D7 ${r.pendingJudgments.d7}</div>

<div class="verdict ${verdictClass}">
  <div class="verdict-status">${badge(v.status)}</div>
  <div class="verdict-head">${esc(v.headline)}</div>
  <div class="verdict-detail">${esc(v.detail)}</div>
</div>

<h2>킬 신호 <span class="d">가능성 평가 §4 · 운영자 제외 · 비율=${MIN_RATE_DEN}명+</span></h2>
<div class="siggrid">${signalCards}</div>
<div class="row6">${pulseHtml}</div>

<h2>주의 필요 <span class="d">후속 조치 — 1:1 확인 후보</span></h2>
${attentionHtml}

<h2>업무 지시 ${r.inbox.length ? `<span class="d">${r.inbox.length}건</span>` : ""}</h2>
${inboxRows}

<h2>일별 14일</h2>
<table><tr><th>날짜</th><th style="text-align:right">가입</th><th style="text-align:right">활성</th><th style="text-align:right">기록</th><th>추이</th></tr>${dailyRows}</table>
<div class="legend"><span><i style="background:var(--emerald)"></i>활성</span><span><i style="background:var(--gold);opacity:.7"></i>기록</span></div>

<h2>사용자 (${r.users.length})</h2>
<table><tr><th>이름</th><th>가입</th><th style="text-align:right">기록</th><th style="text-align:right">7일</th><th style="text-align:right">활동일</th><th>마지막</th><th>첫</th><th>D1</th><th>D7</th><th>오늘</th></tr>${userRows}</table>

<h2>시스템</h2>
<div class="row3">
  <div class="mini"><div class="l">AI 오늘/7일</div><div class="v">${r.totals.aiCallsToday} / ${r.totals.aiCalls7d}</div></div>
  <div class="mini"><div class="l">AI 누적</div><div class="v">${r.totals.aiCallsAll}</div></div>
  <div class="mini"><div class="l">캡처 진입</div><div class="v">${r.totals.captureViews}</div></div>
  <div class="mini"><div class="l">가격 보정</div><div class="v">${r.totals.priceCorrections}</div></div>
  <div class="mini"><div class="l">가격 코멘트</div><div class="v">${r.totals.priceComments}</div></div>
</div>
<div class="row3" style="margin-top:8px">
  <div class="mini"><div class="l">배포 커밋</div><div class="v">${process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "—"}</div></div>
  <div class="mini"><div class="l">마지막 백업</div><div class="v">${esc(lastBackupInfo()?.at?.slice(5) ?? "—")}</div></div>
  <div class="mini"><div class="l">사진 저장</div><div class="v" style="color:${storage.ok ? "var(--pass)" : "#f87171"}">${storage.label}</div></div>
</div>
<p class="note">${storage.mode === "local-recovery" ? `격리 복구 사진 ${esc(storage.dir)} — 원본 uploads와 분리됨.` : storage.mode === "volume" ? `UPLOAD_DIR=${esc(storage.dir)} — 재배포 후에도 사진 유지.` : storage.mode === "local-dev" ? `로컬 ${esc(storage.dir)} — dev 기본 경로(정상). Railway UPLOAD_DIR은 옮기지 말 것.` : "UPLOAD_DIR 미설정 — Railway 재배포 시 사진 증발 가능. Volume + UPLOAD_DIR=/data/uploads 권장."}</p>

<h2>가격 피드백</h2>
${priceRows}
<div class="note">● 달성 · ○ 미달 · · 판정 전 · 👑 운영자(지표 제외) · 7일=최근 7일 기록 수 · 활동=앱 열람·기록·AI 등</div>
<p class="note"><a href="/ops/backup?key=${opsKey}" style="color:var(--gold)">백업 JSON 다운로드</a> · 60초 자동 새로고침 · <a href="/ops?key=${opsKey}" style="color:var(--gold)">지금 새로고침</a></p>
</body></html>`;
}
