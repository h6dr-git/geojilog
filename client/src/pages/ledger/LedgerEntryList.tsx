import {
  Camera, ChevronRight, X, CheckCircle2, Circle,
} from "lucide-react";
import { LEDGER_LABELS } from "@shared/ledgerLabels";
import { ProfitKindBadge } from "@/components/ProfitKindChips";
import SsalCalc from "@/components/SsalCalc";
import { SavingsEntry, fmt, KO_DAYS } from "@/lib/ledger";

interface LedgerEntryListProps {
  showCal: boolean;
  weekFilter: { start: string; end: string } | null;
  ym: string;
  month: number;
  calWeeks: (number | null)[][];
  profitByDate: Record<string, number>;
  filterDate: string | null;
  setFilterDate: (v: string | null) => void;
  todayFull: string;
  setWeekFilter: (v: { start: string; end: string }) => void;
  isLoading: boolean;
  groups: [string, SavingsEntry[]][];
  totalEntries: number;
  selectMode: boolean;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (entry: SavingsEntry) => void;
  onOpenAdd: () => void;
}

export default function LedgerEntryList({
  showCal,
  weekFilter,
  ym,
  month,
  calWeeks,
  profitByDate,
  filterDate,
  setFilterDate,
  todayFull,
  setWeekFilter,
  isLoading,
  groups,
  totalEntries,
  selectMode,
  selected,
  onToggleSelect,
  onOpenDetail,
  onOpenAdd,
}: LedgerEntryListProps) {
  return (
    <section className="mb-6">
      {showCal && !weekFilter && (
        <div className="surface-elevated px-3 py-3.5 mb-4">
          <div className="grid grid-cols-8 mb-1.5">
            {KO_DAYS.map((d, i) => (
              <div key={d} className={`text-center text-micro font-medium py-0.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-ink-soft"}`}>{d}</div>
            ))}
            <div />
          </div>
          {calWeeks.map((week, wi) => {
            const firstD = week.find((d) => d !== null);
            const lastD = [...week].reverse().find((d) => d !== null);
            const weekStart = firstD ? `${ym}-${String(firstD).padStart(2, "0")}` : null;
            const weekEnd = lastD ? `${ym}-${String(lastD).padStart(2, "0")}` : null;
            return (
              <div key={wi} className="grid grid-cols-8">
                {week.map((day, di) => {
                  if (day === null) return <div key={`e${wi}-${di}`} />;
                  const ds = `${ym}-${String(day).padStart(2, "0")}`;
                  const profit = profitByDate[ds];
                  const isSelected = filterDate === ds;
                  const isToday = ds === todayFull;
                  return (
                    <button
                      key={ds}
                      onClick={() => setFilterDate(isSelected ? null : ds)}
                      className={`flex flex-col items-center py-1.5 min-h-[44px] rounded-xl transition-colors ${
                        isSelected ? "bg-emerald-500/10" : "active:bg-line/40"
                      }`}
                    >
                      <span className={`text-caption w-7 h-7 flex items-center justify-center rounded-full ${
                        isSelected ? "bg-emerald-500 text-white font-semibold shadow-sm"
                        : isToday ? "border-2 border-gold/70 text-ink font-semibold"
                        : "text-ink"
                      }`}>{day}</span>
                      {profit !== undefined && (
                        <span className="text-emerald-600 font-semibold leading-tight tabular-nums mt-0.5" style={{ fontSize: "8.5px" }}>
                          +{fmt(profit)}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => weekStart && weekEnd && setWeekFilter({ start: weekStart, end: weekEnd })}
                  aria-label="이 주만 보기"
                  className="flex items-center justify-center text-ink-faint active:text-emerald-500 transition-colors rounded-lg active:bg-emerald-50"
                  title="이 주만 보기"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            );
          })}
          <p className="text-center text-micro text-ink-faint mt-2">날짜를 누르면 그날만 · 오른쪽 화살표는 그 주만</p>
        </div>
      )}

      {filterDate && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-full bg-white/80 border border-line/80 text-caption w-fit">
          <button onClick={() => setFilterDate(null)} className="text-ink-soft underline-offset-2 active:text-ink transition-colors">
            {month + 1}월 전체
          </button>
          <ChevronRight size={11} className="text-ink-faint" />
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            {(() => { const d = new Date(filterDate + "T00:00:00"); return `${d.getDate()}일 (${KO_DAYS[d.getDay()]})`; })()}
            <button onClick={() => setFilterDate(null)} aria-label="필터 해제" className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 active:bg-emerald-200">
              <X size={9} />
            </button>
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 w-24 bg-line/80 rounded-full mb-2" />
              <div className="surface-elevated p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-line/70" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-line/70 rounded-lg w-3/4" />
                    <div className="h-3 bg-line/50 rounded-full w-1/3" />
                  </div>
                  <div className="h-5 w-16 bg-emerald-100/80 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="surface-elevated flex flex-col items-center text-center px-6 py-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-gold/10 flex items-center justify-center mb-4">
            <SsalCalc level={0.12} size={48} display="E" />
          </div>
          <p className="text-body font-semibold text-ink">
            {totalEntries === 0 ? "아직 장부가 비어 있어요" : "이 기간엔 기록이 없어요"}
          </p>
          {totalEntries === 0 && (
            <>
              <p className="text-caption text-ink-soft mt-1.5 max-w-[240px]">사진 한 장이면 회시생이 첫 수익을 두드려 드려요</p>
              <button
                onClick={onOpenAdd}
                className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full btn-primary"
              >
                <Camera size={14} /> 첫 기록 남기기
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => {
            const d = new Date(date + "T00:00:00");
            const dayTotal = items.reduce((s, e) => s + e.profit, 0);
            return (
              <div key={date}>
                <div className="ledger-date-header flex items-center justify-between mb-2 px-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-title font-semibold text-ink tabular-nums">{d.getDate()}</span>
                    <span className={`text-caption font-medium ${d.getDay() === 0 ? "text-red-400" : d.getDay() === 6 ? "text-blue-400" : "text-ink-soft"}`}>
                      {KO_DAYS[d.getDay()]}
                    </span>
                    {date === todayFull && (
                      <span className="text-micro px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">오늘</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-micro text-ink-faint">일일 계상</p>
                    <p className="text-caption font-mono font-semibold text-emerald-600 tabular-nums">+₩{fmt(dayTotal)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => (selectMode ? onToggleSelect(entry.id) : onOpenDetail(entry))}
                      className={`ledger-entry-row w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:scale-[0.995] transition-all ${
                        selectMode && selected.has(entry.id) ? "ring-2 ring-emerald-400/60" : ""
                      }`}
                    >
                      {selectMode && (
                        selected.has(entry.id)
                          ? <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
                          : <Circle size={20} className="text-ink-faint flex-shrink-0" />
                      )}
                      {entry.imageUrl
                        ? <img src={entry.imageUrl} alt="" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 ring-2 ring-white shadow-sm" />
                        : <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-line/90 to-line/50 flex-shrink-0 ring-2 ring-white shadow-sm" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-body font-semibold text-ink truncate leading-snug">{entry.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 min-w-0 flex-wrap">
                          {entry.incomeSource
                            ? <span className="ledger-chip ledger-chip-gold">{entry.incomeSource}</span>
                            : <span className="ledger-chip ledger-chip-muted">{entry.category}</span>}
                          <ProfitKindBadge kind={entry.profitKind} />
                          {entry.memo
                            ? <span className="text-caption text-ink-soft truncate italic max-w-[120px]">{entry.memo}</span>
                            : entry.incomeSource && <span className="ledger-chip ledger-chip-muted">{entry.category}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 pl-1">
                        <p className="ledger-entry-profit tabular-nums leading-tight">+₩{fmt(entry.profit)}</p>
                        <p className="text-micro text-ink-faint tabular-nums mt-0.5">
                          {entry.profitKind === "earn" ? (
                            <span>{LEDGER_LABELS.earnAmount}</span>
                          ) : (
                            <>
                              <span className="opacity-60">{LEDGER_LABELS.original}</span>{" "}
                              <span className="line-through opacity-70">₩{fmt(entry.originalAmount)}</span>
                              <span className="mx-0.5 opacity-50">→</span>
                              <span className="opacity-60">{LEDGER_LABELS.actual}</span>{" "}
                              <span>₩{fmt(entry.actualAmount)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      {!selectMode && <ChevronRight size={15} className="text-ink-faint/70 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
