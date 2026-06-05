// ============================================================
// 게시글 상세 페이지
// ============================================================

import { useState } from "react";
import { ArrowLeft, Sparkles, ChevronRight, Trash2, Share2 } from "lucide-react";
import { PostStoryGenerator } from "@/components/StoryImageGenerator";
import { Button } from "@/components/ui/button";
import EditEntryDialog from "@/components/EditEntryDialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Entry {
  id: number; date: string; title: string;
  description?: string | null; category: string; ticker: string;
  originalAmount: number; actualAmount: number; profit: number;
  aiEstimated: "yes" | "no"; aiReason?: string | null;
  imageUrl?: string | null;
  createdAt: Date; userId: number;
}

interface Props {
  entry: Entry;
  categoryColor: string;
  onBack: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function PostDetail({ entry, categoryColor, onBack, onDeleted, onUpdated }: Props) {
  const [showStory, setShowStory] = useState(false);
  const profitRate = entry.originalAmount > 0
    ? ((entry.profit / entry.originalAmount) * 100).toFixed(1) : "0.0";
  const dateLabel = new Date(entry.date).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const utils = trpc.useUtils();
  const deleteEntry = trpc.savings.delete.useMutation({
    onSuccess: () => { utils.savings.list.invalidate(); onDeleted(); },
    onError: () => toast.error("삭제에 실패했습니다"),
  });

  const handleDelete = () => {
    if (confirm("이 항목을 삭제할까요?")) {
      deleteEntry.mutate({ id: entry.id });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-foreground hover:text-muted-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-semibold text-sm">거지로그</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-full"
            onClick={() => setShowStory(true)}>
            <Share2 size={16} />
          </Button>
          <EditEntryDialog entry={entry} onUpdate={() => { utils.savings.list.invalidate(); onUpdated(); }} />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
            onClick={handleDelete}>
            <Trash2 size={16} />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 사진 */}
        {entry.imageUrl && (
          <div className="aspect-square bg-muted overflow-hidden">
            <img src={entry.imageUrl} alt={entry.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* 제목 + 날짜 */}
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold border flex-shrink-0 ${categoryColor}`}>
              {entry.category.slice(0, 1)}
            </div>
            <div>
              <h1 className="text-xl font-bold">{entry.title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{dateLabel}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${categoryColor}`}>{entry.category}</span>
                {entry.aiEstimated === "yes" && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 flex items-center gap-0.5">
                    <Sparkles size={9} /> AI 분석
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 수익 카드 */}
          <div className="bg-emerald-500 rounded-2xl p-4 text-white">
            <p className="text-sm font-medium opacity-80">절약 수익</p>
            <p className="text-3xl font-bold mt-1">+₩{entry.profit.toLocaleString()}</p>
            <p className="text-sm opacity-80 mt-0.5">절약률 {profitRate}%</p>
          </div>

          {/* 금액 상세 */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-sm font-semibold">금액 상세</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">기준가 (원래 지출 예정)</span>
                <span className="text-sm font-medium">₩{entry.originalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-center">
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">실제 지출</span>
                <span className="text-sm font-bold text-foreground">₩{entry.actualAmount.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-600">절약 금액</span>
                <span className="text-sm font-bold text-emerald-600">+₩{entry.profit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* AI 분석 근거 */}
          {entry.aiEstimated === "yes" && entry.aiReason && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={14} className="text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">AI 분석 근거</p>
              </div>
              <p className="text-sm text-emerald-700/80 leading-relaxed">{entry.aiReason}</p>
            </div>
          )}

          {/* 메모 */}
          {entry.description && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold mb-1">메모</p>
              <p className="text-sm text-muted-foreground">{entry.description}</p>
            </div>
          )}
        </div>
      </div>
      {showStory && (
        <PostStoryGenerator entry={entry} onClose={() => setShowStory(false)} />
      )}
    </div>
  );
}
