// 하단 탭바 v2 — 인스타 신UI 문법(박상욱 제공 스크린샷 기준):
// 아이콘만(라벨 없음) · 순백에 가까운 부유 필 · 활성 = 진하고 살짝 큰 아이콘. (#35)
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
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-3.5rem)] max-w-xs"
      style={{ bottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex items-center rounded-full border px-2"
        style={{
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(18px) saturate(1.5)",
          WebkitBackdropFilter: "blur(18px) saturate(1.5)",
          borderColor: "rgba(26, 26, 23, 0.05)",
          boxShadow: "0 8px 28px rgba(26, 26, 23, 0.16)",
          height: "58px",
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="flex-1 h-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <Icon
                size={active ? 26 : 24}
                strokeWidth={active ? 2.5 : 1.8}
                className={`transition-all duration-150 ${active ? "text-ink" : "text-ink-faint"}`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
