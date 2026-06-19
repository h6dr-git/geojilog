import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import IncomeSourceChips from "@/components/IncomeSourceChips";
import ConfirmDialog from "@/components/ConfirmDialog";
import { UNCLASSIFIED } from "@shared/incomeSources";
import type { useLedgerBulk } from "./useLedgerBulk";

type BulkApi = Pick<
  ReturnType<typeof useLedgerBulk>,
  "selected" | "bulkAction" | "setBulkAction" | "runBulk" | "exitSelect" | "updateBulk" | "deleteBulk"
>;

interface LedgerBulkBarProps extends BulkApi {
  selectMode: boolean;
  categoryNames: string[];
}

export default function LedgerBulkBar({
  selectMode,
  selected,
  bulkAction,
  setBulkAction,
  runBulk,
  exitSelect,
  updateBulk,
  deleteBulk,
  categoryNames,
}: LedgerBulkBarProps) {
  return (
    <>
      {selectMode && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-md"
          style={{ bottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-1.5 surface-glass rounded-2xl px-2 py-2">
            <button
              onClick={() => setBulkAction("source")}
              disabled={selected.size === 0 || updateBulk.isPending}
              className="flex-1 py-2.5 text-caption font-medium text-ink rounded-xl bg-gold/10 active:bg-gold/20 disabled:opacity-40 transition-colors"
            >
              수익원 지정
            </button>
            <button
              onClick={() => setBulkAction("category")}
              disabled={selected.size === 0 || updateBulk.isPending}
              className="flex-1 py-2.5 text-caption font-medium text-ink rounded-xl bg-emerald-50 active:bg-emerald-100 disabled:opacity-40 transition-colors"
            >
              카테고리
            </button>
            <button
              onClick={() => setBulkAction("delete")}
              disabled={selected.size === 0 || deleteBulk.isPending}
              aria-label="일괄 삭제"
              className="px-4 py-2.5 text-red-400 rounded-xl bg-red-50 active:bg-red-100 disabled:opacity-40 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}

      {bulkAction === "source" && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => setBulkAction(null)}>
          <div className="w-full max-w-lg sheet-panel px-5 pt-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <p className="text-body font-semibold text-ink">선택한 {selected.size}건의 수익원</p>
              <p className="voice-label mt-0.5">일괄 지정</p>
            </div>
            <p className="text-micro text-ink-faint text-center mb-3">미분류로 되돌리려면 맨 아래 버튼</p>
            <IncomeSourceChips value={null} onChange={(v) => { if (v) runBulk({ incomeSource: v }); }} />
            <button
              onClick={() => runBulk({ incomeSource: null })}
              className="mt-3 w-full py-2.5 text-caption text-ink-soft border border-line rounded-xl active:bg-cream transition-colors"
            >
              {UNCLASSIFIED}로 되돌리기
            </button>
          </div>
        </div>
      )}

      {bulkAction === "category" && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => setBulkAction(null)}>
          <div className="w-full max-w-lg sheet-panel px-5 pt-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <p className="text-body font-semibold text-ink">선택한 {selected.size}건의 카테고리</p>
              <p className="voice-label mt-0.5">일괄 변경</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoryNames.map((c) => (
                <button
                  key={c}
                  onClick={() => runBulk({ category: c })}
                  className="ledger-chip ledger-chip-muted px-3 py-1.5 active:brightness-95 transition-all"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {bulkAction === "delete" && (
        <ConfirmDialog
          title={`${selected.size}건을 삭제할까요?`}
          description="선택한 기록이 장부에서 사라져요. 되돌릴 수 없어요."
          confirmLabel="삭제"
          onConfirm={async () => {
            try {
              await deleteBulk.mutateAsync({ ids: Array.from(selected) });
              toast.success(`${selected.size}건을 삭제했어요`, { id: "entry-delete" });
              setBulkAction(null);
              exitSelect();
            } catch {
              toast.error("삭제에 실패했어요");
              throw new Error("delete failed");
            }
          }}
          onCancel={() => setBulkAction(null)}
        />
      )}
    </>
  );
}
