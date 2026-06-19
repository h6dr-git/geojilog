// 거지로그 — 장부: 기록 단일 뷰 + '기록 추가' 시트.
// 2026-06-10 재편: 사진 탭 폐지(장부 메타포에서 사진은 1급 객체가 아니라 기록의 증빙).
// 월간 결산·이달의 카드는 '서재' 탭으로 이사. 행 탭 → 상세 시트에서 보기·수정·삭제.
// ============================================================

import { useState, useMemo, lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Upload, Loader2, RotateCw, Plus, ChevronRight,
} from "lucide-react";
const EntryDetailSheet = lazy(() => import("@/components/EntryDetailSheet"));
const IncomeSourceSheet = lazy(() => import("@/components/IncomeSourceSheet"));
import { SavingsEntry } from "@/lib/ledger";
import { useLedgerFilters } from "./useLedgerFilters";
import { useLedgerCaptureQueue } from "./useLedgerCaptureQueue";
import { useLedgerBulk } from "./useLedgerBulk";
import LedgerStatsBar from "./LedgerStatsBar";
import LedgerToolbar from "./LedgerToolbar";
import LedgerEntryList from "./LedgerEntryList";
import LedgerBulkBar from "./LedgerBulkBar";
import LedgerAddSheet from "./LedgerAddSheet";
import SsalCalc from "@/components/SsalCalc";

export default function Ledger({ weekFocusNonce = 0, openAddNonce = 0 }: { weekFocusNonce?: number; openAddNonce?: number }) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: isAuthenticated });

  const createEntry = trpc.savings.create.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });
  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadCroppedImage = trpc.ai.uploadImage.useMutation();

  const categoryNames = useMemo(
    () => (categories.length > 0 ? categories.map((c: { name: string }) => c.name) : ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"]),
    [categories]
  );

  const list = entries as SavingsEntry[];

  const filters = useLedgerFilters(list, weekFocusNonce);
  const {
    month, ym, monthInputRef,
    filterDate, setFilterDate,
    prevMonth, nextMonth, handleMonthJump,
    showCal, toggleCal,
    weekFilter, setWeekFilter,
    dateScoped,
    showSearch, setShowSearch, search, setSearch,
    sourceFilter, setSourceFilter, sourceCounts,
    displayEntries, groups,
    periodTotal, periodLabel, periodCompare,
    profitByDate, calWeeks, todayFull,
    year,
  } = filters;

  const capture = useLedgerCaptureQueue(list, categoryNames, openAddNonce, createEntry, analyzeImage, uploadCroppedImage);
  const {
    showAdd, setShowAdd,
    startFx, startFxLeaving,
    queue, incomeSourceList,
    analyzingCount, readyCount,
  } = capture;

  const bulk = useLedgerBulk(displayEntries);
  const {
    selectMode, setSelectMode,
    selected, setSelected,
    bulkAction, setBulkAction,
    exitSelect, toggleSelect, allVisibleIds,
    runBulk, updateBulk, deleteBulk,
  } = bulk;

  const [showSources, setShowSources] = useState(false);
  const [detailEntry, setDetailEntry] = useState<SavingsEntry | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-cream gap-6 px-6">
        <div className="text-center">
          <h1 className="text-hero font-bold tracking-tight text-ink">거지로그</h1>
          <p className="mt-2 text-body text-ink-soft">번 돈을 적는 장부</p>
        </div>
        <p className="text-body text-ink-soft text-center leading-relaxed">
          연결이 잠시 불안정해 데이터를 불러오지 못했어요.<br />
          잠깐 후 다시 시도해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 btn-primary px-6 py-3 rounded-xl active:scale-[0.98] transition-transform"
        >
          <RotateCw size={16} />
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-lg mx-auto px-5 pb-24">
      <header className="pt-12 pb-4 flex items-center justify-between">
        <p className="page-title">장부</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={15} /> 기록 추가
        </button>
      </header>

      {queue.length > 0 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2.5 mb-4 px-4 py-3 surface-elevated text-left active:scale-[0.99] transition-transform"
          style={{ borderColor: "rgba(16,185,129,0.2)" }}
        >
          {analyzingCount > 0
            ? <Loader2 size={14} className="animate-spin text-emerald-500 shrink-0" />
            : <Upload size={14} className="text-emerald-500 shrink-0" />}
          <span className="flex-1 text-caption text-emerald-700">
            {analyzingCount > 0 ? `${analyzingCount}장 분석 중` : `${readyCount}장 확인 대기`}
          </span>
          <ChevronRight size={14} className="text-emerald-400 shrink-0" />
        </button>
      )}

      {!selectMode && (
        <LedgerStatsBar
          periodLabel={periodLabel}
          periodTotal={periodTotal}
          entryCount={displayEntries.length}
          periodCompare={periodCompare}
        />
      )}

      <LedgerToolbar
        weekFilter={weekFilter}
        setWeekFilter={setWeekFilter}
        year={year}
        month={month}
        ym={ym}
        monthInputRef={monthInputRef}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        handleMonthJump={handleMonthJump}
        showCal={showCal}
        toggleCal={toggleCal}
        selectMode={selectMode}
        selected={selected}
        allVisibleIds={allVisibleIds}
        setSelected={setSelected}
        exitSelect={exitSelect}
        dateScopedLength={dateScoped.length}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        search={search}
        setSearch={setSearch}
        incomeSourceList={incomeSourceList}
        sourceCounts={sourceCounts}
        onManageSources={() => setShowSources(true)}
        onEnterSelectMode={() => setSelectMode(true)}
      />

      <LedgerEntryList
        showCal={showCal}
        weekFilter={weekFilter}
        ym={ym}
        month={month}
        calWeeks={calWeeks}
        profitByDate={profitByDate}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        todayFull={todayFull}
        setWeekFilter={setWeekFilter}
        isLoading={isLoading}
        groups={groups}
        totalEntries={list.length}
        selectMode={selectMode}
        selected={selected}
        onToggleSelect={toggleSelect}
        onOpenDetail={setDetailEntry}
        onOpenAdd={() => setShowAdd(true)}
      />

      <LedgerBulkBar
        selectMode={selectMode}
        selected={selected}
        bulkAction={bulkAction}
        setBulkAction={setBulkAction}
        runBulk={runBulk}
        exitSelect={exitSelect}
        updateBulk={updateBulk}
        deleteBulk={deleteBulk}
        categoryNames={categoryNames}
      />

      <LedgerAddSheet
        showAdd={showAdd}
        setShowAdd={setShowAdd}
        queue={capture}
        categoryNames={categoryNames}
        entries={list}
        createEntry={createEntry}
      />

      {detailEntry && (
        <Suspense fallback={null}>
          <EntryDetailSheet
            entry={detailEntry}
            categoryNames={categoryNames}
            onClose={() => setDetailEntry(null)}
          />
        </Suspense>
      )}

      {startFx && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center pointer-events-none"
          style={{
            background: "rgba(22,32,26,0.85)",
            animation: startFxLeaving ? "sfxOut .5s ease forwards" : "adFade .25s ease",
          }}
        >
          <style>{`@keyframes sfxOut{from{opacity:1}to{opacity:0}}@keyframes adFade{from{opacity:0}to{opacity:1}}`}</style>
          <div style={{ animation: "prop-in .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <SsalCalc level={0.5} size={84} analyzing />
          </div>
          <p className="mt-4 text-body font-medium" style={{ color: "#d8cfae" }}>회시생이 계산을 시작했어요</p>
          <p className="mt-1 text-caption" style={{ color: "#7E8C82" }}>끝나면 알려드릴게요 — 다른 일 보셔도 됩니다</p>
        </div>
      )}

      {showSources && (
        <Suspense fallback={null}>
          <IncomeSourceSheet
            entries={list}
            onClose={() => setShowSources(false)}
            onPick={(key) => { setSourceFilter(key); setShowSources(false); }}
          />
        </Suspense>
      )}
    </div>
  );
}
