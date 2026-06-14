// 기록 상세 시트 — 행을 탭하면 열린다. 보기·수정·삭제·사진 관리를 한 곳에서.
// 장부 = 원본 관리소: 이 시트가 기록 한 건의 완전한 관리 지점이다. (#24: 사진 나중에 붙이기/교체 포함)
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Pencil, Trash2, Loader2, Maximize2, ImagePlus } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SavingsEntry, fmt, incomeSourceUsual } from "@/lib/ledger";
import IncomeSourceChips from "@/components/IncomeSourceChips";
import SavingsCombo from "@/components/SavingsCombo";
import ProfitKindChips, { ProfitKindBadge } from "@/components/ProfitKindChips";
import { UNCLASSIFIED, fallbackSavingsSteps, type SavingsStep } from "@shared/incomeSources";
import { LEDGER_LABELS } from "@shared/ledgerLabels";
import { inferProfitKind, type ProfitKind } from "@shared/profitKinds";

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
  // #37+#38 — 평소가 = 이 기록 수익원의 최근 실지출 중앙값 (자기 자신 제외).
  // 장부가 이미 불러온 savings.list 캐시를 그대로 쓴다 (추가 네트워크 없음).
  const { data: allEntries = [] } = trpc.savings.list.useQuery();
  const sourceUsual = incomeSourceUsual(allEntries as SavingsEntry[], entry.incomeSource, entry.id);
  const usual = sourceUsual?.usualActual;
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
  // #50 — 저장된 연쇄 단계(JSON) → 없으면 수익원 기반 단일 폴백
  const savedSteps: SavingsStep[] = (() => {
    const raw = (entry as { savingsSteps?: string | null }).savingsSteps;
    if (typeof raw === "string" && raw.trim()) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed as SavingsStep[]; } catch { /* 무시 */ }
    }
    return fallbackSavingsSteps(entry.incomeSource ?? null, entry.originalAmount, entry.actualAmount);
  })();
  const [form, setForm] = useState({
    date: entry.date,
    title: entry.title,
    category: entry.category,
    incomeSource: (entry.incomeSource ?? null) as string | null,
    profitKind: (entry.profitKind ?? inferProfitKind(entry.incomeSource, entry.originalAmount, entry.actualAmount)) as ProfitKind,
    originalAmount: String(entry.originalAmount),
    actualAmount: String(entry.actualAmount),
    memo: entry.memo ?? "",
    userPriceNote: entry.userPriceNote ?? "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        date: form.date,
        title: form.title,
        category: form.category,
        incomeSource: form.incomeSource as never,
        profitKind: form.profitKind,
        originalAmount: Number(form.originalAmount),
        actualAmount: Number(form.actualAmount),
        memo: form.memo || null,
        userPriceNote: form.userPriceNote.trim() || null,
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
      toast.success("삭제됐습니다", { id: "entry-delete" });
      setConfirmDelete(false);
      onClose();
    } catch {
      toast.error("삭제에 실패했습니다");
      throw new Error("delete failed");
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
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8 max-h-[90vh] overflow-y-auto overscroll-contain"
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
              <span className={`px-2 py-0.5 rounded-full ${entry.incomeSource ? "bg-gold/10 text-gold" : "bg-cream text-ink-faint"}`}>
                {entry.incomeSource ?? UNCLASSIFIED}
              </span>
              <ProfitKindBadge kind={entry.profitKind} />
            </div>

            <p className="text-title font-semibold text-ink">{entry.title}</p>

            {/* #50 — 순차 절약: 시중 기준가에서 단계별로 깎여 번 돈에 도달 */}
            <div className="mt-3 surface-paper texture-paper px-4 pt-3.5 pb-3">
              <SavingsCombo originalAmount={entry.originalAmount} steps={savedSteps} animate />
              {threeLayer && (
                <p className="text-micro text-center -mt-2.5" style={{ color: "#B07F1E" }}>
                  ✨ 평소 {entry.incomeSource}(₩{fmt(usual!)}) 대비 +₩{fmt(usual! - entry.actualAmount)} 초과 수익
                </p>
              )}
              {!threeLayer && usual != null && (
                <p className="text-micro text-center -mt-2.5 text-ink-faint">
                  이 유형 평소 시장에 보낸 돈 ₩{fmt(usual)} (최근 {sourceUsual!.sample}건 중앙값)
                </p>
              )}
            </div>

            {/* 메모 · AI 근거 */}
            {entry.memo && <p className="text-body text-ink/80 italic leading-relaxed mt-3">“{entry.memo}”</p>}
            {entry.aiReason && (
              <div className="mt-2 surface-paper px-3 py-2.5">
                <p className="text-micro text-ink-soft leading-relaxed">
                  <span className="text-emerald-600 font-medium">회시생 추정</span> — {entry.aiReason}
                </p>
                {entry.userPriceNote && (
                  <p className="text-micro text-ink mt-2 pt-2 border-t border-line leading-relaxed">
                    <span className="text-gold font-medium">사장님</span> — {entry.userPriceNote}
                  </p>
                )}
              </div>
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
            <div>
              <label className="text-caption text-ink-soft mb-1 block">수익 유형</label>
              <ProfitKindChips
                value={form.profitKind}
                onChange={(k) => setForm((f) => ({ ...f, profitKind: k, ...(k === "earn" ? { actualAmount: "0" } : {}) }))}
              />
            </div>
            <div>
              <label className="text-caption text-ink-soft mb-1 block">수익원 — 같은 칩을 다시 누르면 미분류</label>
              <IncomeSourceChips
                value={form.incomeSource}
                onChange={(v) => setForm((f) => ({
                  ...f,
                  incomeSource: v,
                  profitKind: inferProfitKind(v, Number(f.originalAmount) || 0, Number(f.actualAmount) || 0),
                }))}
                allowNone
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-soft mb-1 block">
                  {form.profitKind === "earn" ? LEDGER_LABELS.earnAmount : LEDGER_LABELS.original}
                </label>
                <input type="number" value={form.originalAmount} onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))} className={inputCls} />
              </div>
              {form.profitKind !== "earn" && (
                <div>
                  <label className="text-caption text-ink-soft mb-1 block">{LEDGER_LABELS.actual}</label>
                  <input type="number" value={form.actualAmount} onChange={(e) => setForm((f) => ({ ...f, actualAmount: e.target.value }))} className={inputCls} />
                </div>
              )}
            </div>
            {entry.aiEstimated === "yes" && (
              <div>
                <label className="text-caption text-ink-soft mb-1 block">추정에 대한 코멘트 (선택)</label>
                <textarea
                  value={form.userPriceNote}
                  onChange={(e) => setForm((f) => ({ ...f, userPriceNote: e.target.value }))}
                  maxLength={500}
                  rows={2}
                  placeholder="회시생 추정에 대한 반박·보정 의견"
                  className={`${inputCls} resize-none`}
                />
              </div>
            )}
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
                className="flex-1 py-3 btn-primary rounded-xl disabled:opacity-50"
              >
                {updateEntry.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "수정 반영"}
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
