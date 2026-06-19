import { useState, useMemo, useEffect, useRef } from "react";
import { SavingsEntry, KO_DAYS, todayStr } from "@/lib/ledger";
import {
  filterByWeekOrDate,
  filterBySearch,
  buildSourceCounts,
  filterBySource,
  groupEntriesByDate,
  buildPeriodLabel,
  buildCalWeeks,
  profitByDateFromEntries,
} from "@/lib/ledgerFilterLogic";

export function useLedgerFilters(entries: SavingsEntry[], weekFocusNonce: number) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);

  const prevMonth = () => { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setFilterDate(null); };
  const nextMonth = () => { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setFilterDate(null); };
  const handleMonthJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m] = e.target.value.split("-").map(Number);
    if (y && m) { setViewDate(new Date(y, m - 1, 1)); setFilterDate(null); }
  };

  const [showCal, setShowCal] = useState<boolean>(() => {
    try { return localStorage.getItem("geojilog:ledger-cal") === "1"; } catch { return false; }
  });
  const toggleCal = () => setShowCal((v) => {
    const next = !v;
    try { localStorage.setItem("geojilog:ledger-cal", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });

  const [weekFilter, setWeekFilter] = useState<{ start: string; end: string } | null>(null);
  useEffect(() => {
    if (weekFocusNonce <= 0) return;
    const e = new Date(); e.setHours(0, 0, 0, 0);
    const s = new Date(e); s.setDate(s.getDate() - 6);
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setWeekFilter({ start: f(s), end: f(e) });
  }, [weekFocusNonce]);

  const monthEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(ym)),
    [entries, ym],
  );

  const dateScoped = useMemo(
    () => filterByWeekOrDate(entries, monthEntries, weekFilter, filterDate),
    [entries, monthEntries, weekFilter, filterDate],
  );

  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const searched = useMemo(() => filterBySearch(dateScoped, search), [dateScoped, search]);

  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const sourceCounts = useMemo(() => buildSourceCounts(searched), [searched]);

  const displayEntries = useMemo(
    () => filterBySource(searched, sourceFilter),
    [searched, sourceFilter],
  );

  const groups = useMemo(() => groupEntriesByDate(displayEntries), [displayEntries]);

  const periodTotal = useMemo(() => displayEntries.reduce((s, e) => s + e.profit, 0), [displayEntries]);

  const periodLabel = useMemo(
    () => buildPeriodLabel(weekFilter, filterDate, search, sourceFilter, month, KO_DAYS),
    [weekFilter, filterDate, search, sourceFilter, month],
  );

  const periodCompare = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (!isCurrentMonth || weekFilter || filterDate || sourceFilter || search.trim()) return null;
    const dayOfMonth = now.getDate();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const prevList = entries.filter(
      (e) => e.date.startsWith(prevYm) && Number(e.date.slice(8, 10)) <= dayOfMonth,
    );
    if (prevList.length === 0) return null;
    return periodTotal - prevList.reduce((s, e) => s + e.profit, 0);
  }, [year, month, weekFilter, filterDate, sourceFilter, search, entries, periodTotal]);

  const profitByDate = useMemo(() => profitByDateFromEntries(monthEntries), [monthEntries]);
  const calWeeks = useMemo(() => buildCalWeeks(year, month), [year, month]);
  const todayFull = todayStr();

  return {
    year, month, ym, monthInputRef,
    filterDate, setFilterDate,
    prevMonth, nextMonth, handleMonthJump,
    showCal, toggleCal,
    weekFilter, setWeekFilter,
    monthEntries, dateScoped,
    showSearch, setShowSearch, search, setSearch,
    sourceFilter, setSourceFilter, sourceCounts,
    displayEntries, groups,
    periodTotal, periodLabel, periodCompare,
    profitByDate, calWeeks, todayFull,
  };
}
