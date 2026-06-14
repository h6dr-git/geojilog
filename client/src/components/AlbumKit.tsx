// 꾸미기 키트 — 앨범 공유카드 테마·스티커 (SSOT: '제약된 큐레이트', 프리폼 에디터 금지)
import { useEffect, useState } from "react";
import { X, Maximize2 } from "lucide-react";
import CaptureView from "@/components/CaptureView";
import { SavingsEntry, fmt } from "@/lib/ledger";
import {
  CARD_THEMES as THEMES, CARD_STICKERS as STICKERS, type StickerId,
  loadKit, saveKit, themeById, CrownSticker, JarSticker, WonScatter, SealStamp,
} from "@/components/cardSkin";

export default function AlbumKit({
  year,
  month,
  photos,
  count,
  total,
  onClose,
}: {
  year: number;
  month: number;
  photos: SavingsEntry[];
  count: number;
  total: number;
  onClose: () => void;
}) {
  const init = loadKit();
  const [themeId, setThemeId] = useState(init.theme);
  const [stickers, setStickers] = useState<StickerId[]>(init.stickers);
  const [captureMode, setCaptureMode] = useState(false);

  const theme = themeById(themeId);
  const mm = String(month + 1).padStart(2, "0");
  const has = (id: StickerId) => stickers.includes(id);
  const toggle = (id: StickerId) =>
    setStickers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  useEffect(() => {
    saveKit({ theme: themeId, stickers });
  }, [themeId, stickers]);

  const card = (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: "340px", position: "relative", backgroundColor: theme.bg, padding: "18px", borderRadius: "16px", border: `1px solid ${theme.border}`, overflow: "hidden" }}
    >
      {has("won") && <WonScatter accent={theme.accent} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "14px", position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ fontSize: "9px", letterSpacing: "3px", color: theme.label, textTransform: "uppercase", marginBottom: "3px" }}>거지로그</div>
            {has("crown") && <div style={{ marginTop: "-4px" }}><CrownSticker color="#E0A92E" /></div>}
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: theme.title }}>{year}.{mm} 앨범</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9px", color: theme.label, marginBottom: "2px" }}>{count}건 기록</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: theme.accent, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>+₩{fmt(total)}</div>
        </div>
      </div>

      {photos.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", position: "relative" }}>
          {photos.map((e) => (
            <img
              key={e.id}
              src={e.imageUrl!}
              crossOrigin="anonymous"
              alt=""
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "8px", display: "block" }}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "12px", color: theme.sub, textAlign: "center", padding: "24px 0" }}>이 달엔 사진 기록이 없어요</div>
      )}

      <div style={{ position: "relative", marginTop: "14px", minHeight: "14px" }}>
        <div style={{ textAlign: "center", fontSize: "8px", color: theme.footer, letterSpacing: "2px" }}>GEOJILOG · {year}{mm}</div>
        {has("jar") && (
          <div style={{ position: "absolute", right: "0px", bottom: "-2px" }}>
            <JarSticker />
          </div>
        )}
        {has("seal") && (
          <div style={{ position: "absolute", left: "0px", bottom: "0px" }}>
            <SealStamp accent={theme.accent} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      style={{ animation: "akFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes akUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes akFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto overscroll-contain"
        style={{ animation: "akUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8" />
          <div className="text-center">
            <p className="text-body font-semibold text-ink">앨범 꾸미기</p>
            <p className="voice-label mt-0.5">서재 · 캡처용</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-card overflow-hidden shadow-sm">{card}</div>

        <p className="text-caption text-ink-soft mt-5 mb-2">테마</p>
        <div className="segment-track">
          {THEMES.map((t) => (
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
          {STICKERS.map((st) => (
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
          onClick={() => setCaptureMode(true)}
          disabled={photos.length === 0}
          className="mt-6 w-full btn-primary py-3.5 rounded-xl disabled:opacity-40"
        >
          <Maximize2 size={16} />
          크게 보기 · 캡처
        </button>
      </div>

      {captureMode && (
        <CaptureView bg={theme.bg} onClose={() => setCaptureMode(false)}>
          {card}
        </CaptureView>
      )}
    </div>
  );
}
