// ============================================================
// 주간뷰 — 주별 그리드 형식 (사진 탭 → 게시글 이동)
// ============================================================

import { useMemo } from "react";
import { TrendingUp, Share2 } from "lucide-react";
import ImageWithSkeleton from "@/components/ImageWithSkeleton";

interface Entry {
  id: number;
  date: string;
  title: string;
  description?: string | null;
  category: string;
  ticker: string;
  originalAmount: number;
  actualAmount: number;
  profit: number;
  aiEstimated: "yes" | "no";
  aiReason?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  userId: number;
}

interface Props {
  entries: Entry[];
  categoryColorMap: Record<string, string>;
  onSelectEntry: (entry: Entry) => void;
  onShareWeek?: (entries: Entry[], label: string) => void;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return mon.toISOString().split("T")[0];
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(mon)} ~ ${fmt(sun)}`;
}

export default function WeeklyView({ entries, categoryColorMap, onSelectEntry, onShareWeek }: Props) {
  const weeks = useMemo(() => {
    const map = new Map<string, { label: string; entries: Entry[]; total: number }>();
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach(e => {
      const key = getWeekKey(e.date);
      if (!map.has(key)) map.set(key, { label: getWeekLabel(e.date), entries: [], total: 0 });
      const w = map.get(key)!;
      w.entries.push(e);
      w.total += e.profit;
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
        <p className="text-sm text-muted-foreground">아직 등록된 내역이 없어요</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {weeks.map(([key, week]) => (
        <div key={key} className="mb-1">
          {/* 주간 헤더 */}
          <div className="px-4 py-3 flex items-center justify-between bg-card border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground">{week.label}</p>
              <p className="text-sm font-semibold">{week.entries.length}건</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                <TrendingUp size={12} className="text-emerald-600" />
                <span className="text-sm font-bold text-emerald-600">+₩{week.total.toLocaleString()}</span>
              </div>
              {onShareWeek && (
                <button
                  onClick={() => onShareWeek(week.entries, week.label)}
                  className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                >
                  <Share2 size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* 그리드 */}
          <div className="grid grid-cols-3 gap-0.5">
            {week.entries.map(entry => (
              <button
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="aspect-square relative overflow-hidden bg-muted active:opacity-80 transition-opacity"
              >
                {entry.imageUrl ? (
                  <ImageWithSkeleton src={entry.imageUrl} alt={entry.title} />
                ) : (
                  <div className={`w-full h-full flex flex-col items-center justify-center gap-1 p-1 ${categoryColorMap[entry.category] ?? "bg-gray-50"}`}>
                    <span className="text-xl font-bold">{entry.category.slice(0, 1)}</span>
                    <span className="text-[9px] font-medium text-center leading-tight line-clamp-2">{entry.title}</span>
                  </div>
                )}
                {/* 수익 오버레이 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-white text-[10px] font-bold">+₩{entry.profit.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
