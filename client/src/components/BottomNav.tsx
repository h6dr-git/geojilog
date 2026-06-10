// 하단 탭바 — 집무실 · 장부 · 회장님 (순수 탭 3개)
// 사진 캡처는 탭바의 일이 아니다 — 집무실 메인 버튼과 장부의 '기록 추가'가 진입점.
import { Home, BookText, Crown } from "lucide-react";

export type MainNavTab = "home" | "records" | "profile";

const TABS = [
  { key: "home" as const, label: "집무실", Icon: Home },
  { key: "records" as const, label: "장부", Icon: BookText },
  { key: "profile" as const, label: "회장님", Icon: Crown },
];

export default function BottomNav({
  tab,
  onChange,
}: {
  tab: MainNavTab;
  onChange: (t: MainNavTab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/95 backdrop-blur-sm border-t border-line flex z-40 pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-current={active ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-micro transition-colors ${
              active ? "text-emerald-600 font-semibold" : "text-ink-soft"
            }`}
          >
            {/* 활성 인디케이터 — 위쪽 짧은 바 */}
            <span
              className={`absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500 transition-opacity duration-200 ${
                active ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden="true"
            />
            <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
