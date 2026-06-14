// 결산 카드 시트 (#45·#50) — 카드 미리보기 + 스킨 + "서가에 소장"(주 행동) + 크게 보기(캡처는 부산물).
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Maximize2, BookMarked, Loader2 } from "lucide-react";
import CaptureView from "@/components/CaptureView";
import ReportShareCard from "@/components/ReportShareCard";
import {
  CARD_THEMES, CARD_STICKERS, type StickerId,
  loadKit, saveKit, themeById,
} from "@/components/cardSkin";

export default function ShareCardSheet({
  label,
  period,
  amount,
  subline,
  topSource,
  topProfitKind,
  comment,
  quote,
  periodType,
  startDate,
  onClose,
}: {
  label: string;
  period: string;
  amount: number;
  subline?: string;
  topSource?: { name: string; profit: number } | null;
  topProfitKind?: { label: string; profit: number } | null;
  comment: string;
  quote?: string;
  periodType: "week" | "month";
  startDate: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const saveCard = trpc.reportCards.save.useMutation({
    onSuccess: (r) => {
      utils.reportCards.list.invalidate();
      toast.success(r.updated ? "서가의 소장본을 새 스킨으로 갈았습니다" : "서가에 꽂아두었습니다");
      onClose();
    },
    onError: () => toast.error("소장에 실패했어요"),
  });
  const [themeId, setThemeId] = useState(() => loadKit().theme);
  const [stickers, setStickers] = useState<StickerId[]>(() => loadKit().stickers);
  const [captureMode, setCaptureMode] = useState(false);
  const theme = themeById(themeId);
  const has = (id: StickerId) => stickers.includes(id);
  const toggle = (id: StickerId) =>
    setStickers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  useEffect(() => {
    saveKit({ theme: themeId, stickers });
  }, [themeId, stickers]);

  const card = (
    <ReportShareCard
      theme={theme} stickers={stickers}
      label={label} period={period} amount={amount}
      subline={subline} topSource={topSource} topProfitKind={topProfitKind} comment={comment} quote={quote}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      style={{ animation: "scsFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes scsUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes scsFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto overscroll-contain"
        style={{ animation: "scsUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8" />
          <div className="text-center">
            <p className="text-body font-semibold text-ink">결산 카드</p>
            <p className="voice-label mt-0.5">서재 · 소장용</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-card overflow-hidden shadow-sm">{card}</div>

        <p className="text-caption text-ink-soft mt-5 mb-2">테마</p>
        <div className="segment-track">
          {CARD_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-caption font-medium transition-all min-w-0 ${
                themeId === t.id ? "segment-active" : "text-ink-soft active:bg-line/60"
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0 border border-line/80" style={{ background: t.bg }} />
              {t.name}
            </button>
          ))}
        </div>

        <p className="text-caption text-ink-soft mt-4 mb-2">스티커</p>
        <div className="flex gap-1.5 flex-wrap">
          {CARD_STICKERS.map((st) => (
            <button
              key={st.id}
              onClick={() => toggle(st.id)}
              className={`px-3.5 py-2 rounded-full text-caption font-medium transition-all ${
                has(st.id) ? "bg-gold text-white shadow-sm" : "surface-elevated text-ink-soft active:scale-[0.98]"
              }`}
            >
              {st.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => saveCard.mutate({ periodType, startDate, theme: themeId, stickers })}
          disabled={saveCard.isPending}
          className="mt-6 w-full btn-primary py-3.5 rounded-xl disabled:opacity-50"
        >
          {saveCard.isPending ? <Loader2 size={16} className="animate-spin" /> : <BookMarked size={16} />}
          서가에 소장
        </button>
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
          <div className="w-full max-w-[320px]">{card}</div>
        </CaptureView>
      )}
    </div>
  );
}
