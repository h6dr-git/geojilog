// SavingsStoryCard — 영수증 스킨 (사진 없음, AI 멘트 전문, 메모/배수 제거)
// html2canvas: oklch 금지, 모든 색상 hex/rgba inline style
// ============================================================

import { useRef, useState, useCallback } from "react";
import { Share2, Download, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SavingsEntry {
  id: number;
  date: string;
  title: string;
  category: string;
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

// 이모지 제거 요청으로 CATEGORY_EMOJI 삭제

// 바코드 줄무늬 장식
function BarcodeDecor() {
  const bars = [3,1,2,1,3,1,1,2,1,3,2,1,1,3,1,2,1,1,3,1,2,3,1,1,2,1,3,1,2,1];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: "28px", gap: "1px", justifyContent: "center" }}>
      {bars.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w * 1.5}px`,
            height: i % 5 === 0 ? "28px" : "20px",
            backgroundColor: i % 2 === 0 ? "#222222" : "transparent",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

type CardTheme = "dark" | "cream" | "pnl" | "pnl_light";

const THEMES: Record<CardTheme, { bg: string; cardBg: string; cardText: string; subText: string; border: string; label: string }> = {
  dark: {
    bg: "#0a0a0a",
    cardBg: "#ffffff",
    cardText: "#111111",
    subText: "#888888",
    border: "#cccccc",
    label: "다크",
  },
  cream: {
    bg: "#f5f0e8",
    cardBg: "#fffdf7",
    cardText: "#2a2218",
    subText: "#9a8f7e",
    border: "#d4c9b0",
    label: "크림",
  },
  pnl: {
    bg: "#0f1117",
    cardBg: "#0f1117",
    cardText: "#e8e8e8",
    subText: "#6b7280",
    border: "#2a2d35",
    label: "손익(다크)",
  },
  pnl_light: {
    bg: "#f8f9fa",
    cardBg: "#f8f9fa",
    cardText: "#1a1a2e",
    subText: "#6b7280",
    border: "#e2e8f0",
    label: "손익(라이트)",
  },
};

export default function SavingsStoryCard({ entry, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<CardTheme>("dark");
  const t = THEMES[theme];

  // 항목명만 편집 가능 (메모는 카드에 미표시)
  const [editTitle, setEditTitle] = useState(entry.title);

  const utils = trpc.useUtils();
  const updateEntry = trpc.savings.update.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });

  // 이모지 미사용

  const handleCapture = useCallback(async () => {
    if (!cardRef.current) return;

    // 항목명이 수정된 경우 원본 기록에 먼저 반영
    if (editTitle !== entry.title) {
      try {
        await updateEntry.mutateAsync({ id: entry.id, title: editTitle || entry.title });
      } catch {
        setCapturing(false);
        return;
      }
    }

    setCapturing(true);
    // oklch 색상 변수를 html2canvas 호환 hex로 임시 교체
    const root = document.documentElement;
    const oklchVars = [
      "--background", "--foreground", "--card", "--card-foreground",
      "--popover", "--popover-foreground", "--primary", "--primary-foreground",
      "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
      "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
      "--border", "--input", "--ring",
    ];
    const saved: Record<string, string> = {};
    oklchVars.forEach(v => {
      saved[v] = root.style.getPropertyValue(v);
      root.style.setProperty(v, "transparent");
    });
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current!, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#0a0a0a",
        logging: false,
        ignoreElements: (el) => el.tagName === "STYLE" && el.textContent?.includes("oklch") === true,
      });
      setImageUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("캐처 실패", e);
    } finally {
      // oklch 변수 복원
      oklchVars.forEach(v => {
        if (saved[v]) root.style.setProperty(v, saved[v]);
        else root.style.removeProperty(v);
      });
      setCapturing(false);
    }
  }, [editTitle, entry, updateEntry]);

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `거지로그_${entry.date}_${editTitle}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!imageUrl) return;
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `거지로그_${entry.date}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "거지로그 절약 인증" });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.95)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
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

      {/* 항목명 편집 + 테마 (캡처 밖) */}
      {!imageUrl && (
        <div style={{ width: "340px", marginBottom: "12px" }}>
          {/* 테마 선택 */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            {(Object.keys(THEMES) as CardTheme[]).map(k => (
              <button
                key={k}
                onClick={() => setTheme(k)}
                style={{
                  padding: "5px 12px", fontSize: "11px", borderRadius: "6px",
                  border: theme === k ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.15)",
                  backgroundColor: theme === k ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                  color: theme === k ? "#10b981" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                }}
              >
                {THEMES[k].label}
              </button>
            ))}
          </div>
          <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "4px" }}>
            항목명 (편집 시 원본도 수정됨)
          </label>
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{
              width: "100%", padding: "8px 10px",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "6px", color: "#ffffff",
              fontSize: "13px", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* ── 카드 (캡처 대상) ── */}
      <div ref={cardRef} style={{ width: "340px", position: "relative", fontFamily: "'Courier New', Courier, monospace" }}>

        {/* ── 영수증 스킨 (dark / cream) ── */}
        {theme !== "pnl" && theme !== "pnl_light" && (
          <div style={{
            backgroundColor: t.bg,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "32px 24px 28px", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: theme === "dark"
                ? "radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)"
                : "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
              backgroundSize: "18px 18px", pointerEvents: "none",
            }} />
            <div style={{
              width: "100%", backgroundColor: t.cardBg, borderRadius: "4px",
              padding: "22px 20px 18px",
              boxShadow: theme === "dark" ? "4px 6px 0px rgba(0,0,0,0.6)" : "4px 6px 0px rgba(0,0,0,0.12)",
              transform: "rotate(-0.4deg)", position: "relative", zIndex: 1,
            }}>
              <div style={{ position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)", width: "14px", height: "14px", backgroundColor: t.bg, borderRadius: "50%" }} />
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <div style={{ fontSize: "9px", letterSpacing: "4px", color: t.subText, textTransform: "uppercase", marginBottom: "3px" }}>거지로그</div>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: t.cardText, letterSpacing: "3px" }}>SAVINGS RECEIPT</div>
              </div>
              <div style={{ borderTop: `1px dashed ${t.border}`, marginBottom: "12px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: t.subText, marginBottom: "10px" }}>
                <span>{entry.date.replace(/-/g, ".")}</span>
                <span>{entry.category}</span>
              </div>
              <div style={{ fontSize: "15px", fontWeight: "bold", color: t.cardText, marginBottom: "16px", lineHeight: 1.3 }}>{editTitle}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.subText, marginBottom: "4px" }}>
                <span>원가</span><span style={{ textDecoration: "line-through" }}>₩{fmt(entry.originalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.cardText, marginBottom: "14px" }}>
                <span>실제 지출</span><span>₩{fmt(entry.actualAmount)}</span>
              </div>
              <div style={{ borderTop: `1px dashed ${t.border}`, marginBottom: "14px" }} />
              <div style={{ marginBottom: "4px" }}>
                <div style={{ fontSize: "8px", color: t.subText, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>수익</div>
                <div style={{ fontSize: "30px", fontWeight: "900", color: "#10b981", letterSpacing: "-1px", lineHeight: 1 }}>+₩{fmt(entry.profit)}</div>
              </div>
              {entry.aiReason && (
                <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: `1px solid ${t.border}`, fontSize: "9px", color: t.subText, lineHeight: 1.6 }}>{entry.aiReason}</div>
              )}
              <div style={{ borderTop: `1px dashed ${t.border}`, marginTop: "16px", marginBottom: "12px" }} />
              <BarcodeDecor />
              <div style={{ textAlign: "center", fontSize: "7px", color: t.subText, marginTop: "5px", letterSpacing: "2px" }}>GEJILOK · {entry.date.replace(/-/g, "")}</div>
            </div>
          </div>
        )}

        {/* ── 손익계산서 스킨 (pnl / pnl_light) ── */}
        {(theme === "pnl" || theme === "pnl_light") && (
          <div style={{
            backgroundColor: "#0f1117",
            padding: "28px 24px 24px",
            minHeight: "420px",
          }}>
            {/* 상단 헤더 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "8px", letterSpacing: "3px", color: "#4b5563", textTransform: "uppercase", marginBottom: "4px" }}>거지로그</div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: t.cardText, letterSpacing: "1px" }}>손익계산서</div>
                  <div style={{ fontSize: "8px", color: "#4b5563", marginTop: "2px" }}>PROFIT & LOSS STATEMENT</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", color: "#4b5563" }}>{entry.date.replace(/-/g, ".")}</div>
                  <div style={{ fontSize: "9px", color: "#4b5563", marginTop: "2px" }}>{entry.category}</div>
                </div>
              </div>
              <div style={{ height: "1px", backgroundColor: t.border, marginTop: "16px" }} />
            </div>

            {/* 항목명 */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>항목</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: t.cardText, lineHeight: 1.3 }}>{editTitle}</div>
            </div>

            {/* 수익 섹션 */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>I. 효익</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: theme === "pnl" ? "#161b27" : "#edf2f7", borderRadius: "4px", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", color: t.subText }}>원가 (시중가 기준)</span>
                <span style={{ fontSize: "11px", color: t.cardText, fontFamily: "'Courier New', monospace" }}>₩{fmt(entry.originalAmount)}</span>
              </div>
            </div>

            {/* 비용 섹션 */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>II. 비용</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: theme === "pnl" ? "#161b27" : "#edf2f7", borderRadius: "4px", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", color: t.subText }}>실제 지출액</span>
                <span style={{ fontSize: "11px", color: "#f87171", fontFamily: "'Courier New', monospace" }}>-₩{fmt(entry.actualAmount)}</span>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ height: "1px", backgroundColor: t.border, margin: "16px 0" }} />

            {/* 이익 */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", backgroundColor: "rgba(16,185,129,0.08)", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div>
                  <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "3px" }}>III. 순익</div>
                  <div style={{ fontSize: "9px", color: "#6b7280" }}>NET PROFIT</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "26px", fontWeight: "900", color: "#10b981", letterSpacing: "-1px", lineHeight: 1, fontFamily: "'Courier New', monospace" }}>+₩{fmt(entry.profit)}</div>
                  <div style={{ fontSize: "9px", color: "#10b981", opacity: 0.6, marginTop: "2px" }}>
                    {entry.actualAmount > 0 ? `절감률 ${Math.round((entry.profit / entry.originalAmount) * 100)}%` : "100% 절감"}
                  </div>
                </div>
              </div>
            </div>

            {/* AI 코멘트 */}
            {entry.aiReason && (
              <div style={{ padding: "10px 12px", backgroundColor: theme === "pnl" ? "#161b27" : "#edf2f7", borderRadius: "4px", borderLeft: "2px solid #10b981" }}>
                <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "5px" }}>AI 분석</div>
                <div style={{ fontSize: "9px", color: "#6b7280", lineHeight: 1.6 }}>{entry.aiReason}</div>
              </div>
            )}

            {/* 하단 */}
            <div style={{ height: "1px", backgroundColor: t.border, marginTop: "20px", marginBottom: "10px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "7px", color: t.subText, letterSpacing: "2px" }}>GEJILOK P&L</div>
              <div style={{ fontSize: "7px", color: t.subText, letterSpacing: "1px" }}>{entry.date.replace(/-/g, "")}</div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div style={{ marginTop: "16px", display: "flex", gap: "10px", width: "340px" }}>
        {!imageUrl ? (
          <button
            onClick={handleCapture}
            disabled={capturing}
            style={{
              flex: 1, padding: "14px",
              backgroundColor: "#10b981", color: "#ffffff",
              border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: "600",
              cursor: capturing ? "not-allowed" : "pointer",
              opacity: capturing ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {capturing
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> 생성 중...</>
              : <><Share2 size={16} /> 이미지 생성</>
            }
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
                backgroundColor: "#1a1a1a", color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
                fontSize: "13px", fontWeight: "500", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              <Download size={15} /> 저장
            </button>
            <button
              onClick={handleShare}
              style={{
                flex: 2, padding: "14px",
                backgroundColor: "#10b981", color: "#ffffff",
                border: "none", borderRadius: "10px",
                fontSize: "14px", fontWeight: "600", cursor: "pointer",
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
