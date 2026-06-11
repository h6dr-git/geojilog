// 기록 상세 시트 — 행을 탭하면 열린다. 보기·수정·삭제·사진 관리를 한 곳에서.
// 장부 = 원본 관리소: 이 시트가 기록 한 건의 완전한 관리 지점이다. (#24: 사진 나중에 붙이기/교체 포함)
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Pencil, Trash2, Loader2, Maximize2, ImagePlus } from "lucide-react";
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
  // #37 — 단골 사전의 '평소가'로 세 층 가격(시중가→평소가→오늘가) 표시
  const { data: dictItems = [] } = trpc.items.list.useQuery();
  const dictHit = (dictItems as { name: string; usualActual: number }[]).find(
    (it) => it.name.trim().toLowerCase() === entry.title.trim().toLowerCase()
  );
  const usual = dictHit?.usualActual;
  // 평소가가 오늘가와 시중가 사이에 있을 때만 세 층이 의미 있다
  const threeLayer = usual != null && entry.actualAmount < usual && usual < entry.originalAmount;
  const updateEntry = trpc.savings.update.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const deleteEntry = trpc.savings.delete.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const uploadImage = trpc.ai.uploadImage.useMutation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // #24 — 사진 나중에 붙이기/교체 (AI 분석 없이 업로드만)
  const handlePhotoPick = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingPhoto(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("읽기 실패"));
        r.readAsDataURL(file);
      });
      const up = await uploadImage.mutateAsync({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
      await updateEntry.mutateAsync({ id: entry.id, imageUrl: up.imageUrl });
      setImgOverride(up.imageUrl); // 시트를 닫지 않고 바로 보여준다
      toast.success(imageUrl ? "사진을 교체했습니다" : "사진을 붙였습니다");
    } catch (e) {
      toast.error(`사진 업로드 실패: ${(e as Error)?.message ?? "알 수 없는 오류"}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false); // 사진 탭 = 사진 확대 (관습 그대로 — #20 철회 반영)
  const [imgOverride, setImgOverride] = useState<string | null>(null); // 사진 교체 직후 즉시 반영용
  const imageUrl = imgOverride ?? entry.imageUrl;
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
        {/* 사진 선택 입력 — 반드시 전파 차단 영역(시트 내부)에 둘 것.
            오버레이 직속에 두면 프로그램적 click()이 버블링돼 onClose가 시트를 언마운트시켜
            사진을 골라도 받을 input이 사라진다 (#24 버그의 원인) */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { handlePhotoPick(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />

        <div className="flex items-center justify-between mb-3">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">{editing ? "기록 수정" : "기록 상세"}</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {/* 사진 — 탭하면 '사진이' 커진다 (확대 아이콘은 확대를 해야 함 — #20 철회 반영).
            공유 카드 진입은 '카드 스킨 프로젝트'에서 별도 재설계 예정 */}
        {imageUrl && !editing && (
          <button
            onClick={() => setShowPhoto(true)}
            className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-line mb-4 active:opacity-90 transition-opacity"
          >
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
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

            {/* 금액 — #37: 평소보다 더 아낀 날은 세 층(시중가→평소가→오늘가)으로 */}
            <div className="mt-3 bg-emerald-50 rounded-card px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-caption text-ink-soft tabular-nums">
                  <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                  <span className="mx-1.5 text-ink-faint">→</span>
                  {threeLayer && (
                    <>
                      <span className="line-through text-gold/80">₩{fmt(usual!)}</span>
                      <span className="mx-1.5 text-ink-faint">→</span>
                    </>
                  )}
                  <span>₩{fmt(entry.actualAmount)}</span>
                </span>
                <span className="font-mono text-title font-bold text-emerald-600 tabular-nums">+₩{fmt(entry.profit)}</span>
              </div>
              {threeLayer && (
                <p className="text-micro mt-1.5" style={{ color: "#B07F1E" }}>
                  ✨ 평소(₩{fmt(usual!)})보다 ₩{fmt(usual! - entry.actualAmount)} 더 아낀 날
                </p>
              )}
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
            {/* #24 — 사진 교체/추가 */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-caption text-ink-soft border border-line rounded-lg active:border-emerald-300 active:text-emerald-600 disabled:opacity-50 transition-colors"
            >
              {uploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {imageUrl ? "사진 교체" : "사진 붙이기"}
            </button>
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
      {showPhoto && imageUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.96)", animation: "edFade .2s ease" }}
          onClick={(e) => { e.stopPropagation(); setShowPhoto(false); }}
        >
          <img src={imageUrl} alt="" className="w-full max-h-[82vh] object-contain rounded-xl" />
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
