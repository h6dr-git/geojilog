// ============================================================
// 월별 캘린더 뷰 — 날짜별 절약 수익 표시
// ============================================================

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Entry {
  id: number;
  date: string;
  title: string;
  profit: number;
  category: string;
}

interface Props {
  entries: Entry[];
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function CalendarView({ entries }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // 날짜별 수익 집계
  const profitByDate = useMemo(() => {
    const map: Record<string, { total: number; count: number; titles: string[] }> = {};
    entries.forEach(e => {
      if (!map[e.date]) map[e.date] = { total: 0, count: 0, titles: [] };
      map[e.date].total += e.profit;
      map[e.date].count += 1;
      map[e.date].titles.push(e.title);
    });
    return map;
  }, [entries]);

  // 이번 달 달력 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    // 월요일 시작 (0=월, 6=일)
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    // 마지막 주 채우기
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewYear, viewMonth]);

  const monthProfit = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    return Object.entries(profitByDate)
      .filter(([date]) => date.startsWith(prefix))
      .reduce((sum, [, v]) => sum + v.total, 0);
  }, [profitByDate, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={prevMonth}>
            <ChevronLeft size={14} />
          </Button>
          <span className="font-mono text-sm font-semibold">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={nextMonth}>
            <ChevronRight size={14} />
          </Button>
        </div>
        {monthProfit > 0 && (
          <span className="font-mono text-xs text-emerald-600 font-semibold">
            이번 달 ▲ ₩{monthProfit.toLocaleString()}
          </span>
        )}
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className={`text-center font-mono text-[9px] py-1 tracking-wider ${
            d === "토" ? "text-blue-500" : d === "일" ? "text-red-500" : "text-muted-foreground"
          }`}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;

          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = profitByDate[dateStr];
          const isToday = dateStr === todayStr;
          const weekday = (idx % 7); // 0=월, 5=토, 6=일

          return (
            <div
              key={dateStr}
              className={`aspect-square rounded flex flex-col items-center justify-start pt-1 px-0.5 relative transition-colors ${
                dayData ? "bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-default" : "hover:bg-muted/40"
              } ${isToday ? "ring-1 ring-emerald-400" : ""}`}
              title={dayData ? dayData.titles.join(", ") : undefined}
            >
              <span className={`font-mono text-[10px] leading-none ${
                weekday === 5 ? "text-blue-500" :
                weekday === 6 ? "text-red-500" :
                isToday ? "text-emerald-700 font-bold" :
                "text-foreground"
              }`}>{day}</span>
              {dayData && (
                <span className="font-mono text-[8px] text-emerald-600 font-semibold leading-none mt-0.5 text-center">
                  +{dayData.total.toLocaleString()}
                </span>
              )}
              {dayData && dayData.count > 1 && (
                <span className="absolute bottom-0.5 right-0.5 font-mono text-[7px] text-emerald-500">
                  {dayData.count}건
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 이번 달 항목 미니 리스트 */}
      {(() => {
        const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
        const monthEntries = entries.filter(e => e.date.startsWith(prefix));
        if (monthEntries.length === 0) return (
          <p className="font-mono text-[9px] text-muted-foreground/60 text-center py-2">이번 달 절약 내역이 없어요</p>
        );
        return (
          <div className="border-t border-border pt-2 space-y-1 max-h-36 overflow-y-auto">
            {monthEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[9px] text-muted-foreground/60 flex-shrink-0">{e.date.slice(5)}</span>
                  <span className="font-mono text-[10px] text-foreground truncate">{e.title}</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-600 font-semibold flex-shrink-0">
                  +₩{e.profit.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
