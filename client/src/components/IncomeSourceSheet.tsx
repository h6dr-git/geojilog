// 수익원 시트 (#37+#38) — 유형별 통계(건수·누적 수익·평소가) + 미분류 정리 + 탭하면 장부 필터.
// '기록 관리 툴'의 본체: 내 절약이 어떤 루트에서 나오는지 한눈에.
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Loader2, Wand2 } from "lucide-react";
import { INCOME_SOURCES, UNCLASSIFIED } from "@shared/incomeSources";
import { SavingsEntry, fmt, incomeSourceUsual } from "@/lib/ledger";

export const UNCLASSIFIED_KEY = "__unclassified__";

export default function IncomeSourceSheet({
  entries,
  onClose,
  onPick,
}: {
  entries: SavingsEntry[];
  onClose: () => void;
  /** 유형 탭 → 장부를 그 유형으로 필터 (미분류는 UNCLASSIFIED_KEY) */
  onPick: (key: string) => void;
}) {
  const utils = trpc.useUtils();
  const reclassify = trpc.savings.reclassifySources.useMutation({
    onSuccess: (r) => {
      utils.savings.list.invalidate();
      if (r.classified > 0) toast.success(`${r.classified}건을 분류했어요${r.remaining > 0 ? ` — ${r.remaining}건은 직접 지정해 주세요` : ""}`);
      else toast.info("자동으로 알아볼 단서가 없었어요 — 기록을 열어 직접 지정해 주세요");
    },
    onError: () => toast.error("정리에 실패했어요"),
  });

  const stats = INCOME_SOURCES.map((src) => {
    const pool = entries.filter((e) => e.incomeSource === src);
    return {
      key: src as string,
      label: src as string,
      count: pool.length,
      profit: pool.reduce((s, e) => s + e.profit, 0),
      usual: incomeSourceUsual(entries, src)?.usualActual ?? null,
    };
  });
  const unclassified = entries.filter((e) => !e.incomeSource);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      style={{ animation: "isFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes isUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes isFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain"
        style={{ animation: "isUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">수익원</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>
        <p className="text-micro text-ink-faint text-center mb-4">
          어떻게 번 돈인지의 분류 · 평소가는 유형별 최근 실지출의 중앙값이에요
        </p>

        {/* 미분류 정리 — 있을 때만 */}
        {unclassified.length > 0 && (
          <div className="flex items-center gap-2.5 mb-3 px-3.5 py-3 rounded-card border border-gold/30 bg-gold/5">
            <button onClick={() => onPick(UNCLASSIFIED_KEY)} className="flex-1 min-w-0 text-left">
              <p className="text-body font-medium text-ink">{UNCLASSIFIED} {unclassified.length}건</p>
              <p className="text-micro text-ink-soft">탭하면 장부에서 모아 볼 수 있어요</p>
            </button>
            <button
              onClick={() => reclassify.mutate()}
              disabled={reclassify.isPending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gold text-white text-caption font-medium active:scale-95 disabled:opacity-50 transition-transform shrink-0"
            >
              {reclassify.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              자동 분류
            </button>
          </div>
        )}

        <div className="space-y-1">
          {stats.map((s) => (
            <button
              key={s.key}
              onClick={() => s.count > 0 && onPick(s.key)}
              disabled={s.count === 0}
              className={`w-full flex items-center gap-2 border border-line rounded-card px-3.5 py-3 text-left transition-colors ${
                s.count === 0 ? "opacity-40" : "active:bg-cream"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-ink truncate">{s.label}</p>
                <p className="text-micro text-ink-soft">
                  {s.count}건{s.usual != null ? ` · 평소 ₩${fmt(s.usual)}` : ""}
                </p>
              </div>
              <p className="text-caption font-mono font-semibold text-emerald-600 tabular-nums shrink-0">
                {s.count > 0 ? `+₩${fmt(s.profit)}` : "—"}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
