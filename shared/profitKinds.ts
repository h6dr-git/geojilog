// 수익 4분류 — 피드백(2026-06): 절약형·받음형·절제형·실수익으로 세상 모든 '번 돈'을 기록.
// incomeSource(세부 유형)와 직교하는 상위 축. null/미지정 시 inferProfitKind로 추론.

export const PROFIT_KINDS = ["save", "receive", "restrain", "earn"] as const;
export type ProfitKind = (typeof PROFIT_KINDS)[number];

export const PROFIT_KIND_LABELS: Record<ProfitKind, string> = {
  save: "절약형",
  receive: "받음형",
  restrain: "절제형",
  earn: "실수익",
};

export const PROFIT_KIND_HINTS: Record<ProfitKind, string> = {
  save: "원래 나갈 돈보다 덜 나갔어요",
  receive: "누군가 대신 내줬거나, 사실상 빚이 면제됐어요",
  restrain: "써야 할 돈을 참았거나 대신 했어요",
  earn: "알바·용돈 등 돈을 직접 벌었어요",
};

const EARN_SOURCE_RE = /알바|아르바이트|용돈|월급|급여|수입|벌|일당|프리랜|과외|타업|실수익/;

export function isProfitKind(v: unknown): v is ProfitKind {
  return typeof v === "string" && (PROFIT_KINDS as readonly string[]).includes(v);
}

/** 수익원·금액 패턴으로 기본 분류 추론 (사용자가 칩으로 덮어쓸 수 있음) */
export function inferProfitKind(
  incomeSource: string | null | undefined,
  originalAmount: number,
  actualAmount: number
): ProfitKind {
  const src = (incomeSource ?? "").trim();
  if (EARN_SOURCE_RE.test(src)) return "earn";
  if (src === "참음/대체") return "restrain";
  if (src === "얻어먹음" || src === "공짜/이벤트") return "receive";
  if (actualAmount === 0 && originalAmount > 0 && (src === "얻어먹음" || src === "공짜/이벤트" || src === "참음/대체")) {
    return src === "참음/대체" ? "restrain" : "receive";
  }
  return "save";
}

/** 실수익형: 벌어들인 금액만 입력 → original=금액, actual=0 */
export function amountsForProfitKind(
  kind: ProfitKind,
  originalAmount: number,
  actualAmount: number
): { originalAmount: number; actualAmount: number; profit: number } {
  if (kind === "earn") {
    const earned = Math.max(0, Math.round(originalAmount));
    return { originalAmount: earned, actualAmount: 0, profit: earned };
  }
  const orig = Math.max(0, Math.round(originalAmount));
  const act = Math.max(0, Math.round(actualAmount));
  return { originalAmount: orig, actualAmount: act, profit: orig - act };
}
