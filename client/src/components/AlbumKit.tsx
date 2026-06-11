// 꾸미기 키트 — 앨범 공유카드 테마·스티커 (SSOT: '제약된 큐레이트', 프리폼 에디터 금지)
// 테마 3종 + 스티커 4종 토글 + 실시간 미리보기 → '크게 보기'(캡처 뷰). 선택은 localStorage에 기억.
// [v2] 캡처 모드 전환(SSOT §2): 파일 생성 없음 — 공유는 사용자가 스크린샷으로.
import { useEffect, useState } from "react";
import { X, Maximize2, Check } from "lucide-react";
import CaptureView from "@/components/CaptureView";
import { SavingsEntry, fmt } from "@/lib/ledger";
import {
  CARD_THEMES as THEMES, CARD_STICKERS as STICKERS, type StickerId,
  loadKit, saveKit, themeById, CrownSticker, JarSticker, WonScatter, SealStamp,
} from "@/components/cardSkin";

export default function AlbumKit({
  year,
  month, // 0-based
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

  // 선택 기억 — Wrapped와 공유되는 "내 스킨"
  useEffect(() => {
    saveKit({ theme: themeId, stickers });
  }, [themeId, stickers]);

  // ── 카드 본체 (시트 미리보기·캡처 뷰에서 동일하게 사용) ──
  const card = (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: "340px", position: "relative", backgroundColor: theme.bg, padding: "18px", borderRadius: "16px", border: `1px solid ${theme.border}`, overflow: "hidden" }}
    >
      {/* 스티커: ₩ 반짝 (배경 산란) */}
      {has("won") && <WonScatter accent={theme.accent} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "14px", position: "relative" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ fontSize: "9px", letterSpacing: "3px", color: theme.label, textTransform: "uppercase", marginBottom: "3px" }}>거지로그</div>
            {/* 스티커: 왕관 */}
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
        {/* 스티커: 쌀집군 도장 */}
        {has("jar") && (
          <div style={{ position: "absolute", right: "0px", bottom: "-2px" }}>
            <JarSticker />
          </div>
        )}
        {/* 스티커: 수익 인장 */}
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
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[92vh] overflow-y-auto overscroll-contain"
        style={{ animation: "akUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">앨범 꾸미기</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {/* ── 미리보기 (캡처 뷰에서도 동일 카드 사용) ── */}
        {card}

        {/* ── 테마 선택 ── */}
        <p className="text-caption text-ink-soft mt-5 mb-2">테마</p>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-caption font-medium transition-all ${
                themeId === t.id ? "border-emerald-400 text-ink" : "border-line text-ink-soft"
              }`}
            >
              <span className="w-4 h-4 rounded-full border border-line" style={{ background: t.bg }} />
              {t.name}
              {themeId === t.id && <Check size={12} className="text-emerald-500" />}
            </button>
          ))}
        </div>

        {/* ── 스티커 ── */}
        <p className="text-caption text-ink-soft mt-4 mb-2">스티커</p>
        <div className="flex gap-2 flex-wrap">
          {STICKERS.map((st) => (
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

        {/* ── 크게 보기 — 파일 저장 없음, 캡처는 본인 스크린샷으로 (SSOT §2) ── */}
        <button
          onClick={() => setCaptureMode(true)}
          disabled={photos.length === 0}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white text-body font-medium rounded-xl active:scale-[0.98] disabled:opacity-50 transition-transform"
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
