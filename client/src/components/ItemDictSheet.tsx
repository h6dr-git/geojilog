// 단골 사전 관리 시트 — 기록에서 자동 축적된 '내 항목'의 가격을 직접 관리한다. (P2 2차 · #37)
// 고정(★)하면 가격 자동 갱신이 멈추고 사용자가 정한 기준가·평소가가 유지된다.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Star, Trash2, Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmt } from "@/lib/ledger";

type Item = {
  id: number;
  name: string;
  category: string;
  usualOriginal: number;
  usualActual: number;
  pinned: string;
  timesUsed: number;
};

export default function ItemDictSheet({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.items.list.useQuery();
  const updateItem = trpc.items.update.useMutation({ onSuccess: () => utils.items.list.invalidate() });
  const removeItem = trpc.items.remove.useMutation({ onSuccess: () => utils.items.list.invalidate() });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ usualOriginal: "", usualActual: "" });
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const startEdit = (it: Item) => {
    setEditingId(it.id);
    setForm({ usualOriginal: String(it.usualOriginal), usualActual: String(it.usualActual) });
  };

  const saveEdit = async (it: Item) => {
    try {
      await updateItem.mutateAsync({
        id: it.id,
        usualOriginal: Number(form.usualOriginal) || it.usualOriginal,
        usualActual: Math.max(0, Number(form.usualActual) || 0),
        pinned: "yes", // 직접 고친 가격은 자동 갱신으로부터 보호
      });
      toast.success("저장됐습니다 — 가격이 고정(★)됐어요");
      setEditingId(null);
    } catch {
      toast.error("저장에 실패했습니다");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      style={{ animation: "idFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes idUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes idFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain"
        style={{ animation: "idUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">단골 사전</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>
        <p className="text-micro text-ink-faint text-center mb-4">
          기록할수록 자동으로 쌓여요 · 가격을 직접 고치면 ★고정되어 그 값이 기준이 돼요
        </p>

        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>
        ) : items.length === 0 ? (
          <p className="text-caption text-ink-soft text-center py-8">
            아직 단골이 없어요 — 같은 항목을 기록하면 여기 쌓여요
          </p>
        ) : (
          <div className="space-y-1">
            {(items as Item[]).map((it) => (
              <div key={it.id} className="border border-line rounded-card px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateItem.mutate({ id: it.id, pinned: it.pinned === "yes" ? "no" : "yes" })}
                    aria-label="고정"
                    className="shrink-0 active:scale-90 transition-transform"
                  >
                    <Star size={15} className={it.pinned === "yes" ? "text-gold fill-gold" : "text-ink-faint"} />
                  </button>
                  <button onClick={() => startEdit(it)} className="flex-1 min-w-0 text-left">
                    <p className="text-body font-medium text-ink truncate">{it.name}</p>
                    <p className="text-micro text-ink-soft">{it.category} · {it.timesUsed}회</p>
                  </button>
                  {editingId !== it.id && (
                    <button onClick={() => startEdit(it)} className="text-right shrink-0">
                      <p className="text-caption text-ink-soft tabular-nums">
                        <span className="line-through">₩{fmt(it.usualOriginal)}</span>
                        <span className="mx-1 text-ink-faint">→</span>₩{fmt(it.usualActual)}
                      </p>
                      <p className="text-micro font-mono text-emerald-600 tabular-nums">평소 +₩{fmt(Math.max(0, it.usualOriginal - it.usualActual))}</p>
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(it)}
                    aria-label="삭제"
                    className="p-1.5 text-ink-faint active:text-red-400 shrink-0 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {editingId === it.id && (
                  <div className="flex items-end gap-2 mt-2.5 pt-2.5 border-t border-line">
                    <div className="flex-1">
                      <label className="text-micro text-ink-soft block mb-0.5">기준가(시중가)</label>
                      <input
                        type="number"
                        value={form.usualOriginal}
                        onChange={(e) => setForm((f) => ({ ...f, usualOriginal: e.target.value }))}
                        className="w-full text-caption border border-line rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-micro text-ink-soft block mb-0.5">평소 내 가격</label>
                      <input
                        type="number"
                        value={form.usualActual}
                        onChange={(e) => setForm((f) => ({ ...f, usualActual: e.target.value }))}
                        className="w-full text-caption border border-line rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(it)}
                      disabled={updateItem.isPending}
                      className="px-3.5 py-1.5 bg-emerald-500 text-white text-caption font-medium rounded-lg active:scale-95 disabled:opacity-50 transition-transform"
                    >
                      저장
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-2.5 py-1.5 text-caption text-ink-soft border border-line rounded-lg active:bg-cream transition-colors">
                      취소
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="단골에서 뺄까요?"
          description={`"${deleteTarget.name}" — 기록은 그대로, 사전에서만 빠져요.`}
          confirmLabel="삭제"
          onConfirm={async () => {
            await removeItem.mutateAsync({ id: deleteTarget.id });
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
