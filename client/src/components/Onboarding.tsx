// 온보딩 — 깔자마자 만나는 '다크 포털'. 고문의 어록(정본 1)으로 후킹하고,
// 가입 없이 바로 첫 기록(첫 수익)으로 0마찰 입장시킨다. (세계관_바이블 v1.3 — 입장=개업)
// 기기당 1회만 표시(Shell이 localStorage로 판정). 버튼을 누르면 바로 사진 캡처로 간다.
import SsalCalc from "@/components/SsalCalc";
import { APP_NAME } from "@/lib/brand";
import { trpc } from "@/lib/trpc";
import { Camera } from "lucide-react";

export default function Onboarding({ onStart, onKakao }: { onStart: () => void; onKakao: () => void }) {
  // 카카오 키가 설정된 환경에서만 버튼 노출 (로컬 dev 등 미설정 시 숨김)
  const { data: authConfig } = trpc.auth.config.useQuery();
  const kakaoEnabled = authConfig?.kakaoEnabled ?? false;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(16,185,129,0.12) 0%, transparent 50%), linear-gradient(180deg, #16201A 0%, #0f1812 100%)" }}
    >
      {/* 앱 이름 — 자간 넓은 모노 */}
      <p className="text-body font-mono tracking-[0.45em] text-[#8ba896] mb-10 uppercase">{APP_NAME}</p>

      {/* 마스코트 (골드 글로우) */}
      <div className="mb-9" style={{ filter: "drop-shadow(0 10px 28px rgba(240,200,80,0.22))" }}>
        <SsalCalc level={0.72} size={140} display="0" />
      </div>

      {/* 고문의 어록 — 정본 1 (덤덤한 관찰, 가르치지 않는다) */}
      <p className="text-[22px] leading-relaxed font-semibold italic text-cream max-w-[18rem]">
        “기록된 절약은,<br />사라지지 않는다.”
      </p>
      <p className="mt-3 text-caption text-[#7e9888]">— 무일푼 도사 (고문)</p>

      {/* 0마찰 입장 버튼 — 바로 첫 기록으로 */}
      <button
        onClick={onStart}
        className="mt-12 w-full max-w-[18rem] btn-primary py-4 rounded-card text-body"
      >
        <Camera size={18} /> 첫 수익, 찾으러 가기
      </button>
      <p className="mt-3 text-caption text-[#6f8a7a]">가입 없이 바로 시작 · 1분이면 첫 수익</p>

      {/* 이미 쓰던 사람·바로 가입하고 싶은 사람용 — 카카오 로그인 병행 (SSOT §9-3) */}
      {kakaoEnabled && (
        <button
          onClick={onKakao}
          className="mt-4 w-full max-w-[18rem] bg-[#FEE500] text-[#191600] font-medium py-3.5 rounded-card flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          카카오로 로그인
        </button>
      )}
    </div>
  );
}
