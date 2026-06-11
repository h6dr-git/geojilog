// 검증 계기판 (#53) — 첫 무리 4주 킬 기준을 판정하는 지표.
// 기준 출처: 사업화_자료/거지로그_객관적_가능성_평가.md §4 (가입→첫기록 40%+, D7 ≥15% 등).
// 규모가 작으므로(수십 명) 이벤트를 통째로 당겨 JS로 계산 — 단순함이 정확성보다 깨지기 어렵다.
import { gte } from "drizzle-orm";
import { usageEvents, users, savingsEntries } from "../../drizzle/schema";
import { getDb } from "./client";

const DAY = 24 * 60 * 60 * 1000;
/** KST 날짜 문자열 (YYYY-MM-DD) */
const kstDate = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const addDays = (isoDate: string, n: number) => {
  const d = new Date(isoDate + "T00:00:00Z");
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
};

export type OpsUserRow = {
  id: number;
  name: string;
  loginMethod: string;
  joined: string;          // KST 가입일
  entries: number;         // 총 기록 수
  activeDays: number;      // 활동일 수 (이벤트 기준)
  lastActive: string | null;
  firstRecord: boolean;    // 첫 기록 도달
  d1: boolean | null;      // null = 아직 판정 불가(가입 당일)
  d7: boolean | null;      // null = 아직 판정 불가
  todayActive: boolean;
  isAdmin: boolean;
};

export async function getOpsReport() {
  const db = await getDb();
  const today = kstDate(new Date());
  const empty = {
    today,
    totals: { users: 0, entries: 0, aiCallsToday: 0, aiCalls7d: 0, aiCallsAll: 0, captureViews: 0, priceCorrections: 0 },
    kill: {
      conversion: { value: 0, num: 0, den: 0, target: 0.4 },
      d1: { value: 0, num: 0, den: 0 },
      d7: { value: 0, num: 0, den: 0, target: 0.15 },
      todayActive: 0, last7dActive: 0,
    },
    daily: [] as { date: string; active: number; entries: number; signups: number }[],
    users: [] as OpsUserRow[],
  };
  if (!db) return empty;

  const allUsers = await db.select().from(users);
  const cutoff = new Date(Date.now() - 35 * DAY);
  const events = await db.select().from(usageEvents).where(gte(usageEvents.createdAt, cutoff));
  const entryCounts = await db.select({ userId: savingsEntries.userId }).from(savingsEntries);

  // 사용자별 집계 재료
  const entriesByUser = new Map<number, number>();
  for (const e of entryCounts) entriesByUser.set(e.userId, (entriesByUser.get(e.userId) ?? 0) + 1);

  const activeDatesByUser = new Map<number, Set<string>>();
  let aiToday = 0, ai7d = 0, aiAll = 0, captureViews = 0, priceCorrections = 0;
  const sevenDaysAgo = addDays(today, -6);
  const AI = new Set(["ai_analyze_image", "ai_parse_sms"]);
  for (const ev of events) {
    const d = kstDate(ev.createdAt);
    if (!activeDatesByUser.has(ev.userId)) activeDatesByUser.set(ev.userId, new Set());
    activeDatesByUser.get(ev.userId)!.add(d);
    if (AI.has(ev.type)) {
      aiAll += 1;
      if (d === today) aiToday += 1;
      if (d >= sevenDaysAgo) ai7d += 1;
    }
    if (ev.type === "capture_view") captureViews += 1;
    if (ev.type === "price_correction") priceCorrections += 1;
  }

  // 사용자 행 + 킬 지표
  const rows: OpsUserRow[] = [];
  let convNum = 0, convDen = 0, d1Num = 0, d1Den = 0, d7Num = 0, d7Den = 0;
  let todayActiveN = 0, last7dActiveN = 0;
  for (const u of allUsers) {
    const joined = kstDate(u.createdAt);
    const dates = activeDatesByUser.get(u.id) ?? new Set<string>();
    const entryN = entriesByUser.get(u.id) ?? 0;
    const sorted = Array.from(dates).sort();
    const lastActive = sorted.length ? sorted[sorted.length - 1] : null;
    const todayActive = dates.has(today);
    if (todayActive) todayActiveN += 1;
    if (sorted.some((d) => d >= sevenDaysAgo)) last7dActiveN += 1;

    // D1: 가입 다음 날 활동. 판정 가능 조건 = 가입+1일이 이미 지났음(오늘보다 과거이거나 오늘인데 활동했음)
    const d1Date = addDays(joined, 1);
    const d1: boolean | null = d1Date > today ? null : dates.has(d1Date);
    // D7: 가입 +6~+8일 창에서 활동 (하루 오차 허용). 판정 가능 = +8일이 지났음
    const d7Window = [addDays(joined, 6), addDays(joined, 7), addDays(joined, 8)];
    const d7: boolean | null = d7Window[2] > today ? null : d7Window.some((d) => dates.has(d));

    const isAdmin = u.role === "admin";
    if (!isAdmin) {
      // 킬 지표는 운영자 본인 제외 (자기 사용으로 지표 오염 방지)
      convDen += 1;
      if (entryN > 0) convNum += 1;
      if (d1 !== null) { d1Den += 1; if (d1) d1Num += 1; }
      if (d7 !== null) { d7Den += 1; if (d7) d7Num += 1; }
    }

    rows.push({
      id: u.id,
      name: u.name ?? `게스트${u.id}`,
      loginMethod: u.loginMethod ?? "?",
      joined,
      entries: entryN,
      activeDays: dates.size,
      lastActive,
      firstRecord: entryN > 0,
      d1, d7, todayActive, isAdmin,
    });
  }
  rows.sort((a, b) => (a.joined < b.joined ? -1 : a.joined > b.joined ? 1 : a.id - b.id));

  // 일별 14일 추이
  const daily: { date: string; active: number; entries: number; signups: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    let active = 0;
    activeDatesByUser.forEach((set) => { if (set.has(d)) active += 1; });
    const entriesN = events.filter((ev) => ev.type === "entry_create" && kstDate(ev.createdAt) === d).length;
    const signups = allUsers.filter((u) => kstDate(u.createdAt) === d).length;
    daily.push({ date: d, active, entries: entriesN, signups });
  }

  const totalEntries = entryCounts.length;
  return {
    today,
    totals: { users: allUsers.length, entries: totalEntries, aiCallsToday: aiToday, aiCalls7d: ai7d, aiCallsAll: aiAll, captureViews, priceCorrections },
    kill: {
      conversion: { value: convDen ? convNum / convDen : 0, num: convNum, den: convDen, target: 0.4 },
      d1: { value: d1Den ? d1Num / d1Den : 0, num: d1Num, den: d1Den },
      d7: { value: d7Den ? d7Num / d7Den : 0, num: d7Num, den: d7Den, target: 0.15 },
      todayActive: todayActiveN, last7dActive: last7dActiveN,
    },
    daily,
    users: rows,
  };
}
