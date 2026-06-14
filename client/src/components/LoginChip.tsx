// 로그인 가시성 칩 — '박CEO' 상태를 숫자 없이 안전하게 보여준다.
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
      className="surface-glass flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 active:scale-[0.96] transition-transform"
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "linear-gradient(145deg, #f8edd4 0%, #efe0b8 100%)",
          boxShadow: "0 1px 3px rgba(224,169,46,0.25) inset",
        }}
      >
        <Crown size={12} className="text-gold" strokeWidth={2.2} />
      </span>
      <span className="text-caption font-semibold text-ink leading-none tracking-tight">{name}</span>
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full ring-2 ring-white/80 ${
          isKakao ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-ink-faint"
        }`}
      />
    </button>
  );
}
