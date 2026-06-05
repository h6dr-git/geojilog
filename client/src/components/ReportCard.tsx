// ============================================================
// 재무보고서 카드 — 청산 시 공유용 이미지 생성
// ============================================================

import { useRef, useState } from "react";
import { TrendingUp, Sparkles, Download, Share2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Entry {
  id: number;
  date: string;
  title: string;
  category: string;
  profit: number;
  originalAmount: number;
  actualAmount: number;
}

interface Props {
  entries: Entry[];
  userName: string;
  onClose: () => void;
  onClear: () => void;
}

export default function ReportCard({ entries, userName, onClose, onClear }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"report" | "confirm">("report");
  const [saving, setSaving] = useState(false);

  const totalProfit = entries.reduce((s, e) => s + e.profit, 0);
  const totalOriginal = entries.reduce((s, e) => s + e.originalAmount, 0);
  const avgRate = totalOriginal > 0 ? ((totalProfit / totalOriginal) * 100).toFixed(1) : "0.0";

  const profitByCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.profit;
    return acc;
  }, {});
  const topCategories = Object.entries(profitByCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const dateRange = entries.length > 0 ? (() => {
    const dates = entries.map(e => e.date).sort();
    const start = new Date(dates[0]).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    const end = new Date(dates[dates.length - 1]).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    return `${start} ~ ${end}`;
  })() : "";

  const handleSaveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `절약수익_리포트_${new Date().toLocaleDateString("ko-KR").replace(/\./g, "").replace(/ /g, "")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("이미지가 저장됐어요!");
    } catch {
      toast.error("이미지 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true, backgroundColor: null, logging: false });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share) {
          await navigator.share({
            files: [new File([blob], "절약수익_리포트.png", { type: "image/png" })],
            title: "내 절약 수익 리포트",
          });
        } else {
          // 공유 API 없으면 다운로드
          const link = document.createElement("a");
          link.download = "절약수익_리포트.png";
          link.href = URL.createObjectURL(blob);
          link.click();
        }
      }, "image/png");
    } catch {
      toast.error("공유에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={20} />
        </button>
        <p className="font-semibold text-sm">절약 수익 리포트</p>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 리포트 카드 (이미지로 저장될 영역) */}
        <div ref={cardRef} className="rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white shadow-xl">
          {/* 상단 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="font-bold text-sm">절약 수익 리포트</span>
            </div>
            <span className="text-xs text-white/70">{dateRange}</span>
          </div>

          {/* 메인 수익 */}
          <div className="mb-6">
            <p className="text-white/70 text-sm mb-1">{userName}의 총 절약 수익</p>
            <p className="text-4xl font-black tracking-tight">+₩{totalProfit.toLocaleString()}</p>
            <p className="text-white/80 text-sm mt-1">총 {entries.length}건 · 평균 절약률 {avgRate}%</p>
          </div>

          {/* 카테고리 TOP */}
          {topCategories.length > 0 && (
            <div className="bg-white/15 rounded-2xl p-4 mb-4">
              <p className="text-xs text-white/70 mb-3 flex items-center gap-1">
                <Sparkles size={10} /> TOP 카테고리
              </p>
              <div className="space-y-2">
                {topCategories.map(([cat, profit], i) => (
                  <div key={cat} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">#{i + 1}</span>
                      <span className="text-sm font-medium">{cat}</span>
                    </div>
                    <span className="text-sm font-bold">+₩{profit.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 하단 */}
          <div className="flex items-center justify-between pt-2 border-t border-white/20">
            <p className="text-xs text-white/60">거지답게 아께서 벌었다</p>
            <p className="text-xs text-white/60 font-mono">BEGGAR LOG</p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleSaveImage} disabled={saving} variant="outline"
            className="rounded-2xl h-12 gap-2">
            <Download size={16} /> 이미지 저장
          </Button>
          <Button onClick={handleShare} disabled={saving}
            className="rounded-2xl h-12 gap-2 bg-emerald-500 hover:bg-emerald-600">
            <Share2 size={16} /> 공유하기
          </Button>
        </div>

        {/* 청산 버튼 */}
        {step === "report" ? (
          <button onClick={() => setStep("confirm")}
            className="w-full py-3 rounded-2xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors">
            이 기록을 청산하고 새로 시작하기
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <p className="text-sm font-semibold text-red-700">정말 청산할까요?</p>
            </div>
            <p className="text-xs text-red-600/80 leading-relaxed">
              전체 {entries.length}건의 기록이 삭제됩니다. 이미지를 먼저 저장해두세요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl h-10 text-sm" onClick={() => setStep("report")}>
                취소
              </Button>
              <Button className="rounded-xl h-10 text-sm bg-red-500 hover:bg-red-600 text-white"
                onClick={onClear}>
                청산하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
