// #50 — 원가추정 정확도 A/B 평가 (로컬 전용 — Gemini 직접 호출)
// 사용법:
//   npx tsx scripts/eval-pricing.ts [사진폴더] [--baseline]
//   기본 폴더: uploads/ai-cropped
//   --baseline : 직전 커밋(HEAD)의 프롬프트(v1)도 함께 돌려 강화본(v2)과 나란히 비교
// 라벨: scripts/evalset.labels.json (파일명 → {name, orig, people}). 내가 사진을 직접 보고 매긴 시중 정가.
import * as fs from "fs";
import { execSync } from "child_process";
import { IMAGE_ANALYSIS_SYSTEM_PROMPT } from "../server/prompts";

function loadEnv() {
  try {
    for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv();

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("✗ GEMINI_API_KEY가 없습니다 (.env 확인)"); process.exit(1); }
const MODEL = process.env.LLM_MODELS?.split(",")[0]?.trim() || "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const dir = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "uploads/ai-cropped";
const doBaseline = process.argv.includes("--baseline");
const labels: Record<string, { name: string; orig: number; people: number }> =
  fs.existsSync("scripts/evalset.labels.json") ? JSON.parse(fs.readFileSync("scripts/evalset.labels.json", "utf8")) : {};

function v1Prompt(): string | null {
  try {
    const src = execSync("git show HEAD:server/prompts.ts", { encoding: "utf8" });
    const m = src.match(/IMAGE_ANALYSIS_SYSTEM_PROMPT = `([\s\S]*?)`;/);
    return m ? m[1] : null;
  } catch { return null; }
}

async function analyze(systemPrompt: string, b64: string): Promise<any> {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" } },
        { type: "text", text: "이 사진을 보고 음식/상품을 인식해서 JSON으로 반환하세요." },
      ] },
    ],
    response_format: { type: "json_object" },
  };
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const d: any = await r.json();
  let c = d.choices?.[0]?.message?.content ?? "";
  if (Array.isArray(c)) c = c.map((p: any) => p?.text ?? "").join("");
  c = String(c).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(c);
}

const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
const stepSum = (o: any) => Array.isArray(o?.savingsSteps) ? o.savingsSteps.reduce((s: number, x: any) => s + (Number(x?.amount) || 0), 0) : 0;

async function run() {
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));
  console.log(`\n평가셋: ${files.length}장  ·  모델: ${MODEL}  ·  ${doBaseline ? "v1(직전) vs v2(강화)" : "v2(강화)만"}\n`);
  const v1 = doBaseline ? v1Prompt() : null;
  if (doBaseline && !v1) console.warn("⚠ HEAD 프롬프트(v1) 추출 실패 — v2만 평가합니다\n");

  const errV2: number[] = [], errV1: number[] = [];
  let pplOkV2 = 0, pplOkV1 = 0, invOkV2 = 0, labeled = 0;
  const rows: any[] = [];

  for (const f of files) {
    const b64 = fs.readFileSync(`${dir}/${f}`).toString("base64");
    const lab = labels[f];
    let r2: any, r1: any;
    try { r2 = await analyze(IMAGE_ANALYSIS_SYSTEM_PROMPT, b64); }
    catch (e) { console.log(`✗ ${f}  v2 실패: ${(e as Error).message}`); continue; }
    if (v1) { try { r1 = await analyze(v1, b64); } catch { r1 = null; } }

    const inv = r2.estimatedOriginalAmount - stepSum(r2) - r2.estimatedActualAmount;
    if (Math.abs(inv) <= 1) invOkV2++;
    if (lab) {
      labeled++;
      errV2.push(Math.abs(r2.estimatedOriginalAmount - lab.orig));
      if (r2.estimatedPeopleCount === lab.people) pplOkV2++;
      if (r1) { errV1.push(Math.abs(r1.estimatedOriginalAmount - lab.orig)); if (r1.estimatedPeopleCount === lab.people) pplOkV1++; }
    }
    const tag = lab ? `${lab.name} (정답 ${won(lab.orig)}/${lab.people}인)` : f;
    console.log(`■ ${tag}`);
    console.log(`   v2 기준가 ${won(r2.estimatedOriginalAmount)} · 실지출 ${won(r2.estimatedActualAmount)} · ${r2.estimatedPeopleCount}인 · 단계 ${(r2.savingsSteps||[]).map((s:any)=>`${s.source} -${won(s.amount)}`).join(" → ")||"없음"} · 불변식 ${Math.abs(inv)<=1?"OK":"깨짐("+inv+")"}`);
    if (r1) console.log(`   v1 기준가 ${won(r1.estimatedOriginalAmount)} · 실지출 ${won(r1.estimatedActualAmount)} · ${r1.estimatedPeopleCount}인`);
    rows.push({ file: f, label: lab, v2: r2, v1: r1 });
  }

  const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
  console.log("\n──────── 요약 ────────");
  console.log(`불변식(기준가-Σ단계=실지출) 통과: ${invOkV2}/${files.length}`);
  if (labeled) {
    console.log(`v2 기준가 평균오차(MAE): ${won(avg(errV2))}  ·  인분 정확도: ${pplOkV2}/${labeled}`);
    if (errV1.length) console.log(`v1 기준가 평균오차(MAE): ${won(avg(errV1))}  ·  인분 정확도: ${pplOkV1}/${labeled}`);
    if (errV1.length) console.log(`→ 기준가 오차 변화: ${won(avg(errV1))} → ${won(avg(errV2))} (${avg(errV2)<avg(errV1)?"개선":"악화"})`);
  }
  fs.writeFileSync("scripts/eval-result.json", JSON.stringify(rows, null, 2));
  console.log("\n상세 결과 → scripts/eval-result.json");
}
run();
