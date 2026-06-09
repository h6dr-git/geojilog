// SavingsStoryCard — 저장/공유 카드 (다크그린 #16201A)
// [작업4] 공유물 = 객관적 사실 + 캐릭터 voice. 구성: +수익 + 티커 + 사진(3겹) + 김집사 평.
//  - 사용자 날것 메모(entry.memo)는 기본 미포함 (공유는 사실 + 캐릭터 코멘트만).
//  - html2canvas는 oklch를 못 다루므로 카드 내부 색상은 전부 inline hex/rgba.
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
  bg: "#16201A",        // 저장카드 다크그린
  cream: "#F4EFE3",
  muted: "#8A978C",
  faint: "#5E6A60",
  emerald: "#10B981",   // 수익
  gold: "#E0A92E",      // 티커
  panel: "#1E2A23",
};

// [작업4] 김집사 평 — 절약액(객관 사실)에 캐릭터 voice를 입힌 한 줄. 사용자 메모는 쓰지 않는다.
function butlerComment(profit: number, id: number): string {
  const pools =
    profit <= 0
      ? [
          "이번엔 본전이옵니다, 주인님. 다음 기회를 노리시지요.",
          "남기진 못했사오나, 기록이야말로 곳간의 첫 삽이옵니다.",
        ]
      : profit < 3000
      ? [
          "티끌 모아 태산이라 하였습니다. 오늘의 한 푼, 소인이 장부에 곱게 적었사옵니다.",
          "작은 절약도 절약이옵니다. 주인님 살림이 차곡차곡 여뭅니다.",
        ]
      : profit < 10000
      ? [
          "과연 주인님이십니다. 이 돈, 곳간에 잘 모셔두겠사옵니다.",
          "오늘의 결단이 곳간을 살찌웁니다. 훌륭하시옵니다.",
        ]
      : [
          "허허, 이만하면 곳간이 절로 차오릅니다. 경의를 표하옵니다, 주인님.",
          "이만한 절약이라니. 소인, 주인님 모시는 일이 자랑스럽사옵니다.",
        ];
  return pools[Math.abs(id) % pools.length];
}

// [작업4] 3겹 중 1겹 — 극단비율 블러필 배경.
//  html2canvas가 CSS filter:blur를 신뢰성 있게 못 그리므로, 캔버스에 '실제 블러 픽셀'을
//  구워 dataURL로 만들어 <img>로 깐다. 정사각 사진이면 가려지지만 비정사각 안전판.
async function makeBlurBg(url: string, w = 340, h = 300): Promise<string | null> {
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
        const scale = Math.max(w / img.width, h / img.height) * 1.25; // cover + 오버스캔
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.filter = "blur(26px)";
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.filter = "none";
        ctx.fillStyle = "rgba(12,18,14,0.45)"; // 어둡게 깔아 텍스트 가독 확보
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

export default function SavingsStoryCard({ entry, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null); // 캡처 결과 PNG
  const [blurBg, setBlurBg] = useState<string | null>(null);

  const hasPhoto = !!entry.imageUrl;
  const rate = entry.originalAmount > 0 ? Math.round((entry.profit / entry.originalAmount) * 100) : 0;
  const comment = butlerComment(entry.profit, entry.id);

  // 사진 있으면 블러 배경 미리 굽기 (캡처 시 바로 사용)
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
    <span
      style={{
        fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px",
        color: C.gold, backgroundColor: "rgba(224,169,46,0.16)",
        padding: "3px 8px", borderRadius: "6px",
      }}
    >
      {entry.ticker}
    </span>
  ) : null;

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
      <div
        ref={cardRef}
        style={{
          width: "340px", backgroundColor: C.bg, borderRadius: "18px",
          overflow: "hidden", position: "relative",
          fontFamily: "ui-monospace, 'Courier New', Courier, monospace",
        }}
      >
        {/* 사진 영역 — 3겹: (1)블러필 배경 (2)정사각 초점 사진 (3)스크림+메타 */}
        {hasPhoto ? (
          <div style={{ position: "relative", width: "100%", height: "300px", backgroundColor: "#0E140F", overflow: "hidden" }}>
            {blurBg && (
              <img src={blurBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <img
              src={entry.imageUrl ?? ""}
              crossOrigin="anonymous"
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
            />
            <div
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, rgba(12,18,14,0.4) 0%, rgba(12,18,14,0) 28%, rgba(12,18,14,0) 52%, rgba(22,32,26,0.96) 100%)",
              }}
            />
            <div style={{ position: "absolute", top: "14px", left: "14px", right: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {tickerChip ?? <span />}
              <span style={{ fontSize: "10px", color: "rgba(244,239,227,0.85)" }}>{entry.date.replace(/-/g, ".")}</span>
            </div>
          </div>
        ) : (
          // 무사진 — 타이포만으로 완성되는 헤더 밴드
          <div style={{ padding: "20px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {tickerChip ?? <span />}
            <span style={{ fontSize: "10px", color: C.muted }}>{entry.date.replace(/-/g, ".")}</span>
          </div>
        )}

        {/* 본문 */}
        <div style={{ padding: hasPhoto ? "16px 22px 22px" : "14px 22px 22px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "3px", color: C.muted, textTransform: "uppercase", marginBottom: "6px" }}>지켜낸 돈</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "38px", fontWeight: 900, color: C.emerald, letterSpacing: "-1px", lineHeight: 1 }}>+₩{fmt(entry.profit)}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "rgba(16,185,129,0.85)" }}>지켜냄</span>
          </div>

          <div style={{ fontSize: "15px", fontWeight: 700, color: C.cream, marginTop: "12px", lineHeight: 1.3 }}>{entry.title}</div>
          <div style={{ fontSize: "10px", color: C.muted, marginTop: "6px" }}>
            {entry.category} · 원가 ₩{fmt(entry.originalAmount)} → 실제 ₩{fmt(entry.actualAmount)}{rate > 0 ? ` · ${rate}% 절감` : ""}
          </div>

          {/* 김집사 평 */}
          <div style={{ marginTop: "16px", backgroundColor: C.panel, borderRadius: "12px", padding: "12px 14px", borderLeft: `2px solid ${C.gold}` }}>
            <div style={{ fontSize: "8px", letterSpacing: "2px", color: C.gold, textTransform: "uppercase", marginBottom: "5px" }}>김집사 평</div>
            <div style={{ fontSize: "11px", color: "#D9E0D7", lineHeight: 1.6 }}>{comment}</div>
          </div>

          {/* 푸터 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
            <span style={{ fontSize: "8px", letterSpacing: "2px", color: C.faint }}>GEOJILOG</span>
            <span style={{ fontSize: "8px", letterSpacing: "1px", color: C.faint }}>{entry.date.replace(/-/g, "")}</span>
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
          <img
            src={imageUrl}
            alt="preview"
            style={{ width: "160px", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
