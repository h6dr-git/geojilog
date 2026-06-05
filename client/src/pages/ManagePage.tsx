// ============================================================
// 관리 페이지 — 다중 선택 삭제, 전체 목록 관리
// ============================================================

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { COLOR_CLASS_MAP } from "@/components/CategoryManager";
import { Trash2, CheckSquare, Square, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditEntryDialog from "@/components/EditEntryDialog";
import { toast } from "sonner";

interface Props {
  categoryColorMap: Record<string, string>;
  onSelectEntry: (entry: any) => void;
}

export default function ManagePage({ categoryColorMap, onSelectEntry }: Props) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });

  const deleteEntry = trpc.savings.delete.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
    onError: () => toast.error("삭제에 실패했습니다"),
  });
  const deleteBulk = trpc.savings.deleteBulk.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
    onError: () => toast.error("삭제에 실패했습니다"),
  });

  const totalProfit = useMemo(() => entries.reduce((s, e) => s + e.profit, 0), [entries]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(entries.map(e => e.id)));
  const deselectAll = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    await deleteBulk.mutateAsync({ ids });
    setSelected(new Set());
    setSelectMode(false);
    setShowConfirm(false);
    toast.success(`${ids.length}건 삭제 완료`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground animate-pulse">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">전체 {entries.length}건</p>
            <p className="text-xs text-muted-foreground">누적 +₩{totalProfit.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button onClick={selected.size === entries.length ? deselectAll : selectAll}
                  className="text-xs text-emerald-600 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50">
                  {selected.size === entries.length ? "전체 해제" : "전체 선택"}
                </button>
                {selected.size > 0 && (
                  <button onClick={() => setShowConfirm(true)}
                    className="flex items-center gap-1 text-xs text-red-500 font-medium px-2 py-1 rounded-lg hover:bg-red-50 border border-red-200">
                    <Trash2 size={12} /> {selected.size}건 삭제
                  </button>
                )}
                <button onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                  className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted">
                  취소
                </button>
              </>
            ) : (
              <button onClick={() => setSelectMode(true)}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-xl border border-border hover:bg-muted active:scale-95 transition-all">
                <CheckSquare size={13} /> 선택 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 목록 */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
          <p className="text-sm text-muted-foreground">등록된 내역이 없어요</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map(entry => {
            const catColor = categoryColorMap[entry.category] ?? COLOR_CLASS_MAP["gray"];
            const isSelected = selected.has(entry.id);
            const profitRate = entry.originalAmount > 0
              ? ((entry.profit / entry.originalAmount) * 100).toFixed(1) : "0.0";
            const dateLabel = new Date(entry.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 bg-card transition-colors ${
                  isSelected ? "bg-red-50" : "hover:bg-muted/20"
                }`}
                onClick={() => {
                  if (selectMode) toggleSelect(entry.id);
                  else onSelectEntry(entry);
                }}
              >
                {/* 선택 체크박스 */}
                {selectMode && (
                  <div className="flex-shrink-0">
                    {isSelected
                      ? <CheckSquare size={20} className="text-red-500" />
                      : <Square size={20} className="text-muted-foreground/40" />}
                  </div>
                )}

                {/* 썸네일 */}
                {entry.imageUrl ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                    <img src={entry.imageUrl} alt={entry.title}
                      className="w-full h-full object-cover block" />
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold border flex-shrink-0 ${catColor}`}>
                    {entry.category.slice(0, 1)}
                  </div>
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{entry.title}</p>
                    <span className="text-sm font-bold text-emerald-600 flex-shrink-0">
                      +₩{entry.profit.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">{dateLabel}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catColor}`}>{entry.category}</span>
                    {entry.aiEstimated === "yes" && (
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                        <Sparkles size={8} /> AI
                      </span>
                    )}
                    <span className="text-xs text-emerald-500 ml-auto">+{profitRate}%</span>
                  </div>
                </div>

                {/* 수정/삭제 버튼 (선택 모드 아닐 때) */}
                {!selectMode && (
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <EditEntryDialog entry={entry} onUpdate={() => utils.savings.list.invalidate()} />
                    <Button variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                      onClick={() => {
                        if (confirm("이 항목을 삭제할까요?")) {
                          deleteEntry.mutate({ id: entry.id });
                        }
                      }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-background rounded-t-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold">{selected.size}건을 삭제할까요?</p>
                <p className="text-sm text-muted-foreground">삭제한 항목은 복구할 수 없어요</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl h-12" onClick={() => setShowConfirm(false)}>
                취소
              </Button>
              <Button className="rounded-xl h-12 bg-red-500 hover:bg-red-600 text-white"
                onClick={handleBulkDelete}
                disabled={deleteBulk.isPending}>
                {deleteBulk.isPending ? "삭제 중..." : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
