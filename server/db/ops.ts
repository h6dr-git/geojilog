// 검증 계기판 (#53) — 첫 무리 4주 킬 기준을 판정하는 지표.
// 기준 출처: 사업화_자료/거지로그_객관적_가능성_평가.md §4 (가입→첫기록 40%+, D7 ≥15% 등).
// 규모가 작으므로(수십 명) 이벤트를 통째로 당겨 JS로 계산 — 단순함이 정확성보다 깨지기 어렵다.
import { gte } from "drizzle-orm";
import { usageEvents, users, savingsEntries, feedbacks } from "../../drizzle/schema";
import { getDb } from "./client";
import { getGlobalPriceFeedback } from "./priceLearning";

const DAY = 24 * 60 * 60 * 1000;
/** KST 날짜 문자열 (YYYY-MM-DD) */
const kstDate = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const addDays = (isoDate: string, n: number) => {
  const d = new Date(isoDate + "T00:00:00Z");
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / DAY);

function rateStatus(value: number, den: number, target: number): KillSignalStatus {
  if (den < MIN_RATE_DEN) return "pending";
  return value >= target ? "pass" : "warn";
}

function countStatus(value: number, den: number, target: number): KillSignalStatus {
  if (den < 3) return "pending";
  return value >= target ? "pass" : "warn";
}

export type KillSignalStatus = "pass" | "warn" | "pending";

export type KillSignal = {
  id: string;
  label: string;
  /** rate=비율(0~1), count=절대값 */
  kind: "rate" | "count";
  value: number | null;
  num: number;
  den: number;
  target: number;
  status: KillSignalStatus;
  hint: string;
};

export type OpsUserRow = {
  id: number;
  name: string;
  loginMethod: string;
  joined: string;          // KST 가입일
  entries: number;         // 총 기록 수
  weekEntries: number;     // 최근 7일 기록 수
  activeDays: number;      // 활동일 수 (이벤트 기준)
  lastActive: string | null;
  daysSinceJoin: number;
  firstRecord: boolean;    // 첫 기록 도달
  d1: boolean | null;      // null = 아직 판정 불가(가입 당일)
  d7: boolean | null;      // null = 아직 판정 불가
  todayActive: boolean;
  isAdmin: boolean;
  attention: string | null; // 운영자 후속 필요 사유
};

export type OpsVerdict = {
  status: KillSignalStatus;
  headline: string;
  detail: string;
};

const MIN_RATE_DEN = 5; // 비율 지표 판정에 필요한 최소 표본(운영자 제외)

export async function getOpsReport() {
  const db = await getDb();
  const today = kstDate(new Date());
  const empty = {
    today,
    totals: { users: 0, entries: 0, aiCallsToday: 0, aiCalls7d: 0, aiCallsAll: 0, captureViews: 0, captureViews7d: 0, priceCorrections: 0, priceComments: 0 },
    kill: {
      conversion: { value: 0, num: 0, den: 0, target: 0.4 },
      d1: { value: 0, num: 0, den: 0 },
      d7: { value: 0, num: 0, den: 0, target: 0.15 },
      todayActive: 0, last7dActive: 0,
    },
    signals: [] as KillSignal[],
    verdict: { status: "pending" as KillSignalStatus, headline: "판정 전", detail: "아직 가입자가 없습니다." },
    needsAttention: [] as { name: string; reason: string; joined: string }[],
    pendingJudgments: { d1: 0, d7: 0 },
    weekCompare: {
      active: { cur: 0, prev: 0 },
      entries: { cur: 0, prev: 0 },
      signups: { cur: 0, prev: 0 },
      capture: { cur: 0, prev: 0 },
    },
    daily: [] as { date: string; active: number; entries: number; signups: number }[],
    users: [] as OpsUserRow[],
    inbox: [] as { name: string; text: string; when: string }[],
    priceFeedback: { recent: [] as { when: string; kind: string; text: string; user: string }[] },
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
  const weekEntriesByUser = new Map<number, number>();
  let aiToday = 0, ai7d = 0, aiAll = 0, captureViews = 0, captureViews7d = 0, priceCorrections = 0, priceComments = 0;
  const sevenDaysAgo = addDays(today, -6);
  const prevWeekStart = addDays(today, -13);
  const prevWeekEnd = addDays(today, -7);
  const AI = new Set(["ai_analyze_image", "ai_parse_sms"]);
  for (const ev of events) {
    const d = kstDate(ev.createdAt);
    if (!activeDatesByUser.has(ev.userId)) activeDatesByUser.set(ev.userId, new Set());
    activeDatesByUser.get(ev.userId)!.add(d);
    if (d >= sevenDaysAgo && ev.type === "entry_create") {
      weekEntriesByUser.set(ev.userId, (weekEntriesByUser.get(ev.userId) ?? 0) + 1);
    }
    if (AI.has(ev.type)) {
      aiAll += 1;
      if (d === today) aiToday += 1;
      if (d >= sevenDaysAgo) ai7d += 1;
    }
    if (ev.type === "capture_view") {
      captureViews += 1;
      if (d >= sevenDaysAgo) captureViews7d += 1;
    }
    if (ev.type === "price_correction") priceCorrections += 1;
    if (ev.type === "price_comment") priceComments += 1;
  }

  // 사용자 행 + 킬 지표
  const rows: OpsUserRow[] = [];
  const needsAttention: { name: string; reason: string; joined: string; priority: number }[] = [];
  let convNum = 0, convDen = 0, d1Num = 0, d1Den = 0, d7Num = 0, d7Den = 0;
  let todayActiveN = 0, last7dActiveN = 0, powerRecorders = 0, pendingD1 = 0, pendingD7 = 0;
  for (const u of allUsers) {
    const joined = kstDate(u.createdAt);
    const daysSinceJoin = daysBetween(joined, today);
    const dates = activeDatesByUser.get(u.id) ?? new Set<string>();
    const entryN = entriesByUser.get(u.id) ?? 0;
    const weekEntries = weekEntriesByUser.get(u.id) ?? 0;
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
    let attention: string | null = null;
    if (!isAdmin) {
      // 킬 지표는 운영자 본인 제외 (자기 사용으로 지표 오염 방지)
      convDen += 1;
      if (entryN > 0) convNum += 1;
      if (d1 !== null) { d1Den += 1; if (d1) d1Num += 1; } else pendingD1 += 1;
      if (d7 !== null) { d7Den += 1; if (d7) d7Num += 1; } else pendingD7 += 1;
      if (weekEntries >= 2) powerRecorders += 1;

      // 운영자 후속 필요 — 우선순위 낮을수록 먼저
      if (daysSinceJoin >= 2 && entryN === 0) {
        attention = "가입 후 첫 기록 없음";
        needsAttention.push({ name: u.name ?? `게스트${u.id}`, reason: attention, joined, priority: 1 });
      } else if (d1 === false) {
        attention = "D1 미달";
        needsAttention.push({ name: u.name ?? `게스트${u.id}`, reason: attention, joined, priority: 2 });
      } else if (entryN > 0 && lastActive && daysBetween(lastActive, today) >= 7) {
        attention = "7일+ 미활동";
        needsAttention.push({ name: u.name ?? `게스트${u.id}`, reason: attention, joined, priority: 3 });
      } else if (d7 === false) {
        attention = "D7 미달";
        needsAttention.push({ name: u.name ?? `게스트${u.id}`, reason: attention, joined, priority: 4 });
      }
    }

    rows.push({
      id: u.id,
      name: u.name ?? `게스트${u.id}`,
      loginMethod: u.loginMethod ?? "?",
      joined,
      entries: entryN,
      weekEntries,
      activeDays: dates.size,
      lastActive,
      daysSinceJoin,
      firstRecord: entryN > 0,
      d1, d7, todayActive, isAdmin, attention,
    });
  }
  needsAttention.sort((a, b) => a.priority - b.priority || (a.joined < b.joined ? -1 : 1));
  rows.sort((a, b) => {
    if (a.attention && !b.attention) return -1;
    if (!a.attention && b.attention) return 1;
    return a.joined < b.joined ? -1 : a.joined > b.joined ? 1 : a.id - b.id;
  });

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

  // #58 — 업무 지시 인박스 (최근 30)
  const { desc } = await import("drizzle-orm");
  const fb = await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt)).limit(30);
  const nameOf = new Map(allUsers.map((u) => [u.id, u.name ?? `게스트${u.id}`]));
  const inbox = fb.map((f) => ({
    name: nameOf.get(f.userId) ?? `사용자${f.userId}`,
    text: f.text,
    when: kstDate(f.createdAt),
  }));

  const priceFeedback = await getGlobalPriceFeedback(15);

  const totalEntries = entryCounts.length;
  const convValue = convDen ? convNum / convDen : 0;
  const d1Value = d1Den ? d1Num / d1Den : 0;
  const d7Value = d7Den ? d7Num / d7Den : 0;

  const signals: KillSignal[] = [
    {
      id: "conversion", label: "첫 기록 전환", kind: "rate", value: convDen ? convValue : null,
      num: convNum, den: convDen, target: 0.4,
      status: rateStatus(convValue, convDen, 0.4),
      hint: "가입 → 첫 기록",
    },
    {
      id: "d1", label: "D1 재방문", kind: "rate", value: d1Den ? d1Value : null,
      num: d1Num, den: d1Den, target: 0,
      status: "pending", // §4 킬 기준에 D1 임계 없음 — 참고용
      hint: "가입 다음날 활동",
    },
    {
      id: "d7", label: "D7 재방문", kind: "rate", value: d7Den ? d7Value : null,
      num: d7Num, den: d7Den, target: 0.15,
      status: rateStatus(d7Value, d7Den, 0.15),
      hint: "가입 +6~8일 활동",
    },
    {
      id: "power", label: "주 2회+ 기록자", kind: "count", value: powerRecorders,
      num: powerRecorders, den: convDen, target: 3,
      status: countStatus(powerRecorders, convDen, 3),
      hint: "최근 7일 2건+",
    },
    {
      id: "capture", label: "캡처 진입(7일)", kind: "count", value: captureViews7d,
      num: captureViews7d, den: 1, target: 1,
      status: countStatus(captureViews7d, convDen >= 3 ? convDen : 0, 1),
      hint: "공유 행동 프록시",
    },
  ];

  const killSignals = signals.filter((s) => s.id !== "d1");
  const evaluated = killSignals.filter((s) => s.status !== "pending");
  const warnCount = killSignals.filter((s) => s.status === "warn").length;
  const passCount = killSignals.filter((s) => s.status === "pass").length;
  let verdict: OpsVerdict;
  if (convDen === 0) {
    verdict = { status: "pending", headline: "판정 전", detail: "아직 가입자가 없습니다." };
  } else if (evaluated.length === 0) {
    verdict = { status: "pending", headline: "판정 전", detail: `표본 부족 — 비율 지표는 운영자 제외 ${MIN_RATE_DEN}명 이상 필요 (현재 ${convDen}명).` };
  } else if (warnCount > 0) {
    verdict = {
      status: "warn",
      headline: "경고 — 킬 기준 미달",
      detail: `${warnCount}개 신호 미달 · ${passCount}개 충족 · D1/D7 판정 대기 ${pendingD1 + pendingD7}명`,
    };
  } else if (passCount === killSignals.length) {
    verdict = { status: "pass", headline: "지속 트랙", detail: "킬 기준 전부 충족 — 니치 생존 트랙 유지." };
  } else {
    verdict = {
      status: "pending",
      headline: "판정 전",
      detail: `${passCount}개 충족 · ${killSignals.length - evaluated.length}개 대기 · D1/D7 판정 대기 ${pendingD1 + pendingD7}명`,
    };
  }

  // 주간 비교 — 이번 7일 vs 직전 7일
  const sumRange = (from: string, to: string) => {
    let active = 0, entries = 0, signups = 0, capture = 0;
    for (const d of daily) {
      if (d.date < from || d.date > to) continue;
      active += d.active;
      entries += d.entries;
      signups += d.signups;
    }
    for (const ev of events) {
      const ed = kstDate(ev.createdAt);
      if (ed < from || ed > to) continue;
      if (ev.type === "capture_view") capture += 1;
    }
    return { active, entries, signups, capture };
  };
  const curWeek = sumRange(sevenDaysAgo, today);
  const prevWeek = sumRange(prevWeekStart, prevWeekEnd);

  return {
    today,
    totals: { users: allUsers.length, entries: totalEntries, aiCallsToday: aiToday, aiCalls7d: ai7d, aiCallsAll: aiAll, captureViews, captureViews7d, priceCorrections, priceComments },
    kill: {
      conversion: { value: convValue, num: convNum, den: convDen, target: 0.4 },
      d1: { value: d1Value, num: d1Num, den: d1Den },
      d7: { value: d7Value, num: d7Num, den: d7Den, target: 0.15 },
      todayActive: todayActiveN, last7dActive: last7dActiveN,
    },
    signals,
    verdict,
    needsAttention: needsAttention.map(({ name, reason, joined }) => ({ name, reason, joined })),
    pendingJudgments: { d1: pendingD1, d7: pendingD7 },
    weekCompare: {
      active: { cur: curWeek.active, prev: prevWeek.active },
      entries: { cur: curWeek.entries, prev: prevWeek.entries },
      signups: { cur: curWeek.signups, prev: prevWeek.signups },
      capture: { cur: curWeek.capture, prev: prevWeek.capture },
    },
    daily,
    users: rows,
    inbox,
    priceFeedback,
  };
}
