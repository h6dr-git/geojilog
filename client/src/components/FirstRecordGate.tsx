// 첫 기록 게이트 (#55) — 기록 0건인 사장님은 첫 기록(aha: 사진→원가 계산→리빌)까지 앱이 놓아주지 않는다.
// 상욱 지시(2026-06-12): "처음 쓰는 사람은 사진 올리면 원가 계산해주는 그걸 강제로 하게 해야 함."
// 사진 선택을 취소해도 이 게이트로 돌아온다(조건: 기록 0 && 진행 중인 분석 없음). 탈출구는 직접 입력뿐.
// 카피 규칙: 세계관 v1.3 — 시스템 캡션 주어=회시생, 빈말 금지, 번 돈 프레임.
import SsalCalc from "@/components/SsalCalc";
import { Camera, PenLine } from "lucide-react";

export default function FirstRecordGate({
  onPhoto,
  onManual,
}: {
  onPhoto: () => void;
  onManual: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center px-8 text-center bg-forest">
      <p className="text-micro font-mono tracking-[0.3em] mb-8" style={{ color: "#7E8C82" }}>
        개업 첫 기록
      </p>

      <div className="mb-8" style={{ filter: "drop-shadow(0 10px 28px rgba(240,200,80,0.18))" }}>
        <SsalCalc level={0.4} size={120} display="8282" />
      </div>

      <p className="text-title font-semibold leading-relaxed max-w-[19rem]" style={{ color: "#F4EFE3" }}>
        사장님, 증빙 한 장이면<br />원가는 제가 계산합니다.
      </p>
      <p className="mt-3 text-caption leading-relaxed" style={{ color: "#9aa89e" }}>
        오늘 먹은 것, 싸게 산 것, 얻어먹은 것 —<br />아무거나 됩니다.
      </p>

      <button
        onClick={onPhoto}
        className="mt-10 w-full max-w-[18rem] bg-emerald-500 text-white font-medium py-4 rounded-card flex items-center justify-center gap-2 active:scale-[0.99] transition-transform shadow-lg shadow-emerald-500/30"
      >
        <Camera size={18} /> 사진 한 장 올리기
      </button>

      <button
        onClick={onManual}
        className="mt-4 flex items-center gap-1.5 text-caption py-2 px-3"
        style={{ color: "#6f8a7a" }}
      >
        <PenLine size={12} /> 사진이 없어요 — 직접 적기
      </button>
    </div>
  );
}
