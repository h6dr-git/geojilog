// #60 기록의 복리 — 회시생 인텔: 기록이 쌓일수록 정밀해지는 개인화 인사이트 합성.
// 원칙: ① 숫자가 있는 말만 한다(빈말 금지·신빙성) ② 표본 부족이면 침묵(null — 말의 경제)
//       ③ LLM 호출 0 — 전부 로컬 통계. 사진첩은 백날 써도 나를 모르지만, 이 장부는 알아간다.
import { SavingsEntry } from "@/lib/ledger";
import { dayOfWeekRhythm } from "@/lib/stats";

import { won } from "@/lib/format";

const KO = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function streakWithToday(entries: SavingsEntry[]): number {
  // 오늘 저장을 포함한 연속 기록일 (오늘부터 거꾸로)
  const days = new Set(entries.map((e) => e.date));
  const d = new Date(); d.setHours(0, 0, 0, 0);
  let n = 1; // 방금 저장한 오늘
  for (;;) {
    d.setDate(d.getDate() - 1);
    if (days.has(iso(d))) n += 1;
    else break;
  }
  return n;
}

// ── 리빌 인텔 — 저장 직후 한 줄 (entries = 저장 직전 캐시) ──
export function intelRevealLine(
  entries: SavingsEntry[],
  detail: { profit: number }
): string | null {
  // 1) 단건 신기록 (표본 3건부터 — 두 건짜리 "신기록"은 호들갑)
  if (entries.length >= 3) {
    const prevMax = Math.max(...entries.map((e) => e.profit));
    if (detail.profit > prevMax) {
      return `단건 최고 수익 갱신입니다 — 종전 ${won(prevMax)}.`;
    }
  }
  // 2) 마일스톤 — n번째 거래
  const nth = entries.length + 1;
  if ([10, 30, 50, 100, 200, 365].includes(nth)) {
    return `${nth}번째 거래입니다. 장부가 두꺼워지고 있습니다.`;
  }
  // 3) 황금 요일 — 내 데이터가 말해주는 리듬 (표본 10건부터)
  if (entries.length >= 10) {
    const rhythm = dayOfWeekRhythm(entries);
    const top = rhythm.reduce((a, b) => (b.avg > a.avg ? b : a));
    const todayDow = (new Date().getDay() + 6) % 7;
    if (top.avg > 0 && top.day === todayDow) {
      return `사장님의 황금 요일은 ${KO[(top.day + 1) % 7]}요일 — 오늘입니다.`;
    }
  }
  // 4) 연속 계상 (3일부터, 7일 단위는 더 크게)
  const st = streakWithToday(entries);
  if (st >= 3 && (st <= 5 || st % 7 === 0)) {
    return `${st}일 연속 계상입니다.`;
  }
  return null;
}

// ── 주간 인텔 — 서재 주간 보고 한 줄 (이번 주, offset 0 전용) ──
export function intelWeeklyLine(
  entries: SavingsEntry[],
  range: { start: string; end: string }
): string | null {
  const thisWeek = entries.filter((e) => e.date >= range.start && e.date <= range.end);
  if (thisWeek.length === 0) return null;
  const lastStart = new Date(range.start + "T00:00:00"); lastStart.setDate(lastStart.getDate() - 7);
  const lastEndSame = new Date(range.end + "T00:00:00"); lastEndSame.setDate(lastEndSame.getDate() - 7);
  const lastWeekSame = entries.filter((e) => e.date >= iso(lastStart) && e.date <= iso(lastEndSame));

  // 1) 수익원 다변화 (이번 주 2종 이상 + 지난주 대비 증가)
  const srcs = (list: SavingsEntry[]) => new Set(list.map((e) => e.incomeSource).filter(Boolean)).size;
  const a = srcs(thisWeek), b = srcs(lastWeekSame);
  if (a >= 2 && a > b) {
    return `수익원 ${a}종으로 다변화 — 지난주보다 ${a - b}종 늘었습니다.`;
  }
  // 2) 같은 시점 페이스 비교 (지난주에도 기록이 있을 때만 — 근거 있는 비교)
  if (lastWeekSame.length > 0) {
    const sum = (l: SavingsEntry[]) => l.reduce((s, e) => s + e.profit, 0);
    const diff = sum(thisWeek) - sum(lastWeekSame);
    if (diff !== 0) {
      return `지난주 같은 시점 대비 ${diff > 0 ? "+" : "−"}${won(Math.abs(diff))} ${diff > 0 ? "앞서" : "뒤져"} 있습니다.`;
    }
  }
  return null;
}

// ── 누적의 의미 번역 — "이 돈이 무엇인가" (전체 탭) ──
// 기준값은 보수적 상식선: 치킨 20,000 · 영화 15,000 · 천원아침 1,000
export function meaningOfTotal(total: number): string | null {
  if (total < 10000) return null;
  const chicken = Math.floor(total / 20000);
  const movie = Math.floor(total / 15000);
  const breakfast = Math.floor(total / 1000);
  if (chicken >= 1) return `환산하면 치킨 ${chicken}마리 — 또는 영화 ${movie}편, 천원아침 ${breakfast}끼.`;
  return `환산하면 영화 ${movie}편 — 또는 천원아침 ${breakfast}끼.`;
}

// ── 책상 메모 (#62) — 집무실 상주 보고. 회시생의 '서면 보고'라 매일 있어도 세계관 정합
//    (육성이 희소한 것이지, 보고서 작성은 그의 업무다). 숫자 있으면 인텔, 없으면 상태 한 줄.
export function intelDeskLine(entries: SavingsEntry[], fedToday: boolean): string {
  if (entries.length < 3) {
    return "장부가 자라는 중입니다. 기록이 쌓일수록 보고도 깊어집니다.";
  }
  if (fedToday) {
    const st = streakWithToday(entries.filter((e) => e.date < iso(new Date())));
    if (st >= 2) return `금일 계상 완료 — ${st}일 연속입니다.`;
    // 이번 주 페이스 (지난주 같은 시점과 비교, 지난주 데이터 있을 때만)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const pace = intelWeeklyLine(entries, { start: iso(mon), end: iso(today) });
    if (pace) return `금일 계상 완료. ${pace}`;
    return "금일 계상 완료. 장부 이상 없습니다.";
  }
  // 아직 기록 전
  if (entries.length >= 10) {
    const rhythm = dayOfWeekRhythm(entries);
    const top = rhythm.reduce((a, b) => (b.avg > a.avg ? b : a));
    const todayDow = (new Date().getDay() + 6) % 7;
    if (top.avg > 0 && top.day === todayDow) {
      return `오늘은 사장님의 황금 요일입니다. 장부가 기다립니다.`;
    }
  }
  return "금일 계상 전입니다.";
}
