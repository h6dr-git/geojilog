// 쌀집이의 책상 선반 (집무실 안 B′) — 기록이 쌓일수록 비품이 하나씩 늘어난다. (#41 v3: 자르르→쌀집이)
// 기준: 복합 점수 = '이달' 기록 건수 + (이달 수익 ₩10,000당 1점). 숫자는 절대 표시하지 않는다(민감정보 0).
// 월 단위 초기화(피드백): 매달 깡통부터 다시 — 계속 쌓이면 효용이 떨어지므로. 잃는 건 '지난달 선반'뿐, 기록은 그대로.
// 비품은 마스코트와 같은 프로토타입 톤의 코드 SVG.
import type { ReactElement } from "react";

export type ShelfItem = { key: string; name: string; threshold: number };

export const SHELF_ITEMS: ShelfItem[] = [
  { key: "can", name: "깡통", threshold: 0 },
  { key: "bowl", name: "밥그릇", threshold: 4 },
  { key: "cushion", name: "방석", threshold: 10 },
  { key: "plant", name: "화분", threshold: 20 },
  { key: "teapot", name: "찻주전자", threshold: 35 },
];

// 복합 해금 점수 — 건수 + 액수(만원당 1점)
export function shelfScore(count: number, totalProfit: number): number {
  return count + Math.floor(Math.max(0, totalProfit) / 10000);
}
export function unlockedItems(score: number): ShelfItem[] {
  return SHELF_ITEMS.filter((it) => score >= it.threshold);
}

function Can() {
  return (
    <svg width="26" height="30" viewBox="0 0 26 30">
      <ellipse cx="13" cy="5" rx="9" ry="3" fill="#e0d8c8" stroke="#a39a82" strokeWidth="1.2" />
      <path d="M4,5 L4,25 C4,27 22,27 22,25 L22,5" fill="#d8d0c0" stroke="#a39a82" strokeWidth="1.2" />
      <rect x="4" y="12" width="18" height="6" rx="1" fill="#f5ecd8" stroke="#c9b896" strokeWidth="0.6" />
      <ellipse cx="13" cy="5" rx="7" ry="1.5" fill="#fff" opacity="0.35" />
    </svg>
  );
}
function Bowl() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26">
      <ellipse cx="15" cy="10" rx="11" ry="4" fill="#ffffff" stroke="#b9854f" strokeWidth="1.5" />
      <path d="M4,10 C4,19 9,23 15,23 C21,23 26,19 26,10" fill="#b9854f" stroke="#8f6336" strokeWidth="1.5" />
      <ellipse cx="15" cy="9" rx="8" ry="2.5" fill="#fffdf4" />
    </svg>
  );
}
function Cushion() {
  return (
    <svg width="34" height="22" viewBox="0 0 34 22">
      <rect x="3" y="6" width="28" height="12" rx="6" fill="#e8b84a" stroke="#c79a32" strokeWidth="1.5" />
      <rect x="8" y="9" width="18" height="6" rx="3" fill="#f2c94c" />
      <circle cx="3.5" cy="12" r="2" fill="#c79a32" />
      <circle cx="30.5" cy="12" r="2" fill="#c79a32" />
    </svg>
  );
}
function Plant() {
  return (
    <svg width="26" height="32" viewBox="0 0 26 32">
      <path d="M13,16 C13,9 8,7 5,6 C5,12 8,15 12,16 Z" fill="#4ba36f" />
      <path d="M13,16 C13,8 18,6 21,5 C21,12 18,15 14,16 Z" fill="#3a8f5d" />
      <line x1="13" y1="16" x2="13" y2="20" stroke="#3a8f5d" strokeWidth="1.5" />
      <path d="M6,20 L20,20 L18,30 L8,30 Z" fill="#b9854f" stroke="#8f6336" strokeWidth="1.5" />
    </svg>
  );
}
function Teapot() {
  return (
    <svg width="34" height="28" viewBox="0 0 34 28">
      <ellipse cx="16" cy="18" rx="11" ry="8" fill="#cda35f" stroke="#8f6336" strokeWidth="1.5" />
      <path d="M27,14 C31,14 32,18 30,20 L26,21" fill="none" stroke="#8f6336" strokeWidth="2" strokeLinecap="round" />
      <path d="M10,9 C12,6 20,6 22,9" fill="none" stroke="#8f6336" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="8" r="2.5" fill="#e8b84a" stroke="#8f6336" strokeWidth="1.2" />
      <ellipse cx="16" cy="11" rx="6" ry="2" fill="#b9854f" stroke="#8f6336" strokeWidth="1.2" />
    </svg>
  );
}

const RENDER: Record<string, () => ReactElement> = {
  can: Can, bowl: Bowl, cushion: Cushion, plant: Plant, teapot: Teapot,
};

export default function JarureuShelf({
  score,
  highlightKey,
  rail = true,
  showLocked = false,
}: {
  score: number;
  highlightKey?: string | null;
  rail?: boolean;
  /** IP 컬렉션 — 미해금 비품 실루엣 표시 */
  showLocked?: boolean;
}) {
  const items = showLocked ? SHELF_ITEMS : unlockedItems(score);
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-col items-center ${showLocked ? "office-prop-row" : ""}`} aria-label="쌀집이의 비품">
      <div className="flex items-end justify-center gap-2.5 px-1">
        {items.map((it) => {
          const C = RENDER[it.key];
          const locked = showLocked && score < it.threshold;
          return (
            <span
              key={it.key}
              title={locked ? `${it.name} (아직)` : it.name}
              className={`flex flex-col items-center gap-0.5 ${
                it.key === highlightKey ? "animate-prop-in" : ""
              } ${locked ? "office-prop--locked" : "office-prop--owned"}`}
            >
              <C />
              {showLocked && (
                <span className="office-prop-label">{it.name}</span>
              )}
            </span>
          );
        })}
      </div>
      {/* 선반 라인 — 책상 위(#62)에선 책상면이 바닥이므로 숨김 */}
      {rail && (
        <div className="h-px w-40 mt-0.5 rounded-full" style={{ background: "linear-gradient(90deg, transparent, #d9cfb6 20%, #d9cfb6 80%, transparent)" }} />
      )}
    </div>
  );
}
