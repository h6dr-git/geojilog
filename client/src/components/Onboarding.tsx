// 온보딩 — 깔자마자 만나는 '다크 포털'. 세계관(도사의 첫 가르침)으로 후킹하고,
// 가입 없이 바로 첫 기록(첫 수익)으로 0마찰 입장시킨다. (바이블 6장 / 1번 목업)
// 기기당 1회만 표시(Shell이 localStorage로 판정). 버튼을 누르면 바로 사진 캡처로 간다.
import Hwasubun from "@/components/Hwasubun";
import { APP_NAME } from "@/lib/brand";
import { Camera } from "lucide-react";

export default function Onboarding({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center bg-[#16201A]">
      {/* 앱 이름 — 자간 넓은 모노 */}
      <p className="text-[13px] font-mono tracking-[0.4em] text-[#8ba896] mb-10">{APP_NAME}</p>

      {/* 자르르 (골드 글로우) */}
      <div className="mb-9" style={{ filter: "drop-shadow(0 10px 28px rgba(240,200,80,0.22))" }}>
        <Hwasubun level={0.72} size={140} />
      </div>

      {/* 도사의 첫 가르침 — 세계관의 진지한 한 줄 */}
      <p className="text-[22px] leading-relaxed font-semibold italic text-[#FAF8F3] max-w-[18rem]">
        “안 쓴 돈은 잃은 게 아니라,<br />지킨 겁니다.”
      </p>
      <p className="mt-3 text-[12px] text-[#7e9888]">— 도사의 첫 가르침</p>

      {/* 0마찰 입장 버튼 — 바로 첫 기록으로 */}
      <button
        onClick={onStart}
        className="mt-12 w-full max-w-[18rem] bg-emerald-500 text-white font-medium py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-transform shadow-lg shadow-emerald-500/30"
      >
        <Camera size={18} /> 내 첫 절약, 찾으러 가기
      </button>
      <p className="mt-4 text-[12px] text-[#6f8a7a]">가입 없이 바로 시작 · 1분이면 첫 수익</p>
    </div>
  );
}
