// 하단 탭바 — 떠 있는 글래스 필(반투명+블러) 1차 시도. (피드백 #35: 인스타 신UI/리퀴드 글래스 차용)
// 참고: 실제 인스타 디자인은 미확인 — iOS 글래스 문법(반투명·블러·부유 필)으로 근사. 회장님 평가 후 조정.
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
      style={{ bottom: "max(0.8rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex p-1 rounded-full border"
        style={{
          background: "rgba(255, 255, 255, 0.68)",
          backdropFilter: "blur(20px) saturate(1.7)",
          WebkitBackdropFilter: "blur(20px) saturate(1.7)",
          borderColor: "rgba(255, 255, 255, 0.55)",
          boxShadow: "0 10px 32px rgba(26, 26, 23, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.65)",
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-caption transition-all duration-200 ${
                active ? "font-semibold text-emerald-700" : "text-ink-soft active:text-ink"
              }`}
              style={
                active
                  ? {
                      background: "rgba(255, 255, 255, 0.92)",
                      boxShadow: "0 2px 10px rgba(26, 26, 23, 0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
                    }
                  : undefined
              }
            >
              <Icon size={17} strokeWidth={active ? 2.3 : 1.9} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
