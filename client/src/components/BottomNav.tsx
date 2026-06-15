// 하단 탭바 v3 — 글래스 필 + 활성 필 인디케이터 + 미세 라벨
import { Home, BookText, Library } from "lucide-react";

export type MainNavTab = "home" | "records" | "profile";

const TABS = [
  { key: "home" as const, label: "집무실", Icon: Home },
  { key: "records" as const, label: "장부", Icon: BookText },
  { key: "profile" as const, label: "서재", Icon: Library },
];

export default function BottomNav({
  tab,
  onChange,
}: {
  tab: MainNavTab;
  onChange: (t: MainNavTab) => void;
}) {
  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2.5rem)] max-w-sm"
      style={{ bottom: "max(0.85rem, env(safe-area-inset-bottom))" }}
    >
      <div className="surface-glass flex items-center rounded-[1.75rem] px-1.5 h-[62px]">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex-1 h-full flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-transform"
            >
              {active && (
                <span
                  className="absolute inset-x-2 inset-y-1.5 rounded-2xl"
                  style={{
                    background: "linear-gradient(180deg, rgba(26,26,23,0.07) 0%, rgba(26,26,23,0.04) 100%)",
                    animation: "nav-pill 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both",
                  }}
                  aria-hidden="true"
                />
              )}
              <Icon
                size={active ? 22 : 20}
                strokeWidth={active ? 2.4 : 1.7}
                className={`relative z-10 transition-all duration-200 ${active ? "text-ink" : "text-ink-faint"}`}
              />
              <span
                className={`relative z-10 text-[10px] font-medium tracking-wide transition-colors duration-200 ${
                  active ? "text-ink" : "text-ink-faint"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
