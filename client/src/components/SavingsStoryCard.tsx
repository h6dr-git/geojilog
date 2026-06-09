// SavingsStoryCard — 저장 카드 (다크그린 #16201A, 다꾸 감성 / 자르르 리액션)
// [v3] 한글=Pretendard / 숫자·티커=JetBrains Mono. 캐릭터=자르르(신나는 조수) 말풍선.
//  - 공유물 = 객관적 사실(+수익·티커·날짜) + 자르르 리액션. 사용자 날것 메모는 미포함.
//  - 사진 3겹(블러필·정사각 초점·스크림), 사진 없어도 타이포로 완성.
//  - "이미지로 저장"만(Wrapped 모델). 큰 '공유/자랑' 버튼 없음.
//  - 색은 THEME 토큰으로 분리 — 향후 테마/스킨 상품화 시 이 객체만 갈아끼우면 됨.
//  - html2canvas: oklch 회피 위해 내부 색상 전부 inline hex. 캡처 전 폰트 로딩 보장.
// ============================================================

import { useRef, useState, useCallback, useEffect } from "react";
import { Download, X, Loader2 } from "lucide-react";

interface SavingsEntry {
  id: number;
  date: string;
  title: string;
  category: string;
  ticker?: string | null;
  originalAmount: number;
  actualAmount: number;
  profit: number;
  aiReason?: string | null;
  imageUrl?: string | null;
  memo?: string | null;
}

interface Props {
  entry: SavingsEntry;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

// [v3] 테마 토큰 — 나중에 스킨/테마 상품 추가 시 이 객체를 늘리면 됨(지금은 기본 1종)
const THEME = {
  card: "#16201A",      // 카드 배경(저장카드 다크그린)
  tileEmpty: "#1E2A23", // 사진 없을 때 패널
  tilePhoto: "#0E140F", // 사진 타일 바닥
  cream: "#F4EFE3",
  caption: "#C9D2C6",
  muted: "#7E8C82",
  faint: "#5E6A60",
  emerald: "#10B981",   // 수익
  gold: "#E0A92E",      // 티커·프리미엄
  bubbleBg: "#FFFDF7",  // 자르르 말풍선
  bubbleText: "#1A1A17",
};
const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// [v3] 자르르 리액션 — 신나는 조수 말투(반말+의성어+ㄹ굴림). 객관 사실(절약)만 반응, 메모는 안 씀.
function jarrReaction(profit: number, id: number): string {
  const pick = (arr: string[]) => arr[Math.abs(id) % arr.length];
  if (profit <= 0) return pick(["본전이라도 지켰띵 ㅎ", "다음엔 더 지키자띵!"]);
  if (profit < 3000) return pick(["오늘도 자르르~ ㅋ", "야금야금 지켰띵 ㅋ"]);
  if (profit < 10000) return pick(["또 지켰띵!! ㅋㅋ", "꽉 챙겼다 자르르~"]);
  return pick(["와 대박이띵 ㅋㅋㅋ", "이건 못 참지띵!!"]);
}

// [v3] 3겹 중 1겹 — 극단비율 블러필 배경(캔버스에 실제 블러 픽셀을 구워 캡처 안전)
async function makeBlurBg(url: string, w = 296, h = 200): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        const scale = Math.max(w / img.width, h / img.height) * 1.25;
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.filter = "blur(24px)";
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.filter = "none";
        ctx.fillStyle = "rgba(12,18,14,0.4)";
        ctx.fillRect(0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// [v3] 캡처 전 폰트 로딩 보장 — 안 기다리면 첫 콜드 캡처가 폴백 폰트로 박힘(html2canvas 한계)
async function ensureFontsReady() {
  try {
    if (!document.fonts) return;
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load("700 34px 'JetBrains Mono'"),
      document.fonts.load("600 16px Pretendard"),
      document.fonts.load("500 12px Pretendard"),
    ]).catch(() => {});
  } catch {
    /* 폰트 API 미지원 시 무시 */
  }
}

export default function SavingsStoryCard({ entry, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blurBg, setBlurBg] = useState<string | null>(null);

  const hasPhoto = !!entry.imageUrl;
  const reaction = jarrReaction(entry.profit, entry.id);

  useEffect(() => {
    let alive = true;
    if (entry.imageUrl) {
      makeBlurBg(entry.imageUrl).then((bg) => { if (alive) setBlurBg(bg); });
    } else {
      setBlurBg(null);
    }
    return () => { alive = false; };
  }, [entry.imageUrl]);

  const handleCapture = useCallback(async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    await ensureFontsReady();
    const root = document.documentElement;
    const oklchVars = [
      "--background", "--foreground", "--card", "--card-foreground",
      "--popover", "--popover-foreground", "--primary", "--primary-foreground",
      "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
      "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
      "--border", "--input", "--ring",
    ];
    const saved: Record<string, string> = {};
    oklchVars.forEach((v) => {
      saved[v] = root.style.getPropertyValue(v);
      root.style.setProperty(v, "transparent");
    });
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current!, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: THEME.card,
        logging: false,
        ignoreElements: (el) => el.tagName === "STYLE" && el.textContent?.includes("oklch") === true,
      });
      setImageUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("캡처 실패", e);
    } finally {
      oklchVars.forEach((v) => {
        if (saved[v]) root.style.setProperty(v, saved[v]);
        else root.style.removeProperty(v);
      });
      setCapturing(false);
    }
  }, []);

  // [v3] 조용한 저장 — 모바일은 공유시트로 '사진 저장', 데스크탑은 다운로드. 큰 '공유/자랑' 버튼 없음.
  const handleSave = async () => {
    if (!imageUrl) return;
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `거지로그_${entry.date}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      /* 폴백: 다운로드 */
    }
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `거지로그_${entry.date}_${entry.title}.png`;
    a.click();
  };

  const Bubble = ({ floating }: { floating: boolean }) => (
    <div
      style={{
        ...(floating
          ? { position: "absolute" as const, left: "12px", bottom: "12px" }
          : { marginTop: "10px" }),
        backgroundColor: THEME.bubbleBg,
        color: THEME.bubbleText,
        fontSize: "12px",
        fontWeight: 500,
        padding: "6px 11px",
        borderRadius: "12px 12px 12px 3px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
        whiteSpace: "nowrap",
      }}
    >
      {reaction}
    </div>
  );

  const tickerRow = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
      {entry.ticker
        ? <span style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 500, letterSpacing: "1px", color: THEME.gold, backgroundColor: "rgba(224,169,46,0.16)", padding: "3px 8px", borderRadius: "6px" }}>{entry.ticker}</span>
        : <span />}
      <span style={{ fontFamily: MONO, fontSize: "11px", color: THEME.muted }}>{entry.date.replace(/-/g, ".")}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.95)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "16px", overflowY: "auto",
      }}
    >
      {/* 닫기 */}
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: "16px", right: "16px",
          background: "rgba(255,255,255,0.1)", border: "none",
          borderRadius: "50%", width: "36px", height: "36px",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#ffffff", zIndex: 10000,
        }}
      >
        <X size={18} />
      </button>

      {/* ── 카드 (캡처 대상) ── */}
      <div ref={cardRef} style={{ width: "320px", backgroundColor: THEME.card, borderRadius: "20px", padding: "12px", fontFamily: SANS }}>

        {hasPhoto ? (
          // 사진 타일 (3겹) + 자르르 말풍선
          <div style={{ position: "relative", height: "200px", borderRadius: "14px", overflow: "hidden", backgroundColor: THEME.tilePhoto }}>
            {blurBg && <img src={blurBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            <img src={entry.imageUrl ?? ""} crossOrigin="anonymous" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,18,14,0.15) 0%, rgba(12,18,14,0) 40%, rgba(12,18,14,0.55) 100%)" }} />
            <Bubble floating />
          </div>
        ) : (
          // 사진 없음 — 타이포로 완성(큰 +₩ + 자르르 말풍선)
          <div style={{ height: "150px", borderRadius: "14px", backgroundColor: THEME.tileEmpty, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "40px", fontWeight: 700, color: THEME.emerald, lineHeight: 1 }}>
              +<span style={{ fontSize: "25px", margin: "0 1px 0 2px" }}>₩</span>{fmt(entry.profit)}
            </span>
            <Bubble floating={false} />
          </div>
        )}

        {/* 정보 영역 */}
        <div style={{ padding: "13px 6px 4px" }}>
          {tickerRow}

          {hasPhoto && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "7px" }}>
              <span style={{ fontFamily: MONO, fontSize: "34px", fontWeight: 700, color: THEME.emerald, lineHeight: 1 }}>
                +<span style={{ fontSize: "22px", margin: "0 1px 0 2px" }}>₩</span>{fmt(entry.profit)}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(16,185,129,0.8)" }}>지켜냄</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: hasPhoto ? "9px" : "0" }}>
            <span style={{ fontSize: "13px", color: THEME.caption, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "210px" }}>{entry.title}</span>
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "1.5px", color: THEME.faint }}>GEOJILOG</span>
          </div>
        </div>
      </div>

      {/* 하단 버튼 — '공유/자랑' 버튼 없음, 조용한 저장만 */}
      <div style={{ marginTop: "16px", display: "flex", gap: "10px", width: "320px" }}>
        {!imageUrl ? (
          <button
            onClick={handleCapture}
            disabled={capturing}
            style={{
              flex: 1, padding: "14px",
              backgroundColor: THEME.emerald, color: "#ffffff",
              border: "none", borderRadius: "12px",
              fontSize: "14px", fontWeight: 600,
              cursor: capturing ? "not-allowed" : "pointer",
              opacity: capturing ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {capturing
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> 만드는 중...</>
              : <><Download size={16} /> 이미지로 저장</>}
          </button>
        ) : (
          <>
            <button
              onClick={() => setImageUrl(null)}
              style={{
                padding: "14px 16px",
                backgroundColor: "transparent", color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px",
                fontSize: "13px", cursor: "pointer",
              }}
            >
              다시
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: "14px",
                backgroundColor: THEME.emerald, color: "#ffffff",
                border: "none", borderRadius: "12px",
                fontSize: "14px", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              <Download size={16} /> 이미지로 저장
            </button>
          </>
        )}
      </div>

      {/* 미리보기 */}
      {imageUrl && (
        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <img src={imageUrl} alt="preview" style={{ width: "150px", borderRadius: "10px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }} />
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
