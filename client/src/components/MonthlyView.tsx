// ============================================================
// 월간뷰 — 캘린더 + 날짜 선택 시 해당 일 항목, 미선택 시 월 전체
// ============================================================

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function MonthlyView({ entries, categoryColorMap, onSelectEntry }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const profitByDate = useMemo(() => {
    const map: Record<string, { total: number; entries: Entry[] }> = {};
    entries.forEach(e => {
      if (!map[e.date]) map[e.date] = { total: 0, entries: [] };
      map[e.date].total += e.profit;
      map[e.date].entries.push(e);
    });
    return map;
  }, [entries]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewYear, viewMonth]);

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthProfit = useMemo(() =>
    Object.entries(profitByDate)
      .filter(([d]) => d.startsWith(monthPrefix))
      .reduce((sum, [, v]) => sum + v.total, 0),
    [profitByDate, monthPrefix]);

  // 표시할 항목: 날짜 선택 시 해당 일, 미선택 시 해당 월 전체
  const displayEntries = useMemo(() => {
    if (selectedDate) {
      return profitByDate[selectedDate]?.entries ?? [];
    }
    return entries.filter(e => e.date.startsWith(monthPrefix))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedDate, profitByDate, entries, monthPrefix]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="flex flex-col">
      {/* 캘린더 헤더 */}
      <div className="px-4 pt-4 pb-2 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center transition-colors active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="font-bold text-lg">{viewYear}년 {viewMonth + 1}월</p>
            {monthProfit > 0 && (
              <p className="text-sm text-emerald-600 font-semibold">+₩{monthProfit.toLocaleString()} 절약</p>
            )}
          </div>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center transition-colors active:scale-95">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className={`text-center text-[11px] font-medium py-1 ${d === "토" ? "text-blue-500" : d === "일" ? "text-red-500" : "text-muted-foreground"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-1 pb-2">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayData = profitByDate[dateStr];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const weekday = idx % 7;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`flex flex-col items-center py-1 rounded-xl transition-all active:scale-95 ${
                  isSelected ? "bg-emerald-500 text-white" :
                  isToday ? "bg-emerald-50 border border-emerald-300" :
                  dayData ? "hover:bg-emerald-50" : "hover:bg-muted/50"
                }`}
              >
                <span className={`text-[13px] font-medium leading-none ${
                  isSelected ? "text-white" :
                  weekday === 5 ? "text-blue-500" :
                  weekday === 6 ? "text-red-500" :
                  isToday ? "text-emerald-700 font-bold" :
                  "text-foreground"
                }`}>{day}</span>
                {dayData && (
                  <span className={`text-[9px] font-semibold mt-0.5 leading-none ${isSelected ? "text-white/90" : "text-emerald-600"}`}>
                    +{dayData.total >= 10000 ? `${Math.floor(dayData.total / 10000)}만` : dayData.total.toLocaleString()}
                  </span>
                )}
                {dayData && (
                  <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white/70" : "bg-emerald-400"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 항목 목록 */}
      {displayEntries.length > 0 ? (
        <div>
          {selectedDate && (
            <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200">
              <p className="text-xs font-semibold text-emerald-700">
                {new Date(selectedDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} — {displayEntries.length}건
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-0.5">
            {displayEntries.map(entry => (
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
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-white text-[10px] font-bold">+₩{entry.profit.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
          <p className="text-sm text-muted-foreground">
            {selectedDate
              ? `${new Date(selectedDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}에 등록된 내역이 없어요`
              : `${viewMonth + 1}월에 등록된 내역이 없어요`}
          </p>
        </div>
      )}
    </div>
  );
}
