// 하단 탭바 — 절약사무소 호두 무드
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
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2.25rem)] max-w-sm"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="geo-nav__bar">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`geo-nav__tab ${active ? "geo-nav__tab--active" : ""} active:scale-95 transition-transform`}
            >
              {active && <span className="geo-nav__pill" aria-hidden="true" />}
              <Icon size={active ? 21 : 19} strokeWidth={active ? 2.3 : 1.8} className="relative z-10" />
              <span className="geo-nav__label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
