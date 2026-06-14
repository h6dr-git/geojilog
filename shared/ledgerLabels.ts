// 장부 금액 라벨 — 지출을 '소비'가 아니라 시장 유통의 긍정 프레이밍으로 표현 (피드백 2026-06).

export const LEDGER_LABELS = {
  /** 시중 정가 · 원래 나갈 뻔한 금액 */
  original: "시중가",
  originalLong: "시중가 (원래 나갈 뻔한 금액)",
  /** actualAmount — 돈이 시장으로 흘러간 양 */
  actual: "시장에 보낸 돈",
  actualHint: "이만큼 시장을 돌렸어요 — 소비가 아니라 유통이에요",
  profit: "수익",
  earnAmount: "벌어들인 금액",
  earnHint: "알바·용돈 등 실제로 들어온 돈",
} as const;
