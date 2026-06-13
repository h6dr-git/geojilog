// 수익원(#37+#38) — "어떻게 번 돈인가"의 큐레이트 유형.
// category(어디에 쓴 돈)와 직교하는 축. 기록마다 하나, 미지정은 null(미분류).
// 평소가(유형별 실지출 중앙값)·장부 필터·수익원 시트가 이 축 위에서 돈다.

export const INCOME_SOURCES = [
  "천원아침",
  "학식/구내",
  "집밥/해먹음",
  "얻어먹음",
  "공짜/이벤트",
  "할인/쿠폰",
  "엔빵/공구",
  "참음/대체",
  "기타",
] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const UNCLASSIFIED = "미분류"; // null 표시용 라벨 (DB엔 null로 저장)

// #47 — 실지출이 사실상 고정인 유형: 생성 플로우에서 칩 선택 시 자동 채움(수정 가능).
// 원가(시중가)는 매번 다르므로 건드리지 않는다. 기존 기록 '수정'에는 적용하지 않는다(이미 확정된 사실).
export const FIXED_ACTUAL: Record<string, number> = {
  "천원아침": 1000,
  "공짜/이벤트": 0,
  "얻어먹음": 0,
};

// #47 — 사용자 커스텀 유형 제약 (기본 9종 외 추가분)
export const CUSTOM_SOURCE_MAX = 12; // 개수 상한 — 칩 UI가 무한히 길어지지 않게
export const CUSTOM_SOURCE_NAME_MAX = 10; // 글자수 상한 — 칩 한 줄 유지

export function isIncomeSource(v: unknown): v is IncomeSource {
  return typeof v === "string" && (INCOME_SOURCES as readonly string[]).includes(v);
}

// 백필·휴리스틱 분류 (제목/메모 키워드 → 수익원). AI 호출 없이 기존 기록을 1회 정리하는 용도.
// 순서 = 우선순위 (먼저 맞은 것 채택).
const RULES: [IncomeSource, RegExp][] = [
  ["천원아침", /천\s?원|1000원|천냥|조식/],
  ["학식/구내", /학식|학생\s?식당|구내|기숙사\s?식당|교직원\s?식당/],
  ["집밥/해먹음", /집밥|도시락|해\s?먹|해먹|직접\s?(요리|만든)|밀프렙/],
  ["얻어먹음", /얻어|사\s?줌|사줘|사주신|쏨|쏴줌|쏘심|대접|선배가|엄마가|아빠가/],
  ["공짜/이벤트", /공짜|무료|이벤트|시식|행사|증정|나눔|경품/],
  ["할인/쿠폰", /할인|쿠폰|세일|특가|적립|포인트|마감\s?할인|떨이/],
  ["엔빵/공구", /엔빵|n빵|공구|공동\s?구매|나눠\s?(냄|삼)|더치/],
  ["참음/대체", /참음|참았|안\s?(삼|샀|먹)|대체|대신|포기/],
];

export function guessIncomeSource(text: string): IncomeSource | null {
  const t = (text || "").trim();
  if (!t) return null;
  for (const [src, re] of RULES) if (re.test(t)) return src;
  return null;
}

// ── 연쇄 할인 단계 (#50 발라트로식 절약 분해) ──────────────────
// 기준가(originalAmount)에서 순서대로 차감되어 실지출(actualAmount)에 도달.
// 불변식: actualAmount === originalAmount - Σ(steps.amount). steps가 진실, 실지출은 그 결과.
export type SavingsStep = {
  source: string; // 수익원 (INCOME_SOURCES 또는 커스텀 라벨)
  label: string; // 짧은 표시 라벨 (예: "학생식당 정가")
  amount: number; // 이 단계 절약액 (원, 양의 정수)
  reason?: string; // 근거 (선택)
};

export const MAX_SAVINGS_STEPS = 4; // 단계 수 상한 — UI·추정 폭주 방지
export const STEP_LABEL_MAX = 20;

export function stepsSavedTotal(steps: readonly SavingsStep[]): number {
  return steps.reduce((s, x) => s + (Number.isFinite(x.amount) ? Math.max(0, Math.round(x.amount)) : 0), 0);
}

// 임의 입력(AI/클라)을 안전한 steps로 정규화. 유효 단계가 없으면 null.
export function normalizeSavingsSteps(input: unknown): SavingsStep[] | null {
  if (!Array.isArray(input)) return null;
  const out: SavingsStep[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const amount = Math.round(Number(r.amount));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const source = typeof r.source === "string" && r.source.trim() ? r.source.trim().slice(0, CUSTOM_SOURCE_NAME_MAX) : "기타";
    const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, STEP_LABEL_MAX) : source;
    const reason = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 200) : undefined;
    out.push({ source, label, amount, reason });
    if (out.length >= MAX_SAVINGS_STEPS) break;
  }
  return out.length ? out : null;
}

// steps를 기준가/실지출에 맞춰 보정 — 합이 절약총액(orig-act)과 어긋나면 잔차를 마지막 단계로 흡수.
export function reconcileSavingsSteps(
  steps: SavingsStep[] | null,
  originalAmount: number,
  actualAmount: number
): SavingsStep[] {
  const target = Math.max(0, Math.round(originalAmount) - Math.round(actualAmount));
  if (target <= 0) return [];
  let s = (steps ?? [])
    .map((x) => ({ ...x, amount: Math.max(0, Math.round(x.amount)) }))
    .filter((x) => x.amount > 0);
  if (s.length === 0) return [{ source: "기타", label: "절약", amount: target }];
  const sum = stepsSavedTotal(s);
  if (sum > target) {
    let over = sum - target;
    for (let i = s.length - 1; i >= 0 && over > 0; i--) {
      const cut = Math.min(s[i].amount, over);
      s[i].amount -= cut;
      over -= cut;
    }
    s = s.filter((x) => x.amount > 0);
  } else if (sum < target) {
    s[s.length - 1].amount += target - sum;
  }
  return s;
}

// 기존 기록/단일 수익원 → 단일 단계 폴백 (steps 컬럼이 비었을 때 표시용).
export function fallbackSavingsSteps(
  incomeSource: string | null,
  originalAmount: number,
  actualAmount: number
): SavingsStep[] {
  const saved = Math.max(0, Math.round(originalAmount) - Math.round(actualAmount));
  if (saved <= 0) return [];
  const src = incomeSource ?? "기타";
  return [{ source: src, label: src, amount: saved }];
}

// steps의 대표 수익원 — 가장 큰 절약 단계의 source (단일 incomeSource 컬럼 채움용).
export function primarySource(steps: readonly SavingsStep[]): string | null {
  if (!steps.length) return null;
  return steps.reduce((a, b) => (b.amount > a.amount ? b : a)).source;
}
