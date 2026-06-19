import {
  Upload, Camera, Loader2, Copy, ChevronDown, ChevronUp, X, RotateCw, Images, PenLine,
} from "lucide-react";
import IncomeSourceChips from "@/components/IncomeSourceChips";
import ProfitKindChips from "@/components/ProfitKindChips";
import { UNCLASSIFIED, FIXED_ACTUAL } from "@shared/incomeSources";
import { LEDGER_LABELS } from "@shared/ledgerLabels";
import { inferProfitKind } from "@shared/profitKinds";
import { SavingsEntry, fmt, incomeSourceUsual } from "@/lib/ledger";
import type { QueueItem } from "./types";
import type { useLedgerCaptureQueue } from "./useLedgerCaptureQueue";
import type { trpc } from "@/lib/trpc";

type CaptureQueue = ReturnType<typeof useLedgerCaptureQueue>;
type CreateMut = ReturnType<typeof trpc.savings.create.useMutation>;

interface LedgerAddSheetProps {
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  queue: CaptureQueue;
  categoryNames: string[];
  entries: SavingsEntry[];
  createEntry: CreateMut;
}

export default function LedgerAddSheet({
  showAdd,
  setShowAdd,
  queue: q,
  categoryNames,
  entries,
  createEntry,
}: LedgerAddSheetProps) {
  const {
    cameraRef, galleryRef, handleFiles, openCamera,
    queue, showManual, setShowManual, setManualTitleEdited,
    manualSplit, setManualSplit, manualSource, setManualSource,
    manualProfitKind, setManualProfitKind, manualForm, setManualForm,
    incomeSourceList, retryQueueItem, forceQueueItem, handleQueueConfirm,
    removeQueueItem, updateQueueItem, handleManualSubmit, handleManualDateChange,
    handleManualCategoryChange,
  } = q;

  if (!showAdd) {
    return (
      <>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
      </>
    );
  }

  return (
    <>
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          style={{ animation: "adFade .2s ease" }}
          onClick={() => setShowAdd(false)}
        >
          <style>{`@keyframes adUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes adFade{from{opacity:0}to{opacity:1}}`}</style>
          <div
            className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain"
            style={{ animation: "adUp .28s cubic-bezier(.2,.8,.2,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-8" />
              <div className="text-center">
                <p className="text-body font-semibold text-ink">기록 추가</p>
                <p className="voice-label mt-0.5">증빙 → 원가 → 계상</p>
              </div>
              <button onClick={() => setShowAdd(false)} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
                <X size={20} />
              </button>
            </div>

            {/* 사진 업로드 영역 — 업로드가 시작되면 큰 드롭존은 내려가고 컴팩트 행으로 (#31) */}
            {queue.length === 0 ? (
              <section
                className="mb-5 surface-elevated border-2 border-dashed border-emerald-200/50 rounded-card p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              >
                <p className="text-body font-medium text-ink text-center mb-1">증빙 사진을 올리세요</p>
                <p className="text-caption text-ink-soft text-center mb-4">회시생이 시중가를 두드립니다 · 여러 장 가능</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-card btn-primary"
                  >
                    <Images size={22} />
                    <span className="text-body font-medium">보관함</span>
                  </button>
                  <button
                    type="button"
                    onClick={openCamera}
                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-card surface-paper border border-line active:brightness-[0.98]"
                  >
                    <Camera size={22} className="text-emerald-600" />
                    <span className="text-body font-medium text-ink">카메라</span>
                  </button>
                </div>
                <p className="text-micro text-ink-faint text-center mt-3">파일을 여기에 끌어다 놓을 수도 있어요</p>
              </section>
            ) : (
              <section className="mb-4 flex gap-2">
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-caption text-ink-soft border border-dashed border-line rounded-lg active:border-emerald-300 active:text-emerald-600 transition-colors"
                >
                  <Upload size={14} /> 사진 더 올리기
                </button>
                <button
                  onClick={openCamera}
                  aria-label="카메라로 촬영"
                  className="px-4 py-2.5 text-ink-soft border border-line rounded-lg active:border-emerald-300 active:text-emerald-600 transition-colors"
                >
                  <Camera size={14} />
                </button>
              </section>
            )}

            {/* 업로드 큐 */}
            {queue.length > 0 && (
              <section className="mb-5 space-y-3">
                <p className="text-caption font-mono text-ink-soft tracking-widest uppercase">분석 대기열 ({queue.length})</p>
                {queue.map(item => (
                  <div key={item.id} className="ledger-entry-row overflow-hidden animate-bubble-in">
                    {item.dup && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-micro text-amber-700">
                        <Copy size={12} /> 이미 추가한 사진과 같아 보여요
                      </div>
                    )}
                    {item.status === "analyzing" && (
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-14 h-14 rounded-lg bg-line animate-pulse flex-shrink-0 overflow-hidden">
                          <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-50" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-line rounded animate-pulse w-3/4" />
                          <div className="h-3 bg-line rounded animate-pulse w-1/2" />
                          <div className="flex items-center gap-1.5 text-caption text-ink-soft">
                            <Loader2 size={12} className="animate-spin text-emerald-500" />
                            회시생이 두드리는 중...
                          </div>
                        </div>
                        <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {item.status === "duplicate" && item.dupInfo && (
                      <div className="p-3">
                        <div className="flex items-center gap-3">
                          <img src={item.previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-caption font-medium text-amber-700 flex items-center gap-1">
                              <Copy size={12} /> 이미 기록한 사진이에요
                            </p>
                            <p className="text-caption text-ink-soft truncate mt-0.5">
                              {item.dupInfo.date.slice(5).replace("-", ".")} · {item.dupInfo.title} · <span className="font-mono text-emerald-600">+₩{fmt(item.dupInfo.profit)}</span>
                            </p>
                          </div>
                          <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft flex-shrink-0" aria-label="빼기">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex gap-2 mt-2.5">
                          <button
                            onClick={() => removeQueueItem(item.id)}
                            className="flex-1 py-2 text-caption text-ink-soft border border-line rounded-lg active:bg-cream transition-colors"
                          >
                            빼기
                          </button>
                          <button
                            onClick={() => forceQueueItem(item)}
                            className="flex-1 py-2 text-caption text-amber-700 border border-amber-200 bg-amber-50 rounded-lg active:bg-amber-100 transition-colors"
                          >
                            그래도 기록
                          </button>
                        </div>
                      </div>
                    )}
                    {item.status === "error" && (
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-14 h-14 rounded-lg bg-red-50 flex-shrink-0 overflow-hidden">
                          <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-caption text-red-500">분석에 실패했어요</p>
                          <p className="text-caption text-ink-soft truncate">다시 시도하거나 아래에서 직접 입력하세요</p>
                        </div>
                        <button
                          onClick={() => retryQueueItem(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-caption text-emerald-600 border border-emerald-200 rounded-lg active:bg-emerald-50 active:scale-95 transition-all flex-shrink-0"
                        >
                          <RotateCw size={12} /> 다시 시도
                        </button>
                        <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {item.status === "ready" && (
                      <div className="p-3 space-y-3">
                        <div className="flex items-start gap-3">
                          {item.imageUrl && (
                            <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <input
                              value={item.title}
                              onChange={e => updateQueueItem(item.id, { title: e.target.value })}
                              className="w-full text-body font-medium text-ink border-0 border-b border-line pb-0.5 focus:outline-none focus:border-emerald-400 bg-transparent"
                              placeholder="항목명"
                            />
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <input
                                type="date"
                                value={item.date}
                                onChange={e => updateQueueItem(item.id, { date: e.target.value })}
                                className="text-caption text-ink-soft border-0 border-b border-line focus:outline-none focus:border-emerald-300 bg-transparent w-28"
                              />
                              <select
                                value={item.category}
                                onChange={e => updateQueueItem(item.id, { category: e.target.value })}
                                className="text-caption text-ink-soft border-0 border-b border-line focus:outline-none focus:border-emerald-300 bg-transparent"
                              >
                                {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select
                                value={item.incomeSource ?? ""}
                                onChange={e => {
                                  const v = e.target.value || null;
                                  const patch: Partial<QueueItem> = { incomeSource: v };
                                  if (v != null && FIXED_ACTUAL[v] !== undefined) patch.actualAmount = String(FIXED_ACTUAL[v]);
                                  const o = Number(item.originalAmount) || 0;
                                  const a = v != null && FIXED_ACTUAL[v] !== undefined ? FIXED_ACTUAL[v] : Number(item.actualAmount) || 0;
                                  patch.profitKind = inferProfitKind(v, o, a);
                                  updateQueueItem(item.id, patch);
                                }}
                                className={`text-caption border-0 border-b border-line focus:outline-none focus:border-emerald-300 bg-transparent ${item.incomeSource ? "text-gold" : "text-ink-faint"}`}
                              >
                                <option value="">수익원 — {UNCLASSIFIED}</option>
                                {incomeSourceList.map((src) => <option key={src} value={src}>{src}</option>)}
                              </select>
                            </div>
                          </div>
                          <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft flex-shrink-0">
                            <X size={14} />
                          </button>
                        </div>

                        <div>
                          <p className="text-micro text-ink-soft mb-1 px-1">수익 유형</p>
                          <ProfitKindChips
                            value={item.profitKind}
                            onChange={(k) => {
                              const patch: Partial<QueueItem> = { profitKind: k };
                              if (k === "earn") patch.actualAmount = "0";
                              updateQueueItem(item.id, patch);
                            }}
                          />
                        </div>

                        <div className="flex items-baseline justify-between rounded-card bg-emerald-50 px-3 py-2.5">
                          <span className="text-micro font-medium text-emerald-700/70">이번에 번 돈</span>
                          <span className="font-mono text-xl font-extrabold tabular-nums text-emerald-600">
                            {item.originalAmount && item.actualAmount
                              ? `+₩${fmt(Math.max(0, Number(item.originalAmount) - Number(item.actualAmount)))}`
                              : "—"}
                          </span>
                        </div>

                        {/* #43 — 객관 지표 라벨 (AI가 추정해 채워둔 값, 사용자가 확정) */}
                        <div className="flex items-center gap-2 px-1 text-micro text-ink-soft">
                          <span className="flex items-center gap-1">원가
                            <input type="number" value={item.originalAmount}
                              onChange={e => updateQueueItem(item.id, { originalAmount: e.target.value })}
                              className="w-16 border-0 border-b border-line bg-transparent text-right tabular-nums text-ink-soft focus:border-emerald-400 focus:outline-none" />
                          </span>
                          <span className="text-ink-faint">→</span>
                          <span className="flex items-center gap-1">{LEDGER_LABELS.actual}
                            <input type="number" value={item.actualAmount}
                              onChange={e => updateQueueItem(item.id, { actualAmount: e.target.value })}
                              className="w-16 border-0 border-b border-line bg-transparent text-right tabular-nums text-ink-soft focus:border-emerald-400 focus:outline-none" />
                          </span>
                        </div>

                        {item.priorDate && (
                          <p className="text-micro text-emerald-600/80">원가는 지난번 확정가 기준 ({item.priorDate.slice(5).replace("-", ".")})</p>
                        )}
                        {/* #60-b — 내 평소가 (유형 선택 시) */}
                        {(() => {
                          const u = incomeSourceUsual(entries as SavingsEntry[], item.incomeSource);
                          return u ? (
                            <p className="text-micro text-ink-faint px-1">이 유형 평소 시장에 보낸 돈 ₩{fmt(u.usualActual)} (최근 {u.sample}건)</p>
                          ) : null;
                        })()}

                        {/* #43 — 인원: 객관 지표. AI가 채워두고, 바꾸면 내 몫이 즉시 재계산된다 (적용 버튼 없음) */}
                        <div className="flex items-center gap-2 px-1 text-micro text-ink-soft">
                          <span className="flex items-center gap-1">인원
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={item.nSplit ?? "1"}
                              onChange={e => {
                                const v = e.target.value;
                                const n = Number(v);
                                const baseO = item.groupOriginal ?? item.aiOriginalAmount ?? (Number(item.originalAmount) || 0);
                                const baseA = item.groupActual ?? item.aiActualAmount ?? (Number(item.actualAmount) || 0);
                                if (n >= 1 && Number.isFinite(n)) {
                                  updateQueueItem(item.id, {
                                    nSplit: v,
                                    originalAmount: String(Math.round(baseO / n)),
                                    actualAmount: String(Math.round(baseA / n)),
                                  });
                                } else {
                                  updateQueueItem(item.id, { nSplit: v });
                                }
                              }}
                              className="w-12 border-0 border-b border-line bg-transparent text-right tabular-nums text-ink-soft focus:border-emerald-400 focus:outline-none"
                            />
                          </span>
                          명
                        </div>
                        {item.groupOriginal != null && Number(item.nSplit) >= 2 && (
                          <p className="text-micro text-ink-faint px-1">
                            전체 약 ₩{fmt(item.groupOriginal)}(원가)·₩{fmt(item.groupActual ?? 0)}(실제)를 {item.nSplit}명 기준으로 나눈 내 몫이에요
                          </p>
                        )}

                        <input
                          value={item.memo}
                          onChange={e => updateQueueItem(item.id, { memo: e.target.value })}
                          placeholder="내 썰 한 줄 (선택)"
                          className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                        />

                        {item.aiReason && (
                          <div className="surface-paper px-3 py-2.5">
                            <p className="text-micro text-ink-soft leading-relaxed">
                              <span className="text-emerald-600 font-medium">회시생 추정</span> — {item.aiReason}
                            </p>
                            <label className="text-micro text-ink-soft block mt-2 mb-1">추정에 대한 코멘트 (선택)</label>
                            <textarea
                              value={item.userPriceNote}
                              onChange={e => updateQueueItem(item.id, { userPriceNote: e.target.value })}
                              maxLength={500}
                              rows={2}
                              placeholder="예: 학식은 4,500원이에요 — 다음부터 반영해 주세요"
                              className="input-field text-caption py-2 resize-none w-full"
                            />
                          </div>
                        )}

                        <button
                          onClick={() => handleQueueConfirm(item)}
                          disabled={item.submitting}
                          className="w-full py-2.5 btn-primary rounded-lg disabled:opacity-50"
                        >
                          {item.submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "등록"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* 직접 입력 */}
            <section>
              <button
                onClick={() => setShowManual(v => !v)}
                className="w-full flex items-center justify-between py-3 text-body text-ink-soft active:text-ink transition-colors"
              >
                <span className="flex items-center gap-1.5"><PenLine size={14} /> 직접 입력</span>
                {showManual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showManual && (
                <form onSubmit={handleManualSubmit} className="border border-line rounded-card p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-caption text-ink-soft mb-1 block">날짜</label>
                      <input type="date" value={manualForm.date}
                        onChange={e => handleManualDateChange(e.target.value)}
                        className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                    </div>
                    <div>
                      <label className="text-caption text-ink-soft mb-1 block">카테고리</label>
                      <select value={manualForm.category}
                        onChange={e => handleManualCategoryChange(e.target.value)}
                        className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white">
                        {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">수익 유형</label>
                    <ProfitKindChips
                      value={manualProfitKind}
                      onChange={(k) => {
                        setManualProfitKind(k);
                        if (k === "earn") setManualForm((f) => ({ ...f, actualAmount: "0" }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">수익원 (어떻게 번 돈인가요?)</label>
                    <IncomeSourceChips
                      value={manualSource}
                      onChange={(v) => {
                        setManualSource(v);
                        setManualProfitKind(inferProfitKind(v, Number(manualForm.originalAmount) || 0, Number(manualForm.actualAmount) || 0));
                        if (v != null && FIXED_ACTUAL[v] !== undefined)
                          setManualForm((f) => ({ ...f, actualAmount: String(FIXED_ACTUAL[v]) }));
                      }}
                      allowNone
                    />
                    {(() => {
                      const u = incomeSourceUsual(entries as SavingsEntry[], manualSource);
                      return u ? (
                        <p className="text-micro text-ink-faint mt-1.5">사장님의 {manualSource} 평소 시장에 보낸 돈 — ₩{fmt(u.usualActual)} (최근 {u.sample}건 중앙값)</p>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">항목명</label>
                    <input type="text" value={manualForm.title}
                      onChange={e => {
                        setManualTitleEdited(true);
                        setManualForm(f => ({ ...f, title: e.target.value }));
                      }}
                      className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div className={`grid gap-3 ${manualProfitKind === "earn" ? "grid-cols-1" : "grid-cols-2"}`}>
                    <div>
                      <label className="text-caption text-ink-soft mb-1 block">
                        {manualProfitKind === "earn" ? LEDGER_LABELS.earnAmount : LEDGER_LABELS.original}
                      </label>
                      <input type="number" placeholder="9000" value={manualForm.originalAmount}
                        onChange={e => setManualForm(f => ({ ...f, originalAmount: e.target.value }))}
                        className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                    </div>
                    {manualProfitKind !== "earn" && (
                      <div>
                        <label className="text-caption text-ink-soft mb-1 block">{LEDGER_LABELS.actual}</label>
                        <input type="number" placeholder="3000" value={manualForm.actualAmount}
                          onChange={e => setManualForm(f => ({ ...f, actualAmount: e.target.value }))}
                          className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                        <p className="text-micro text-ink-faint mt-0.5">{LEDGER_LABELS.actualHint}</p>
                      </div>
                    )}
                  </div>
                  {/* #33 엔빵 — 총액을 적은 뒤 인원으로 나누기 */}
                  <div className="flex items-center gap-2 text-caption text-ink-soft">
                    <span>엔빵</span>
                    <input
                      type="number" min={2} max={30} placeholder="인원"
                      value={manualSplit}
                      onChange={e => setManualSplit(e.target.value)}
                      className="w-14 border border-line rounded-lg px-2 py-1 text-right tabular-nums focus:outline-none focus:border-emerald-400"
                    />
                    명
                    {Number(manualSplit) >= 2 && manualForm.originalAmount && (
                      <button
                        type="button"
                        onClick={() => {
                          const n = Number(manualSplit);
                          setManualForm(f => ({
                            ...f,
                            originalAmount: String(Math.round((Number(f.originalAmount) || 0) / n)),
                            actualAmount: f.actualAmount ? String(Math.round((Number(f.actualAmount) || 0) / n)) : f.actualAmount,
                          }));
                          setManualSplit("");
                        }}
                        className="px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-600 active:bg-emerald-50 transition-colors"
                      >
                        ÷ 나누기
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">메모 (선택)</label>
                    <input type="text" placeholder="메모를 남겨보세요" value={manualForm.memo}
                      onChange={e => setManualForm(f => ({ ...f, memo: e.target.value }))}
                      className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                  {manualForm.originalAmount && manualForm.actualAmount && (
                    <p className="text-caption text-emerald-600 font-medium">
                      수익: +₩{fmt(Number(manualForm.originalAmount) - Number(manualForm.actualAmount))}
                    </p>
                  )}
                  <button type="submit" disabled={createEntry.isPending}
                    className="w-full py-2.5 btn-primary rounded-lg disabled:opacity-50">
                    {createEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "장부에 계상"}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
    </>
  );
}
