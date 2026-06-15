// 쌀집이의 책상 비품 — 절약사무소 일러스트 톤 통일
import type { ReactElement } from "react";

export type ShelfItem = { key: string; name: string; threshold: number };

export const SHELF_ITEMS: ShelfItem[] = [
  { key: "can", name: "깡통", threshold: 0 },
  { key: "bowl", name: "밥그릇", threshold: 4 },
  { key: "cushion", name: "방석", threshold: 10 },
  { key: "plant", name: "화분", threshold: 20 },
  { key: "teapot", name: "찻주전자", threshold: 35 },
];

const STROKE = "#6b5340";

export function shelfScore(count: number, totalProfit: number): number {
  return count + Math.floor(Math.max(0, totalProfit) / 10000);
}
export function unlockedItems(score: number): ShelfItem[] {
  return SHELF_ITEMS.filter((it) => score >= it.threshold);
}

function Can() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28">
      <ellipse cx="12" cy="4.5" rx="8" ry="2.5" fill="#e8dfd0" stroke={STROKE} strokeWidth="1" />
      <path d="M4,4.5 L4,23 C4,24.5 20,24.5 20,23 L20,4.5" fill="#ddd4c4" stroke={STROKE} strokeWidth="1" />
      <rect x="5" y="11" width="14" height="5" rx="0.5" fill="#f5ecd8" stroke={STROKE} strokeWidth="0.6" />
    </svg>
  );
}
function Bowl() {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24">
      <ellipse cx="14" cy="9" rx="10" ry="3.5" fill="#faf6ec" stroke={STROKE} strokeWidth="1" />
      <path d="M4,9 C4,17 8.5,20.5 14,20.5 C19.5,20.5 24,17 24,9" fill="#c9a05a" stroke={STROKE} strokeWidth="1" />
    </svg>
  );
}
function Cushion() {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20">
      <rect x="3" y="5" width="24" height="11" rx="5.5" fill="#e0a92e" stroke={STROKE} strokeWidth="1" />
      <rect x="7" y="8" width="16" height="5" rx="2.5" fill="#f0c860" opacity="0.6" />
    </svg>
  );
}
function Plant() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28">
      <path d="M11,15 C11,10 8,8 5,7 C5,11 7.5,13.5 10,14.5 Z" fill="#6a9a72" stroke={STROKE} strokeWidth="0.6" />
      <path d="M11,15 C11,9 14,7 17,6 C17,11 14.5,13.5 12,14.5 Z" fill="#5a8a62" stroke={STROKE} strokeWidth="0.6" />
      <path d="M5,18 L17,18 L15.5,26 L6.5,26 Z" fill="#c9a05a" stroke={STROKE} strokeWidth="1" />
    </svg>
  );
}
function Teapot() {
  return (
    <svg width="30" height="24" viewBox="0 0 30 24">
      <ellipse cx="14" cy="15" rx="10" ry="7" fill="#d4bc8f" stroke={STROKE} strokeWidth="1" />
      <path d="M24,12 C27,12 28,15 26.5,16.5 L23,17.5" fill="none" stroke={STROKE} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9,8 C10.5,6 17.5,6 19,8" fill="none" stroke={STROKE} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="14" cy="7.5" r="2" fill="#e0a92e" stroke={STROKE} strokeWidth="0.6" />
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
  showLocked?: boolean;
}) {
  const items = showLocked ? SHELF_ITEMS : unlockedItems(score);
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-col items-center ${showLocked ? "geo-props" : ""}`} aria-label="쌀집이의 비품">
      <div className="flex items-end justify-center gap-2 px-1">
        {items.map((it) => {
          const C = RENDER[it.key];
          const locked = showLocked && score < it.threshold;
          return (
            <span
              key={it.key}
              title={locked ? `${it.name} (아직)` : it.name}
              className={`flex flex-col items-center gap-0.5 ${
                it.key === highlightKey ? "animate-prop-in" : ""
              } ${locked ? "geo-prop--locked" : "geo-prop--owned"}`}
            >
              <C />
              {showLocked && <span className="geo-prop__label">{it.name}</span>}
            </span>
          );
        })}
      </div>
      {rail && (
        <div className="h-px w-36 mt-0.5 rounded-full" style={{ background: "linear-gradient(90deg, transparent, #a08058 20%, #a08058 80%, transparent)" }} />
      )}
    </div>
  );
}
