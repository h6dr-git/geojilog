// SavingsStoryCard — 저장/공유 카드 (다크그린 #16201A, 수익 실현 통지서 핀테크 패러디)
// [v2] 한글=Pretendard / 숫자·티커=JetBrains Mono. 김집사=과장된 금융 보고체("회장님 … 수익 실현").
//  - 공유물 = 객관적 사실(+수익·원가→실제·티커) + 김집사 voice. 사용자 날것 메모는 미포함.
//  - 사진 3겹(블러필·정사각 초점·스크림), 사진 없어도 타이포로 완성.
//  - html2canvas: oklch 회피 위해 카드 내부 색상 전부 inline hex. 캡처 전 폰트 로딩 보장.
// ============================================================

import { useRef, useState, useCallback, useEffect } from "react";
import { Share2, Download, X, Loader2 } from "lucide-react";

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

// 디자인 토큰 (캡처 안전 inline hex)
const C = {
  bg: "#16201A",
  cream: "#F4EFE3",
  muted: "#8A978C",
  faint: "#5E6A60",
  emerald: "#10B981",
  gold: "#E0A92E",
  panel: "#1E2A23",
};
// 한글=Pretendard, 숫자·티커·코드=모노
const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// [v2] 김집사 브리핑 — 과장된 금융 보고체. 호칭 '회장님', 사극 금지.
//  객관 사실(절약액)만 다루고 사용자 메모는 쓰지 않는다.
function butlerBrief(profit: number, id: number): { full?: string; suffix?: string } {
  const pick = (arr: string[]) => arr[Math.abs(id) % arr.length];
  if (profit <= 0) {
    return {
      full: pick([
        "회장님, 이번 건은 본전으로 마감했습니다. 다음 장을 노리시지요.",
        "회장님, 손실은 막으셨습니다. 다음 기회를 기다리시지요.",
      ]),
    };
  }
  const suffix =
    profit < 3000
      ? pick(["수익 실현하셨습니다. 티끌이 모여 자산이 됩니다.", "알뜰히 챙기셨습니다. 견실한 운용이십니다."])
      : profit < 10000
      ? pick(["수익 실현하셨습니다. 포트폴리오가 견조합니다.", "확보하셨습니다. 시장이 주목하고 있습니다."])
      : pick(["대형 수익 실현하셨습니다. 월가가 술렁입니다.", "수익을 실현하셨습니다. 거래소가 들썩입니다."]);
  return { suffix };
}

// [v2] 3겹 중 1겹 — 극단비율 블러필 배경. html2canvas가 CSS blur를 신뢰성 있게 못 그리므로
//  캔버스에 실제 블러 픽셀을 구워 dataURL로 깐다. (정사각 사진이면 가려지지만 비정사각 안전판)
async function makeBlurBg(url: string, w = 340, h = 200): Promise<string | null> {
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
        ctx.filter = "blur(26px)";
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.filter = "none";
        ctx.fillStyle = "rgba(12,18,14,0.45)";
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

// [v2] 캡처 전 폰트 로딩 보장 — 안 기다리면 첫 콜드 캡처가 폴백 폰트로 박힘(html2canvas 한계)
async function ensureFontsReady() {
  try {
    if (!document.fonts) return;
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load("700 36px 'JetBrains Mono'"),
      document.fonts.load("600 16px Pretendard"),
      document.fonts.load("400 13px Pretendard"),
    ]).catch(() => {});
  } catch {
    /* 폰트 API 미지원 시 무시 */
  }
}

export default function SavingsStoryCard({ entry, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null); // 캡처 결과 PNG
  const [blurBg, setBlurBg] = useState<string | null>(null);

  const hasPhoto = !!entry.imageUrl;
  const rate = entry.originalAmount > 0 ? Math.round((entry.profit / entry.originalAmount) * 100) : 0;
  const brief = butlerBrief(entry.profit, entry.id);

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
    // oklch 색상 변수를 html2canvas 호환되게 임시 무력화
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
        backgroundColor: C.bg,
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

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `거지로그_${entry.date}_${entry.title}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!imageUrl) return;
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `거지로그_${entry.date}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "거지로그 절약 인증" });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const tickerChip = entry.ticker ? (
    <span style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 500, letterSpacing: "1px", color: C.gold, backgroundColor: "rgba(224,169,46,0.14)", padding: "3px 8px", borderRadius: "6px" }}>
      {entry.ticker}
    </span>
  ) : <span />;

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
      <div ref={cardRef} style={{ width: "340px", backgroundColor: C.bg, borderRadius: "18px", overflow: "hidden", fontFamily: SANS }}>

        {/* 통지서 헤더 */}
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            {tickerChip}
            <span style={{ fontFamily: MONO, fontSize: "11px", color: C.muted }}>{entry.date.replace(/-/g, ".")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: C.cream, letterSpacing: "0.5px" }}>수익 실현 통지서</span>
            <span style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "1.5px", color: C.faint }}>PROFIT REALIZED</span>
          </div>
        </div>

        {/* 사진 (3겹) */}
        {hasPhoto && (
          <div style={{ position: "relative", width: "100%", height: "200px", backgroundColor: "#0E140F", overflow: "hidden" }}>
            {blurBg && <img src={blurBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            <img src={entry.imageUrl ?? ""} crossOrigin="anonymous" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,18,14,0.25) 0%, rgba(12,18,14,0) 35%, rgba(12,18,14,0) 62%, rgba(22,32,26,0.92) 100%)" }} />
          </div>
        )}

        {/* 본문 */}
        <div style={{ padding: hasPhoto ? "14px 20px 20px" : "6px 20px 20px" }}>
          <div style={{ fontSize: "11px", color: C.muted, marginBottom: "4px" }}>지켜낸 돈</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontFamily: MONO, fontSize: "36px", fontWeight: 700, color: C.emerald, lineHeight: 1 }}>
              +<span style={{ fontSize: "23px", margin: "0 1px 0 2px" }}>₩</span>{fmt(entry.profit)}
            </span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "rgba(16,185,129,0.85)" }}>지켜냄</span>
          </div>

          <div style={{ fontSize: "16px", fontWeight: 600, color: C.cream, marginTop: "12px" }}>{entry.title}</div>
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "5px" }}>
            {entry.category} · 원가 <span style={{ fontFamily: MONO }}>₩{fmt(entry.originalAmount)}</span> → 실제 <span style={{ fontFamily: MONO }}>₩{fmt(entry.actualAmount)}</span>{rate > 0 ? ` · ${rate}% 절감` : ""}
          </div>

          {/* 김집사 브리핑 */}
          <div style={{ marginTop: "16px", backgroundColor: C.panel, borderRadius: "12px", padding: "12px 14px" }}>
            <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.5px", color: C.gold, marginBottom: "5px" }}>김집사 브리핑</div>
            <div style={{ fontSize: "13px", color: "#DCE3DA", lineHeight: 1.55 }}>
              {brief.full ?? (
                <>회장님, <span style={{ fontFamily: MONO, color: C.cream }}>+₩{fmt(entry.profit)}</span> {brief.suffix}</>
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "0.5px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", color: C.faint }}>GEOJILOG</span>
            <span style={{ fontSize: "10px", color: C.faint }}>거지답게 아껴서 벌었다</span>
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div style={{ marginTop: "16px", display: "flex", gap: "10px", width: "340px" }}>
        {!imageUrl ? (
          <button
            onClick={handleCapture}
            disabled={capturing}
            style={{
              flex: 1, padding: "14px",
              backgroundColor: C.emerald, color: "#ffffff",
              border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: 600,
              cursor: capturing ? "not-allowed" : "pointer",
              opacity: capturing ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {capturing
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> 생성 중...</>
              : <><Share2 size={16} /> 이미지로 저장</>}
          </button>
        ) : (
          <>
            <button
              onClick={() => setImageUrl(null)}
              style={{
                padding: "14px 16px",
                backgroundColor: "transparent", color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
                fontSize: "13px", cursor: "pointer",
              }}
            >
              다시
            </button>
            <button
              onClick={handleDownload}
              style={{
                flex: 1, padding: "14px",
                backgroundColor: "#1A1A17", color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
                fontSize: "13px", fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              <Download size={15} /> 저장
            </button>
            <button
              onClick={handleShare}
              style={{
                flex: 2, padding: "14px",
                backgroundColor: C.emerald, color: "#ffffff",
                border: "none", borderRadius: "10px",
                fontSize: "14px", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              <Share2 size={16} /> 공유
            </button>
          </>
        )}
      </div>

      {/* 미리보기 */}
      {imageUrl && (
        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <img src={imageUrl} alt="preview" style={{ width: "160px", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }} />
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
