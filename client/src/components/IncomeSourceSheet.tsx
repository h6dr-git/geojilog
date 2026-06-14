// 수익원 시트 (#37+#38, 커스텀 #47) — 유형별 통계(건수·누적 수익·평소가) + 미분류 정리
// + 커스텀 유형 추가·이름변경·삭제 + 탭하면 장부 필터. '기록 관리 툴'의 본체.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Loader2, Wand2, Plus, Pencil, Trash2, Check } from "lucide-react";
import { INCOME_SOURCES, UNCLASSIFIED, CUSTOM_SOURCE_NAME_MAX } from "@shared/incomeSources";
import { SavingsEntry, fmt, incomeSourceUsual } from "@/lib/ledger";
import ConfirmDialog from "@/components/ConfirmDialog";

export const UNCLASSIFIED_KEY = "__unclassified__";

type CustomSource = { id: number; name: string };

export default function IncomeSourceSheet({
  entries,
  onClose,
  onPick,
}: {
  entries: SavingsEntry[];
  onClose: () => void;
  /** 유형 탭 → 장부를 그 유형으로 필터 (미분류는 UNCLASSIFIED_KEY) */
  onPick: (key: string) => void;
}) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.incomeSources.list.invalidate();
    utils.savings.list.invalidate(); // 이름변경·삭제는 기록까지 바꾼다
  };
  const { data: custom = [] } = trpc.incomeSources.list.useQuery();
  const createSource = trpc.incomeSources.create.useMutation({
    onSuccess: () => { invalidate(); setNewName(""); setAdding(false); },
    onError: (e) => toast.error(e.message || "추가에 실패했어요"),
  });
  const renameSource = trpc.incomeSources.rename.useMutation({
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("이름을 바꿨어요 — 기존 기록도 함께 바뀌었어요"); },
    onError: (e) => toast.error(e.message || "변경에 실패했어요"),
  });
  const removeSource = trpc.incomeSources.remove.useMutation({
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast.success(`삭제됐어요 — 그 유형이던 기록은 ${UNCLASSIFIED}로 돌아갔어요`); },
    onError: (e) => toast.error(e.message || "삭제에 실패했어요"),
  });
  const reclassify = trpc.savings.reclassifySources.useMutation({
    onSuccess: (r) => {
      utils.savings.list.invalidate();
      if (r.classified > 0) toast.success(`${r.classified}건을 분류했어요${r.remaining > 0 ? ` — ${r.remaining}건은 직접 지정해 주세요` : ""}`);
      else toast.info("자동으로 알아볼 단서가 없었어요 — 기록을 열어 직접 지정해 주세요");
    },
    onError: () => toast.error("정리에 실패했어요"),
  });

  // 커스텀 관리 상태
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CustomSource | null>(null);

  const statFor = (name: string) => {
    const pool = entries.filter((e) => e.incomeSource === name);
    return {
      count: pool.length,
      profit: pool.reduce((s, e) => s + e.profit, 0),
      usual: incomeSourceUsual(entries, name)?.usualActual ?? null,
    };
  };
  const unclassified = entries.filter((e) => !e.incomeSource);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      style={{ animation: "isFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes isUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes isFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain"
        style={{ animation: "isUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">수익원</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>
        <p className="text-micro text-ink-faint text-center mb-4">
          어떻게 번 돈인지의 분류 · 평소가는 유형별 최근 실지출의 중앙값이에요
        </p>

        {/* 미분류 정리 — 있을 때만 */}
        {unclassified.length > 0 && (
          <div className="flex items-center gap-2.5 mb-3 px-3.5 py-3 rounded-card border border-gold/30 bg-gold/5">
            <button onClick={() => onPick(UNCLASSIFIED_KEY)} className="flex-1 min-w-0 text-left">
              <p className="text-body font-medium text-ink">{UNCLASSIFIED} {unclassified.length}건</p>
              <p className="text-micro text-ink-soft">탭하면 장부에서 모아 볼 수 있어요</p>
            </button>
            <button
              onClick={() => reclassify.mutate()}
              disabled={reclassify.isPending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gold text-white text-caption font-medium active:scale-95 disabled:opacity-50 transition-transform shrink-0"
            >
              {reclassify.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              자동 분류
            </button>
          </div>
        )}

        {/* 기본 9종 */}
        <div className="space-y-1">
          {INCOME_SOURCES.map((src) => {
            const s = statFor(src);
            return (
              <button
                key={src}
                onClick={() => s.count > 0 && onPick(src)}
                disabled={s.count === 0}
                className={`w-full flex items-center gap-2 border border-line rounded-card px-3.5 py-3 text-left transition-colors ${
                  s.count === 0 ? "opacity-40" : "active:bg-cream"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-ink truncate">{src}</p>
                  <p className="text-micro text-ink-soft">
                    {s.count}건{s.usual != null ? ` · 평소 ₩${fmt(s.usual)}` : ""}
                  </p>
                </div>
                <p className="text-caption font-mono font-semibold text-emerald-600 tabular-nums shrink-0">
                  {s.count > 0 ? `+₩${fmt(s.profit)}` : "—"}
                </p>
              </button>
            );
          })}
        </div>

        {/* 내가 만든 유형 (#47) */}
        <div className="flex items-center justify-between mt-5 mb-2">
          <p className="text-caption font-mono text-ink-soft tracking-widest uppercase">내가 만든 유형</p>
          {!adding && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-caption text-emerald-600 font-medium active:opacity-70">
              <Plus size={13} /> 추가
            </button>
          )}
        </div>

        {adding && (
          <div className="flex items-center gap-2 mb-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={CUSTOM_SOURCE_NAME_MAX}
              placeholder={`예: 중고거래 (${CUSTOM_SOURCE_NAME_MAX}자 이내)`}
              className="flex-1 text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400"
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createSource.mutate({ name: newName }); }}
            />
            <button
              onClick={() => newName.trim() && createSource.mutate({ name: newName })}
              disabled={createSource.isPending || !newName.trim()}
              className="px-3.5 py-2 bg-emerald-500 text-white text-caption font-medium rounded-lg active:scale-95 disabled:opacity-50 transition-transform"
            >
              {createSource.isPending ? <Loader2 size={13} className="animate-spin" /> : "추가"}
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="px-2.5 py-2 text-caption text-ink-soft border border-line rounded-lg active:bg-cream">
              취소
            </button>
          </div>
        )}

        {(custom as CustomSource[]).length === 0 && !adding ? (
          <p className="text-micro text-ink-faint text-center py-3">
            기본 유형에 없는 수익원이 있으면 직접 추가해 보세요
          </p>
        ) : (
          <div className="space-y-1">
            {(custom as CustomSource[]).map((c) => {
              const s = statFor(c.name);
              const editing = editingId === c.id;
              return (
                <div key={c.id} className="flex items-center gap-2 border border-line rounded-card px-3.5 py-3">
                  {editing ? (
                    <>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={CUSTOM_SOURCE_NAME_MAX}
                        className="flex-1 min-w-0 text-body border border-line rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-400"
                        onKeyDown={(e) => { if (e.key === "Enter" && editName.trim()) renameSource.mutate({ id: c.id, name: editName }); }}
                      />
                      <button
                        onClick={() => editName.trim() && renameSource.mutate({ id: c.id, name: editName })}
                        disabled={renameSource.isPending}
                        aria-label="저장"
                        className="p-1.5 text-emerald-600 active:scale-90 transition-transform shrink-0"
                      >
                        {renameSource.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      <button onClick={() => setEditingId(null)} aria-label="취소" className="p-1.5 text-ink-faint shrink-0">
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => s.count > 0 && onPick(c.name)} disabled={s.count === 0} className={`flex-1 min-w-0 text-left ${s.count === 0 ? "opacity-50" : ""}`}>
                        <p className="text-body font-medium text-ink truncate">{c.name}</p>
                        <p className="text-micro text-ink-soft">
                          {s.count}건{s.usual != null ? ` · 평소 ₩${fmt(s.usual)}` : ""}
                        </p>
                      </button>
                      <p className="text-caption font-mono font-semibold text-emerald-600 tabular-nums shrink-0">
                        {s.count > 0 ? `+₩${fmt(s.profit)}` : "—"}
                      </p>
                      <button
                        onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                        aria-label="이름 변경"
                        className="p-1.5 text-ink-faint active:text-ink-soft shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} aria-label="삭제" className="p-1.5 text-ink-faint active:text-red-400 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="이 유형을 삭제할까요?"
          description={`"${deleteTarget.name}" — 이 유형이던 기록은 ${UNCLASSIFIED}로 돌아가요 (기록 자체는 그대로).`}
          confirmLabel="삭제"
          onConfirm={() => removeSource.mutate({ id: deleteTarget.id })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
