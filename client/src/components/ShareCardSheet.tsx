// 결산 카드 시트 (#45) — 서재에서 스토리를 거치지 않고 바로: 카드 미리보기 + 스킨 + 캡처.
// "공유 동선은 짧게, 연출(Wrapped)은 이벤트로" — Spotify 문법 적용의 직행 절반.
import { useEffect, useState } from "react";
import { X, Maximize2 } from "lucide-react";
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
  comment,
  quote,
  onClose,
}: {
  label: string;
  period: string;
  amount: number;
  subline?: string;
  topSource?: { name: string; profit: number } | null;
  comment: string;
  quote?: string;
  onClose: () => void;
}) {
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
      subline={subline} topSource={topSource} comment={comment} quote={quote}
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
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto overscroll-contain"
        style={{ animation: "scsUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">결산 카드</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {card}

        {/* 테마 */}
        <p className="text-caption text-ink-soft mt-5 mb-2">테마</p>
        <div className="flex gap-2">
          {CARD_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-caption font-medium transition-all ${
                themeId === t.id ? "border-emerald-400 text-ink" : "border-line text-ink-soft"
              }`}
            >
              <span className="w-4 h-4 rounded-full border border-line" style={{ background: t.bg }} />
              {t.name}
            </button>
          ))}
        </div>

        {/* 스티커 */}
        <p className="text-caption text-ink-soft mt-4 mb-2">스티커</p>
        <div className="flex gap-2 flex-wrap">
          {CARD_STICKERS.map((st) => (
            <button
              key={st.id}
              onClick={() => toggle(st.id)}
              className={`px-3.5 py-2 rounded-full text-caption font-medium border transition-all ${
                has(st.id) ? "bg-emerald-500 text-white border-emerald-500" : "border-line text-ink-soft active:bg-cream"
              }`}
            >
              {st.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCaptureMode(true)}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white text-body font-medium rounded-xl active:scale-[0.98] transition-transform"
        >
          <Maximize2 size={16} />
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
