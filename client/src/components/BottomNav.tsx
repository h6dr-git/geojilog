// 하단 탭바 — 홈 · 기록 · 프로필 (나중에 피드 탭은 여기 추가)
import { Home, Calendar, User } from "lucide-react";

export type MainNavTab = "home" | "records" | "profile";

const items: { key: MainNavTab; label: string; Icon: typeof Home }[] = [
  { key: "home", label: "홈", Icon: Home },
  { key: "records", label: "기록", Icon: Calendar },
  { key: "profile", label: "프로필", Icon: User },
];

export default function BottomNav({
  tab,
  onChange,
}: {
  tab: MainNavTab;
  onChange: (t: MainNavTab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex z-40">
      {items.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
              active ? "text-emerald-500" : "text-gray-400"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
