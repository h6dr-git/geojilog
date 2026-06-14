// #50 서가 카드 뷰어 — 소장된 결산 카드를 다시 본다.
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
  stickers: string;
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
      topProfitKind={report.topProfitKind}
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
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto overscroll-contain"
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
          <div className="text-center">
            <p className="text-body font-semibold text-ink">소장 카드</p>
            <p className="voice-label mt-0.5">서재 · 서가</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-card overflow-hidden shadow-sm">{cardEl}</div>

        {card.periodType === "week" && report.count > 0 && (
          <button
            onClick={() => onPlayBriefing({ start: report.start, end: report.end })}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 text-body font-medium rounded-xl active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #16201A 0%, #1a2820 100%)", color: "#E0A92E", border: "1px solid rgba(224,169,46,0.4)", boxShadow: "0 8px 24px rgba(22,32,26,0.2)" }}
          >
            <Play size={15} />
            브리핑 다시 보기
          </button>
        )}
        <button
          onClick={() => setCaptureMode(true)}
          className="mt-2 w-full flex items-center justify-center gap-2 py-3 surface-elevated text-ink-soft text-body font-medium active:scale-[0.99] transition-transform"
        >
          <Maximize2 size={15} />
          크게 보기 · 캡처
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
          onConfirm={async () => { await removeCard.mutateAsync({ id: card.id }); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
