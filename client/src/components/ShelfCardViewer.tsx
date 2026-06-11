// #50 서가 카드 뷰어 — 소장된 결산 카드를 다시 본다. 내용은 장부에서 재계산(장부가 원본).
// 주간 카드는 그 주의 브리핑(Wrapped)도 여기서 재생 — 스토리는 이벤트지만, 소장본은 언제든.
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Maximize2, Trash2, Play } from "lucide-react";
import CaptureView from "@/components/CaptureView";
import ConfirmDialog from "@/components/ConfirmDialog";
import ReportShareCard from "@/components/ReportShareCard";
import { themeById, type StickerId } from "@/components/cardSkin";
import { computeReport } from "@/lib/report";
import { dosaLineOfDay } from "@/lib/voice";
import { SavingsEntry } from "@/lib/ledger";

export type ShelfCard = {
  id: number;
  periodType: "week" | "month";
  startDate: string;
  theme: string;
  stickers: string; // JSON
};

export default function ShelfCardViewer({
  card,
  entries,
  onClose,
  onPlayBriefing,
}: {
  card: ShelfCard;
  entries: SavingsEntry[];
  onClose: () => void;
  /** 주간 카드 → 그 주 브리핑(Wrapped) 재생 */
  onPlayBriefing: (range: { start: string; end: string }) => void;
}) {
  const utils = trpc.useUtils();
  const removeCard = trpc.reportCards.remove.useMutation({
    onSuccess: () => {
      utils.reportCards.list.invalidate();
      toast.success("서가에서 뺐습니다");
      onClose();
    },
    onError: () => toast.error("빼기에 실패했어요"),
  });
  const [captureMode, setCaptureMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const report = useMemo(
    () => computeReport(entries, card.periodType, card.startDate),
    [entries, card.periodType, card.startDate]
  );
  const theme = themeById(card.theme);
  const stickers = useMemo<StickerId[]>(() => {
    try { return JSON.parse(card.stickers); } catch { return []; }
  }, [card.stickers]);
  const quote = useMemo(dosaLineOfDay, []);

  const cardEl = (
    <ReportShareCard
      theme={theme}
      stickers={stickers}
      label={report.cardLabel}
      period={report.cardPeriod}
      amount={report.profit}
      subline={`${report.count}${card.periodType === "week" ? "끼" : "건"} 기록${report.best && report.best.profit > 0 ? ` · 최고의 한 수 ${report.best.title}` : ""}`}
      topSource={report.topSource}
      comment={report.comment}
      quote={quote}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      style={{ animation: "svFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes svUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes svFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto overscroll-contain"
        style={{ animation: "svUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="서가에서 빼기"
            className="w-8 h-8 flex items-center justify-center text-ink-faint active:text-red-400"
          >
            <Trash2 size={16} />
          </button>
          <span className="text-body font-medium text-ink">소장 카드</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {cardEl}

        {card.periodType === "week" && report.count > 0 && (
          <button
            onClick={() => onPlayBriefing({ start: report.start, end: report.end })}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 text-body font-medium rounded-xl active:scale-[0.98] transition-transform"
            style={{ background: "#16201A", color: "#E0A92E", border: "1px solid rgba(224,169,46,0.35)" }}
          >
            <Play size={15} />
            브리핑 다시 보기
          </button>
        )}
        <button
          onClick={() => setCaptureMode(true)}
          className="mt-2 w-full flex items-center justify-center gap-2 py-3 border border-line text-ink-soft text-body font-medium rounded-xl active:bg-cream transition-colors"
        >
          <Maximize2 size={15} />
          크게 보기
        </button>
      </div>

      {captureMode && (
        <CaptureView bg={theme.bg} onClose={() => setCaptureMode(false)}>
          <div className="w-full max-w-[320px]">{cardEl}</div>
        </CaptureView>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="서가에서 뺄까요?"
          description="소장 카드만 빠져요 — 기록은 장부에 그대로."
          confirmLabel="빼기"
          onConfirm={() => removeCard.mutate({ id: card.id })}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
