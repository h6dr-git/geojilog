// ⚠️ 보류 자산(동면, #23 2차 대상) — #41 v3에서 자르르 퇴장: 부활 시 리액션을 쌀집군 숫자어로 재설계할 것.
// SavingsStoryCard — 기록 한 건의 공유 카드 (다크그린, 다꾸 감성 / 자르르 리액션)
// [v4] 캡처 모드 전환(SSOT §2): html2canvas 파일 생성 제거 — '크게 보기'로 UI 없는
//      전체화면을 띄우고, 공유는 사용자가 스크린샷으로 직접. 산출물은 앱 안에(앨범) 남는다.
//  - 공유물 = 객관적 사실(+수익·티커·날짜) + 자르르 리액션. 사용자 날것 메모는 미포함.
//  - 사진 3겹(블러필·정사각 초점·스크림), 사진 없어도 타이포로 완성.
//  - 색은 THEME 토큰으로 분리 — 향후 테마/스킨 상품화 시 이 객체만 갈아끼우면 됨.
// ============================================================

import { useState, useEffect } from "react";
import { X, Maximize2 } from "lucide-react";
import CaptureView from "@/components/CaptureView";

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

// 테마 토큰 — 나중에 스킨/테마 상품 추가 시 이 객체를 늘리면 됨(지금은 기본 1종)
const THEME = {
  card: "#16201A",      // 카드 배경(다크그린)
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

// 자르르 리액션 — 신나는 조수 말투. 객관 사실(절약)만 반응, 메모는 안 씀.
function jarrReaction(profit: number, id: number): string {
  const pick = (arr: string[]) => arr[Math.abs(id) % arr.length];
  if (profit <= 0) return pick(["본전이라도 지켰띵 ㅎ", "다음엔 더 지키자띵!"]);
  if (profit < 3000) return pick(["오늘도 자르르~ ㅋ", "야금야금 지켰띵 ㅋ"]);
  if (profit < 10000) return pick(["또 지켰띵!! ㅋㅋ", "꽉 챙겼다 자르르~"]);
  return pick(["와 대박이띵 ㅋㅋㅋ", "이건 못 참지띵!!"]);
}

// 극단비율 블러필 배경 — 캔버스에 블러 픽셀을 구워 어떤 비율의 사진도 카드에 어울리게
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

export default function SavingsStoryCard({ entry, onClose }: Props) {
  const [blurBg, setBlurBg] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState(false);

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

  // ── 카드 본체 (모달 미리보기·캡처 뷰에서 동일하게 사용) ──
  const card = (
    <div style={{ width: "320px", backgroundColor: THEME.card, borderRadius: "20px", padding: "12px", fontFamily: SANS }}>
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
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: hasPhoto ? "9px" : "0" }}>
          <span style={{ fontSize: "13px", color: THEME.caption, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "210px" }}>{entry.title}</span>
          <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "1.5px", color: THEME.faint }}>GEOJILOG</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
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

        {card}

        {/* 크게 보기 — 파일 저장 없음, 캡처는 본인 스크린샷으로 (SSOT §2) */}
        <div style={{ marginTop: "16px", width: "320px" }}>
          <button
            onClick={() => setCaptureMode(true)}
            style={{
              width: "100%", padding: "14px",
              backgroundColor: THEME.emerald, color: "#ffffff",
              border: "none", borderRadius: "12px",
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            <Maximize2 size={16} /> 크게 보기 · 캡처
          </button>
        </div>
      </div>

      {captureMode && (
        <CaptureView bg="#0A0F0B" onClose={() => setCaptureMode(false)}>
          {card}
        </CaptureView>
      )}
    </>
  );
}
