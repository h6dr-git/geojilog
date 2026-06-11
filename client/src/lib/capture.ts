// 캡처/분석 작업 공용 타입
export type Prefill = {
  imageUrl: string;
  title: string;
  category: string;
  originalAmount: number | null;
  actualAmount: number | null;
  aiReason?: string;
  date?: string;
  memo?: string;
  /** P2 나만의 기준가 — 지난 확정가가 적용됐을 때 */
  priorOriginalAmount?: number;
  priorDate?: string;
  priorUsualActual?: number; // (구) 단골 사전 평소가 — 제목 기준, 원탭 재기록용으로만 유지
  /** #37+#38 수익원 — AI 분류값 (사용자가 칩에서 수정 가능) */
  incomeSource?: string | null;
  /** 수익원 평소가(최근 실지출 중앙값) — 보너스("평소보다 더 아낀 날") 계산용 */
  sourceUsualActual?: number;
  aiOriginalAmount?: number;
  /** 있으면 저장된 미완성을 완성하는 중 */
  draftId?: string;
};

export type CaptureJob =
  | { status: "analyzing"; preview: string }
  | { status: "ready"; preview: string; data: Prefill }
  | { status: "error"; preview: string; data: Prefill };
