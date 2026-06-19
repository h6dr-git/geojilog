import {
  ChevronDown, ChevronLeft, ChevronRight, X, CalendarDays, Search, CheckSquare,
} from "lucide-react";
import { UNCLASSIFIED } from "@shared/incomeSources";
import { UNCLASSIFIED_KEY } from "./types";

interface LedgerToolbarProps {
  weekFilter: { start: string; end: string } | null;
  setWeekFilter: (v: null) => void;
  year: number;
  month: number;
  ym: string;
  monthInputRef: React.RefObject<HTMLInputElement | null>;
  prevMonth: () => void;
  nextMonth: () => void;
  handleMonthJump: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showCal: boolean;
  toggleCal: () => void;
  selectMode: boolean;
  selected: Set<number>;
  allVisibleIds: number[];
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
  exitSelect: () => void;
  dateScopedLength: number;
  sourceFilter: string | null;
  setSourceFilter: (v: string | null) => void;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  search: string;
  setSearch: (v: string) => void;
  incomeSourceList: string[];
  sourceCounts: Map<string, number>;
  onManageSources: () => void;
  onEnterSelectMode: () => void;
}

export default function LedgerToolbar({
  weekFilter,
  setWeekFilter,
  year,
  month,
  ym,
  monthInputRef,
  prevMonth,
  nextMonth,
  handleMonthJump,
  showCal,
  toggleCal,
  selectMode,
  selected,
  allVisibleIds,
  setSelected,
  exitSelect,
  dateScopedLength,
  sourceFilter,
  setSourceFilter,
  showSearch,
  setShowSearch,
  search,
  setSearch,
  incomeSourceList,
  sourceCounts,
  onManageSources,
  onEnterSelectMode,
}: LedgerToolbarProps) {
  return (
    <>
      {!weekFilter && (
        <div className="segment-track mb-3 animate-fade-up" style={{ animationDelay: "0.06s" }}>
          <button onClick={prevMonth} aria-label="이전 달" className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-ink-soft active:bg-cream transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
            <button
              onClick={() => monthInputRef.current?.showPicker?.() ?? monthInputRef.current?.click()}
              className="px-3 py-1.5 rounded-full text-body font-semibold text-ink active:text-emerald-600 transition-colors flex items-center gap-1"
            >
              {year}년 {month + 1}월
              <ChevronDown size={12} className="text-ink-soft" />
            </button>
            <button
              onClick={toggleCal}
              aria-label="달력 보기"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${showCal ? "segment-active" : "text-ink-soft active:bg-cream"}`}
            >
              <CalendarDays size={14} />
            </button>
          </div>
          <button onClick={nextMonth} aria-label="다음 달" className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-ink-soft active:bg-cream transition-colors">
            <ChevronRight size={16} />
          </button>
          <input ref={monthInputRef} type="month" value={ym} onChange={handleMonthJump} className="sr-only" tabIndex={-1} />
        </div>
      )}

      {weekFilter && (
        <div className="flex items-center gap-1.5 mb-2.5 px-2 py-1.5 rounded-full bg-white/80 border border-line/80 text-caption w-fit">
          <button onClick={() => setWeekFilter(null)} className="text-ink-soft underline-offset-2 active:text-ink transition-colors">
            전체
          </button>
          <ChevronRight size={11} className="text-ink-faint" />
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            {weekFilter.start.slice(5).replace("-", ".")} ~ {weekFilter.end.slice(5).replace("-", ".")} 주간
            <button onClick={() => setWeekFilter(null)} aria-label="필터 해제" className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 active:bg-emerald-200">
              <X size={9} />
            </button>
          </span>
        </div>
      )}

      {selectMode && (
        <div className="flex items-center gap-2 pb-2 mb-1 px-1">
          <span className="text-caption font-medium text-ink">{selected.size}개 선택</span>
          <button
            onClick={() => setSelected(new Set(selected.size === allVisibleIds.length ? [] : allVisibleIds))}
            className="text-caption text-emerald-600 font-medium active:opacity-70"
          >
            {selected.size === allVisibleIds.length ? "전체 해제" : "전체 선택"}
          </button>
          <div className="flex-1" />
          <button onClick={exitSelect} className="text-caption text-ink-soft active:text-ink">취소</button>
        </div>
      )}

      {!selectMode && (dateScopedLength > 0 || sourceFilter) && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => { setShowSearch((v) => { if (v) setSearch(""); return !v; }); }}
            aria-label="검색"
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all shadow-sm ${
              showSearch || search ? "bg-ink text-white shadow-md" : "bg-white border border-line/80 text-ink-soft active:bg-cream"
            }`}
          >
            <Search size={14} />
          </button>
          <button
            onClick={() => setSourceFilter(null)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-caption font-medium transition-all ${
              !sourceFilter ? "bg-ink text-white shadow-md" : "bg-white border border-line/80 text-ink-soft active:bg-cream"
            }`}
          >
            전체
          </button>
          {incomeSourceList.filter((src) => (sourceCounts.get(src) ?? 0) > 0 || sourceFilter === src).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(sourceFilter === src ? null : src)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-caption font-medium transition-all ${
                sourceFilter === src ? "bg-gold text-white shadow-md" : "bg-white border border-line/80 text-ink-soft active:bg-cream"
              }`}
            >
              {src} <span className="tabular-nums opacity-75">{sourceCounts.get(src) ?? 0}</span>
            </button>
          ))}
          {((sourceCounts.get(UNCLASSIFIED_KEY) ?? 0) > 0 || sourceFilter === UNCLASSIFIED_KEY) && (
            <button
              onClick={() => setSourceFilter(sourceFilter === UNCLASSIFIED_KEY ? null : UNCLASSIFIED_KEY)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-caption font-medium transition-all ${
                sourceFilter === UNCLASSIFIED_KEY ? "bg-ink-soft text-white shadow-md" : "bg-white border border-dashed border-line text-ink-faint active:bg-cream"
              }`}
            >
              {UNCLASSIFIED} <span className="tabular-nums opacity-75">{sourceCounts.get(UNCLASSIFIED_KEY) ?? 0}</span>
            </button>
          )}
          <button
            onClick={onManageSources}
            className="shrink-0 px-3.5 py-2 rounded-full text-caption font-medium bg-emerald-50 border border-emerald-200/80 text-emerald-700 active:bg-emerald-100 transition-colors"
          >
            관리
          </button>
          <button
            onClick={onEnterSelectMode}
            aria-label="선택 모드"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-line/80 text-ink-soft active:bg-cream transition-colors"
          >
            <CheckSquare size={14} />
          </button>
        </div>
      )}

      {!selectMode && showSearch && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2.5 surface-elevated">
          <Search size={14} className="text-ink-faint shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목·메모 검색"
            className="flex-1 text-body focus:outline-none bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="지우기" className="text-ink-faint active:text-ink-soft shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
