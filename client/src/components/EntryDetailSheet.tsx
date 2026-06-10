// 기록 상세 시트 — 행을 탭하면 열린다. 보기·수정·삭제·공유를 한 곳에서(리스트 행의 상시 아이콘 3개 대체).
// 장부 개편(2026-06-10): "기록 리스트가 이상하다" 진단의 처방 — 행은 깔끔하게, 액션은 상세로.
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Pencil, Trash2, Loader2, Maximize2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SavingsEntry, fmt } from "@/lib/ledger";

export default function EntryDetailSheet({
  entry,
  categoryNames,
  onClose,
}: {
  entry: SavingsEntry;
  categoryNames: string[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const updateEntry = trpc.savings.update.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const deleteEntry = trpc.savings.delete.useMutation({ onSuccess: () => utils.savings.list.invalidate() });

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false); // 사진 탭 = 사진 확대 (관습 그대로 — #20 철회 반영)
  const [form, setForm] = useState({
    date: entry.date,
    title: entry.title,
    category: entry.category,
    originalAmount: String(entry.originalAmount),
    actualAmount: String(entry.actualAmount),
    memo: entry.memo ?? "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        date: form.date,
        title: form.title,
        category: form.category,
        originalAmount: Number(form.originalAmount),
        actualAmount: Number(form.actualAmount),
        memo: form.memo || null,
      });
      toast.success("수정됐습니다");
      setEditing(false);
      onClose();
    } catch {
      toast.error("수정에 실패했습니다");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry.mutateAsync({ id: entry.id });
      toast.success("삭제됐습니다");
      setConfirmDelete(false);
      onClose();
    } catch {
      toast.error("삭제에 실패했습니다");
    }
  };

  const inputCls = "w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      style={{ animation: "edFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes edUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes edFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[90vh] overflow-y-auto overscroll-contain"
        style={{ animation: "edUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">{editing ? "기록 수정" : "기록 상세"}</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {/* 사진 — 탭하면 '사진이' 커진다 (확대 아이콘은 확대를 해야 함 — #20 철회 반영).
            공유 카드 진입은 '카드 스킨 프로젝트'에서 별도 재설계 예정 */}
        {entry.imageUrl && !editing && (
          <button
            onClick={() => setShowPhoto(true)}
            className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-line mb-4 active:opacity-90 transition-opacity"
          >
            <img src={entry.imageUrl} alt="" className="w-full h-full object-cover" />
            <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
              <Maximize2 size={13} className="text-white" />
            </span>
          </button>
        )}

        {!editing ? (
          <>
            {/* 메타: 날짜 · 카테고리 (티커는 의미 전달 0 판정으로 표시 제거 — 데이터는 보존) */}
            <div className="flex items-center gap-2 text-caption text-ink-soft mb-1.5">
              <span className="font-mono">{entry.date.replace(/-/g, ".")}</span>
              <span className="px-2 py-0.5 rounded-full bg-cream">{entry.category}</span>
            </div>

            <p className="text-title font-semibold text-ink">{entry.title}</p>

            {/* 금액 */}
            <div className="flex items-baseline justify-between mt-3 bg-emerald-50 rounded-card px-4 py-3">
              <span className="text-caption text-ink-soft tabular-nums">
                <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                <span className="mx-1.5 text-ink-faint">→</span>
                <span>₩{fmt(entry.actualAmount)}</span>
              </span>
              <span className="font-mono text-title font-bold text-emerald-600 tabular-nums">+₩{fmt(entry.profit)}</span>
            </div>

            {/* 메모 · AI 근거 */}
            {entry.memo && <p className="text-body text-ink/80 italic leading-relaxed mt-3">“{entry.memo}”</p>}
            {entry.aiReason && (
              <p className="text-micro text-ink-faint leading-relaxed mt-2 bg-cream rounded-card px-3 py-2">{entry.aiReason}</p>
            )}

            {/* 액션 — '공유' 버튼 없음(짜침 방지): 카드는 사진 탭으로 자발적 발견 */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-body border border-line rounded-xl active:bg-cream transition-colors"
              >
                <Pencil size={15} className="text-ink-soft" /> 수정
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="삭제"
                className="px-4 py-3 text-body border border-line rounded-xl text-red-400 active:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </>
        ) : (
          /* 수정 폼 */
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-soft mb-1 block">날짜</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-caption text-ink-soft mb-1 block">카테고리</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                  {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-caption text-ink-soft mb-1 block">항목명</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-soft mb-1 block">원가 (원)</label>
                <input type="number" value={form.originalAmount} onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-caption text-ink-soft mb-1 block">실제 지출 (원)</label>
                <input type="number" value={form.actualAmount} onChange={(e) => setForm((f) => ({ ...f, actualAmount: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-caption text-ink-soft mb-1 block">내 썰 한 줄 (선택)</label>
              <input value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} placeholder="나만 보는 한 줄 일기" className={inputCls} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={updateEntry.isPending}
                className="flex-1 py-3 bg-emerald-500 text-white text-body font-medium rounded-xl active:scale-[0.98] disabled:opacity-50 transition-transform"
              >
                {updateEntry.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "저장"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-5 py-3 text-body text-ink-soft border border-line rounded-xl active:bg-cream transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 사진 확대 뷰어 — 탭하면 닫힘 */}
      {showPhoto && entry.imageUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.96)", animation: "edFade .2s ease" }}
          onClick={(e) => { e.stopPropagation(); setShowPhoto(false); }}
        >
          <img src={entry.imageUrl} alt="" className="w-full max-h-[82vh] object-contain rounded-xl" />
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="기록을 삭제할까요?"
          description={`"${entry.title}" 기록이 장부에서 사라져요.`}
          confirmLabel="삭제"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
