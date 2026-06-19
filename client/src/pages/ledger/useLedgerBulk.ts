import { useState, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { SavingsEntry } from "@/lib/ledger";

export function useLedgerBulk(displayEntries: SavingsEntry[]) {
  const utils = trpc.useUtils();
  const updateBulk = trpc.savings.updateBulk.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });
  const deleteBulk = trpc.savings.deleteBulk.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | "source" | "category" | "delete">(null);

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkAction(null);
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleIds = useMemo(() => displayEntries.map((e) => e.id), [displayEntries]);

  const runBulk = async (data: { incomeSource?: string | null; category?: string }) => {
    try {
      await updateBulk.mutateAsync({ ids: Array.from(selected), ...data });
      toast.success(`${selected.size}건을 바꿨어요`);
      exitSelect();
    } catch (e) {
      toast.error((e as Error)?.message || "일괄 변경에 실패했어요");
    }
  };

  return {
    selectMode,
    setSelectMode,
    selected,
    setSelected,
    bulkAction,
    setBulkAction,
    exitSelect,
    toggleSelect,
    allVisibleIds,
    runBulk,
    updateBulk,
    deleteBulk,
  };
}
