// 로그인 가시성 칩 — '박CEO' 상태를 숫자 없이 안전하게 보여준다.
// 집무실(홈) 헤더처럼 남이 봐도 안전한 자리에 둔다.
// 카카오 로그인=골드 왕관+에메랄드 점 / 게스트=회색 점. 수익·통계는 절대 표시하지 않음.
import { useAuth } from "@/hooks/useAuth";
import { Crown } from "lucide-react";

export default function LoginChip({ onClick }: { onClick?: () => void }) {
  const { user } = useAuth();
  const isKakao = user?.loginMethod === "kakao";
  const name = user?.name || "사장님";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isKakao ? `${name} · 카카오 로그인됨` : `${name} · 게스트`}
      className="flex items-center gap-1.5 rounded-full border border-line bg-white/80 pl-1 pr-2.5 py-1 active:scale-[0.97] transition-transform"
    >
      <span className="w-5 h-5 rounded-full bg-[#f6edd6] flex items-center justify-center shrink-0">
        <Crown size={12} className="text-gold" />
      </span>
      <span className="text-caption font-medium text-ink leading-none">{name}</span>
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full ${isKakao ? "bg-emerald-500" : "bg-ink-faint"}`}
      />
    </button>
  );
}
