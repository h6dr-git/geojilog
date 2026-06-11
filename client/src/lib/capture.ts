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
  priorUsualActual?: number; // 단골 사전 평소가 (#37 보너스 계산용)
  aiOriginalAmount?: number;
  /** 있으면 저장된 미완성을 완성하는 중 */
  draftId?: string;
};

export type CaptureJob =
  | { status: "analyzing"; preview: string }
  | { status: "ready"; preview: string; data: Prefill }
  | { status: "error"; preview: string; data: Prefill };
