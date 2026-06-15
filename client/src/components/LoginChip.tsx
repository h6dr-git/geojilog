// 로그인 칩 — 절약사무소 톤
import { useAuth } from "@/hooks/useAuth";

export default function LoginChip({ onClick }: { onClick?: () => void }) {
  const { user } = useAuth();
  const isKakao = user?.loginMethod === "kakao";
  const name = user?.name || "사장님";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isKakao ? `${name} · 카카오 로그인됨` : `${name} · 게스트`}
      className="flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 active:scale-[0.96] transition-transform"
      style={{
        background: "var(--color-paper)",
        border: "1px solid var(--color-parchment)",
        boxShadow: "0 2px 8px rgba(36,31,24,0.06)",
      }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-micro font-bold"
        style={{
          background: "var(--color-walnut)",
          color: "var(--color-gold)",
        }}
      >
        {name.charAt(0)}
      </span>
      <span className="text-micro font-semibold text-warm-ink leading-none">{name}</span>
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: isKakao ? "#c9a05a" : "var(--color-parchment)",
          boxShadow: isKakao ? "0 0 4px rgba(201,160,90,0.5)" : undefined,
        }}
      />
    </button>
  );
}
