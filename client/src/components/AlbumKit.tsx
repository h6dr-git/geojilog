// 꾸미기 키트 — 앨범 공유카드 테마·스티커 (SSOT: '제약된 큐레이트', 프리폼 에디터 금지)
// 테마 3종 + 스티커 4종 토글 + 실시간 미리보기 → '크게 보기'(캡처 뷰). 선택은 localStorage에 기억.
// [v2] 캡처 모드 전환(SSOT §2): 파일 생성 없음 — 공유는 사용자가 스크린샷으로.
import { useEffect, useState } from "react";
import { X, Maximize2, Check } from "lucide-react";
import CaptureView from "@/components/CaptureView";
import { SavingsEntry, fmt } from "@/lib/ledger";

const KIT_KEY = "geojilog:album-kit";

type Theme = {
  id: string;
  name: string;
  bg: string;
  border: string;
  label: string;   // 작은 라벨 텍스트
  title: string;   // 제목
  accent: string;  // +수익
  sub: string;     // 보조 텍스트
  footer: string;  // 하단 워터마크
};

const THEMES: Theme[] = [
  { id: "forest", name: "서재", bg: "#16201A", border: "rgba(255,255,255,0)", label: "#7E8C82", title: "#F4EFE3", accent: "#10B981", sub: "#7E8C82", footer: "#5E6A60" },
  { id: "hanji", name: "한지", bg: "#FAF8F3", border: "#EFE9DC", label: "#B8B2A6", title: "#1A1A17", accent: "#059669", sub: "#8A857B", footer: "#B8B2A6" },
  { id: "gold", name: "명품관", bg: "#1A150A", border: "rgba(224,169,46,0.35)", label: "#8C7B5A", title: "#F2E3C2", accent: "#E0A92E", sub: "#8C7B5A", footer: "#6B5C3E" },
];

const STICKERS = [
  { id: "crown", name: "왕관" },
  { id: "won", name: "₩ 반짝" },
  { id: "jar", name: "자르르" },
  { id: "seal", name: "지켜냄 인장" },
] as const;
type StickerId = (typeof STICKERS)[number]["id"];

function loadKit(): { theme: string; stickers: StickerId[] } {
  try {
    const raw = localStorage.getItem(KIT_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (typeof v.theme === "string" && Array.isArray(v.stickers)) return v;
    }
  } catch { /* 무시 */ }
  return { theme: "forest", stickers: ["jar"] };
}

// 캡처 안전 스티커 — 외부 이미지·CSS 변수 없이 인라인 SVG/텍스트만
function CrownSticker({ color }: { color: string }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" style={{ display: "block" }}>
      <path d="M2,13 L1.2,4.5 L6.2,8 L11,2 L15.8,8 L20.8,4.5 L20,13 Z" fill={color} stroke="none" />
      <rect x="2" y="13.4" width="18" height="2" rx="1" fill={color} />
    </svg>
  );
}
function JarSticker() {
  return (
    <svg width="34" height="37" viewBox="0 0 100 108" style={{ display: "block" }}>
      <path d="M27,27 C9,36 9,72 22,88 C31,98 69,98 78,88 C91,72 91,36 73,27 Z" fill="#ece0c8" stroke="#a3744a" strokeWidth="3" />
      <rect x="14" y="60" width="72" height="34" rx="14" fill="#f2c94c" />
      <ellipse cx="50" cy="27" rx="23" ry="6.5" fill="#cda35f" stroke="#8f6336" strokeWidth="2.5" />
      <ellipse cx="50" cy="21" rx="19" ry="5.8" fill="#b9854f" stroke="#8f6336" strokeWidth="2.5" />
      <circle cx="50" cy="15" r="3.5" fill="#e8b84a" stroke="#8f6336" strokeWidth="2" />
      <circle cx="42" cy="64" r="4" fill="#2b2b2b" />
      <circle cx="58" cy="64" r="4" fill="#2b2b2b" />
      <path d="M42,70.5 Q50,78 58,70.5" fill="none" stroke="#8a5a3a" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="33" cy="73" rx="4.6" ry="2.9" fill="#f4a7a0" opacity="0.7" />
      <ellipse cx="67" cy="73" rx="4.6" ry="2.9" fill="#f4a7a0" opacity="0.7" />
    </svg>
  );
}

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

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const mm = String(month + 1).padStart(2, "0");
  const has = (id: StickerId) => stickers.includes(id);
  const toggle = (id: StickerId) =>
    setStickers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // 선택 기억
  useEffect(() => {
    try { localStorage.setItem(KIT_KEY, JSON.stringify({ theme: themeId, stickers })); } catch { /* 무시 */ }
  }, [themeId, stickers]);

  // ── 카드 본체 (시트 미리보기·캡처 뷰에서 동일하게 사용) ──
  const card = (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: "340px", position: "relative", backgroundColor: theme.bg, padding: "18px", borderRadius: "16px", border: `1px solid ${theme.border}`, overflow: "hidden" }}
    >
      {/* 스티커: ₩ 반짝 (배경 산란) */}
      {has("won") && (
        <div aria-hidden="true">
          {[
            { l: "8%", t: "30%", s: "22px", o: 0.12, r: "-14deg" },
            { l: "82%", t: "18%", s: "16px", o: 0.14, r: "10deg" },
            { l: "70%", t: "72%", s: "26px", o: 0.1, r: "-8deg" },
            { l: "14%", t: "78%", s: "15px", o: 0.13, r: "12deg" },
          ].map((p, i) => (
            <span key={i} style={{ position: "absolute", left: p.l, top: p.t, fontSize: p.s, opacity: p.o, color: theme.accent, fontFamily: "'JetBrains Mono', ui-monospace, monospace", transform: `rotate(${p.r})` }}>₩</span>
          ))}
        </div>
      )}

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
        {/* 스티커: 자르르 도장 */}
        {has("jar") && (
          <div style={{ position: "absolute", right: "0px", bottom: "-2px" }}>
            <JarSticker />
          </div>
        )}
        {/* 스티커: 지켜냄 인장 */}
        {has("seal") && (
          <div style={{ position: "absolute", left: "0px", bottom: "0px", border: `1.5px solid ${theme.accent}`, color: theme.accent, fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", transform: "rotate(-8deg)", letterSpacing: "1px", opacity: 0.9 }}>
            지켜냄
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
