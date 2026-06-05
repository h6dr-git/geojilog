// ============================================================
// StoryImageGenerator — 인스타 스토리 공유용 이미지 생성
// 1. 주간 리포트 카드
// 2. 개별 게시글 9:16 스토리 카드 (사진 전체 배경)
// ============================================================

import { useRef, useState } from "react";
import { TrendingUp, Download, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Entry {
  id: number;
  date: string;
  title: string;
  category: string;
  originalAmount: number;
  actualAmount: number;
  profit: number;
  aiEstimated: "yes" | "no";
  aiReason?: string | null;
  imageUrl?: string | null;
}

// 수익 배수 계산
function getProfitMultiplier(originalAmount: number, actualAmount: number): string {
  if (actualAmount === 0) return "∞";
  const multiplier = originalAmount / actualAmount;
  if (multiplier >= 10) return `×${Math.round(multiplier)}`;
  return `×${multiplier.toFixed(1)}`;
}

// ── 주간 리포트 스토리 ──────────────────────────────────────
interface WeeklyStoryProps {
  entries: Entry[];
  weekLabel: string;
  userName: string;
  onClose: () => void;
}

export function WeeklyStoryGenerator({ entries, weekLabel, userName, onClose }: WeeklyStoryProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const totalProfit = entries.reduce((s, e) => s + e.profit, 0);
  const totalOriginal = entries.reduce((s, e) => s + e.originalAmount, 0);
  const avgRate = totalOriginal > 0 ? ((totalProfit / totalOriginal) * 100).toFixed(1) : "0.0";
  const profitByCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.profit;
    return acc;
  }, {});
  const topCategories = Object.entries(profitByCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const photoEntries = entries.filter(e => e.imageUrl).slice(0, 4);

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, useCORS: true, allowTaint: true, backgroundColor: "#0a0a0a", logging: false,
        width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight, imageTimeout: 15000,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
            const bg = window.getComputedStyle(el).backgroundColor;
            if (bg && bg.includes("oklch")) el.style.backgroundColor = "transparent";
          });
          clonedDoc.querySelectorAll("img").forEach((img) => { img.crossOrigin = "anonymous"; });
        },
      });
      const link = document.createElement("a");
      link.download = `거지로그_주간리포트_${weekLabel.replace(/[~\s]/g, "")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("이미지가 저장됐어요!");
    } catch (e) {
      console.error(e);
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
        <X size={24} />
      </button>
      <div ref={cardRef}
        style={{ width: "270px", height: "480px", backgroundColor: "#0a0a0a", borderRadius: "24px", overflow: "hidden", position: "relative", fontFamily: "system-ui, sans-serif" }}>
        {photoEntries.length > 0 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", opacity: 0.2 }}>
            {photoEntries.map(e => (
              <img key={e.id} src={e.imageUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
            ))}
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent, rgba(0,0,0,0.8))" }} />
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "auto" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "6px", backgroundColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={10} color="white" />
            </div>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Beggar Log</span>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginBottom: "4px" }}>{weekLabel}</p>
            <p style={{ color: "white", fontSize: "36px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>+₩{totalProfit.toLocaleString()}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
              <span style={{ color: "#34d399", fontSize: "13px", fontWeight: 600 }}>↑ {avgRate}%</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>{entries.length}건</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "16px" }} />
          {topCategories.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {topCategories.map(([cat, profit], i) => (
                <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px", fontFamily: "monospace" }}>0{i + 1}</span>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>{cat}</span>
                  </div>
                  <span style={{ color: "#34d399", fontSize: "11px", fontWeight: 700 }}>+₩{profit.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{userName}</span>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "9px", fontFamily: "monospace" }}>beggarlog</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <Button onClick={handleSave} disabled={saving}
          className="rounded-2xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6">
          <Download size={16} /> {saving ? "저장 중..." : "이미지 저장하기"}
        </Button>
      </div>
    </div>
  );
}

// ── 개별 게시글 스토리 (9:16) ──────────────────────────────
interface PostStoryProps {
  entry: Entry;
  onClose: () => void;
}

// 9:16 비율: 360×640 (scale 3 → 1080×1920)
const CARD_W = 360;
const CARD_H = 640;

export function PostStoryGenerator({ entry, onClose }: PostStoryProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const dateLabel = new Date(entry.date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  // AI 캡션: 하단 증빙용 (100자 제한)
  const aiCaption = entry.aiReason
    ? (entry.aiReason.length > 100 ? entry.aiReason.slice(0, 97) + "..." : entry.aiReason)
    : null;

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#000000",
        logging: false,
        width: CARD_W,
        height: CARD_H,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
            const bg = window.getComputedStyle(el).backgroundColor;
            if (bg && bg.includes("oklch")) el.style.backgroundColor = "transparent";
          });
          clonedDoc.querySelectorAll("img").forEach((img) => { img.crossOrigin = "anonymous"; });
        },
      });
      const link = document.createElement("a");
      link.download = `거지로그_${entry.title}_${entry.date}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("이미지가 저장됐어요!");
    } catch (e) {
      console.error(e);
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      {/* 닫기 버튼 */}
      <button onClick={onClose}
        style={{ position: "absolute", top: "16px", right: "16px", color: "rgba(255,255,255,0.7)",
          background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
        <X size={24} />
      </button>

      {/* 9:16 카드 — scale(0.5)로 화면에 맞게 축소 표시, 실제 캡처는 원본 크기 */}
      <div
        ref={cardRef}
        style={{
          width: `${CARD_W}px`, height: `${CARD_H}px`,
          position: "relative", overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
          flexShrink: 0,
          transform: "scale(0.5)", transformOrigin: "top center",
          marginBottom: `-${CARD_H * 0.5}px`,
        }}>

        {/* ① 사진 배경 — 전체 커버 */}
        {entry.imageUrl ? (
          <img src={entry.imageUrl} alt={entry.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            crossOrigin="anonymous" />
        ) : (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#111" }} />
        )}

        {/* ② 그라디언트 오버레이 */}
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 25%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.92) 100%)" }} />

        {/* ③ 상단: 브랜드 */}
        <div style={{ position: "absolute", top: "32px", left: "32px",
          display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "26px", height: "26px", borderRadius: "8px", backgroundColor: "#10b981",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={14} color="white" />
          </div>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase" }}>Beggar Log</span>
        </div>

        {/* ④ 중앙: 핵심 데이터 */}
        <div style={{ position: "absolute", left: "32px", right: "32px",
          top: "50%", transform: "translateY(-52%)",
          display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* 제목 + 날짜 */}
          <div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0 }}>
              {dateLabel} · {entry.category}
            </p>
            <p style={{ color: "white", fontSize: "22px", fontWeight: 700, margin: "5px 0 0", lineHeight: 1.2 }}>
              {entry.title}
            </p>
          </div>

          {/* 원가(취소선) → 실제지출(굵게) */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
            <span style={{
              color: "rgba(255,255,255,0.4)", fontSize: "20px", fontWeight: 400,
              textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.35)",
              textDecorationThickness: "2px",
            }}>
              ₩{entry.originalAmount.toLocaleString()}
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "18px" }}>→</span>
            <span style={{ color: "white", fontSize: "26px", fontWeight: 800 }}>
              {entry.actualAmount === 0 ? "₩0" : `₩${entry.actualAmount.toLocaleString()}`}
            </span>
          </div>

          {/* 절약 수익 — 최대 강조 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500,
              letterSpacing: "0.1em", textTransform: "uppercase" }}>절약 수익</span>
            <span style={{ color: "#10b981", fontSize: "62px", fontWeight: 900,
              lineHeight: 1, letterSpacing: "-0.02em" }}>
              +₩{entry.profit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ⑤ 하단: AI 캡션 */}
        {aiCaption && (
          <div style={{ position: "absolute", bottom: "32px", left: "32px", right: "32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
              <Sparkles size={11} color="rgba(255,255,255,0.4)" style={{ marginTop: "2px", flexShrink: 0 }} />
              <p style={{ color: "rgba(255,255,255,0.62)", fontSize: "12px", fontWeight: 300,
                lineHeight: 1.6, margin: 0 }}>{aiCaption}</p>
            </div>
          </div>
        )}
      </div>

      {/* 저장 버튼 */}
      <div style={{ marginTop: `${CARD_H * 0.5 + 20}px`, display: "flex", gap: "12px" }}>
        <Button onClick={handleSave} disabled={saving}
          className="rounded-2xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6">
          <Download size={16} /> {saving ? "저장 중..." : "이미지 저장하기"}
        </Button>
      </div>
    </div>
  );
}
