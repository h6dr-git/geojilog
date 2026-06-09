// 하단 탭바 — 집무실 · 장부 · [📷 기록(가운데)] · 회장님
// 가운데 '기록'은 탭(페이지)이 아니라 사진 캡처 액션이다(onCapture). 나머지 셋만 탭 전환.
import { Home, BookText, Camera, Crown } from "lucide-react";

export type MainNavTab = "home" | "records" | "profile";

type TabItem = { key: MainNavTab; label: string; Icon: typeof Home };

const LEFT: TabItem[] = [
  { key: "home", label: "집무실", Icon: Home },
  { key: "records", label: "장부", Icon: BookText },
];
const RIGHT: TabItem[] = [{ key: "profile", label: "회장님", Icon: Crown }];

export default function BottomNav({
  tab,
  onChange,
  onCapture,
}: {
  tab: MainNavTab;
  onChange: (t: MainNavTab) => void;
  onCapture: () => void;
}) {
  const renderTab = ({ key, label, Icon }: TabItem) => {
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
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex items-end z-40 pb-[env(safe-area-inset-bottom)]">
      {LEFT.map(renderTab)}

      {/* 가운데 기록 — 캡처 액션(탭 아님) */}
      <button
        onClick={onCapture}
        aria-label="사진으로 한 끼 기록하기"
        className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-emerald-500"
      >
        <span className="-mt-6 mb-0.5 w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-white active:scale-95 transition-transform">
          <Camera size={22} />
        </span>
        기록
      </button>

      {RIGHT.map(renderTab)}
    </nav>
  );
}
