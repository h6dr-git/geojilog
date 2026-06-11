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
