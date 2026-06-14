// AI 가격 추정 학습 — 사장님 보정·코멘트를 다음 분석 프롬프트에 주입 (피드백 2026-06).
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import { savingsEntries, usageEvents, users } from "../../drizzle/schema";
import { getDb } from "./client";

export type PriceLearningHint = {
  kind: "comment" | "correction";
  category?: string;
  title?: string;
  note: string;
};

const MAX_HINTS = 8;

/** 이 사용자의 최근 가격 피드백 — LLM system prompt 부록용 */
export async function getPriceLearningHints(userId: number): Promise<PriceLearningHint[]> {
  const db = await getDb();
  if (!db) return [];
  const hints: PriceLearningHint[] = [];

  const noted = await db
    .select({
      title: savingsEntries.title,
      category: savingsEntries.category,
      userPriceNote: savingsEntries.userPriceNote,
    })
    .from(savingsEntries)
    .where(and(eq(savingsEntries.userId, userId), isNotNull(savingsEntries.userPriceNote)))
    .orderBy(desc(savingsEntries.createdAt))
    .limit(5);

  for (const e of noted) {
    const note = e.userPriceNote?.trim();
    if (note) hints.push({ kind: "comment", title: e.title, category: e.category, note });
  }

  const events = await db
    .select({ type: usageEvents.type, meta: usageEvents.meta })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        or(eq(usageEvents.type, "price_correction"), eq(usageEvents.type, "price_comment"))
      )
    )
    .orderBy(desc(usageEvents.createdAt))
    .limit(12);

  for (const ev of events) {
    if (!ev.meta) continue;
    try {
      const m = JSON.parse(ev.meta) as Record<string, unknown>;
      if (ev.type === "price_comment" && typeof m.note === "string") {
        hints.push({
          kind: "comment",
          category: typeof m.category === "string" ? m.category : undefined,
          note: m.note.slice(0, 500),
        });
      }
      if (ev.type === "price_correction") {
        const aiO = m.aiOriginal;
        const finO = m.finalOriginal;
        const aiA = m.aiActual;
        const finA = m.finalActual;
        const parts: string[] = [];
        if (aiO != null && finO != null && aiO !== finO) parts.push(`기준가 AI ${aiO}→확정 ${finO}`);
        if (aiA != null && finA != null && aiA !== finA) parts.push(`실지출 AI ${aiA}→확정 ${finA}`);
        if (parts.length) {
          hints.push({
            kind: "correction",
            category: typeof m.category === "string" ? m.category : undefined,
            note: parts.join(", "),
          });
        }
      }
    } catch { /* malformed meta */ }
  }

  // 중복 note 제거, 최신 우선
  const seen = new Set<string>();
  const out: PriceLearningHint[] = [];
  for (const h of hints) {
    const key = `${h.kind}:${h.note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= MAX_HINTS) break;
  }
  return out;
}

export function buildPriceLearningPrompt(hints: PriceLearningHint[]): string {
  if (!hints.length) return "";
  const lines = hints.map((h, i) => {
    const ctx = [h.title, h.category].filter(Boolean).join(" · ");
    const tag = h.kind === "correction" ? "보정" : "코멘트";
    return `${i + 1}. [${tag}${ctx ? ` · ${ctx}` : ""}] ${h.note}`;
  });
  return `\n\n## 이 사장님의 과거 가격 피드백 (다음 추정 시 우선 반영)\n${lines.join("\n")}\n`;
}

/** /ops 계기판 — 전체 사용자 가격 피드백 최근 목록 */
export async function getGlobalPriceFeedback(limit = 20) {
  const db = await getDb();
  if (!db) return { comments: 0, corrections: 0, recent: [] as { when: string; kind: string; text: string; user: string }[] };

  const { gte } = await import("drizzle-orm");
  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const events = await db.select().from(usageEvents).where(gte(usageEvents.createdAt, cutoff));
  const allUsers = await db.select().from(users);
  const nameOf = new Map(allUsers.map((u) => [u.id, u.name ?? `게스트${u.id}`]));

  let comments = 0;
  let corrections = 0;
  const recent: { when: string; kind: string; text: string; user: string; ts: number }[] = [];
  const kstDate = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const ev of events) {
    if (ev.type === "price_comment") comments += 1;
    if (ev.type === "price_correction") corrections += 1;
    if (ev.type !== "price_comment" && ev.type !== "price_correction") continue;
    if (!ev.meta) continue;
    try {
      const m = JSON.parse(ev.meta) as Record<string, unknown>;
      const text =
        ev.type === "price_comment" && typeof m.note === "string"
          ? m.note.slice(0, 200)
          : ev.type === "price_correction"
            ? [
                m.aiOriginal != null && m.finalOriginal != null ? `기준가 ${m.aiOriginal}→${m.finalOriginal}` : "",
                m.aiActual != null && m.finalActual != null ? `실지출 ${m.aiActual}→${m.finalActual}` : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : "";
      if (!text) continue;
      recent.push({
        when: kstDate(ev.createdAt),
        kind: ev.type === "price_comment" ? "코멘트" : "보정",
        text,
        user: nameOf.get(ev.userId) ?? `사용자${ev.userId}`,
        ts: ev.createdAt.getTime(),
      });
    } catch { /* skip */ }
  }

  recent.sort((a, b) => b.ts - a.ts);
  return {
    comments,
    corrections,
    recent: recent.slice(0, limit).map(({ when, kind, text, user }) => ({ when, kind, text, user })),
  };
}
