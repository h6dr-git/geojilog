// 집무실 IP 레이어 — 캐릭터·사무소 성장·세계관 초석 (장부=유틸, 홈=IP 무대).
import { CALC_MODEL, CHARACTER_NAME, CPA_NAME } from "@/lib/brand";
import type { Speaker } from "@/components/SpeakerBadge";

export type CastMember = {
  speaker: Speaker;
  name: string;
  role: string;
};

/** 절약사무소 상주 캐릭터 — IP·굿즈·이모티콘의 얼굴 */
export const OFFICE_CAST: CastMember[] = [
  { speaker: "ssal", name: CHARACTER_NAME, role: `${CALC_MODEL} · 마스코트` },
  { speaker: "cpa", name: CPA_NAME, role: "회계 담당" },
  { speaker: "dosa", name: "고문", role: "도사 · 자문" },
];

export const IP_BEAT_LABELS: Record<Speaker, string> = {
  dosa: "고문의 자문",
  cpa: "회시생의 한마디",
  ssal: "쌀집이 출력",
};

/** 해금 비품 수만으로 사무소 톤 — 금액·점수 노출 없음 */
export function officeTagline(propCount: number): string {
  if (propCount >= 5) return "기록이 만든, 사장님만의 절약사무소";
  if (propCount >= 3) return "비품이 차오르는 사무실";
  if (propCount >= 2) return "조금씩 채워지는 집무실";
  return "기록과 함께 자라는 공간";
}
