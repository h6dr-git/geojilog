// 확인 전용 시트 — 분석은 이미 끝난 상태에서 '확인/수정 → 저장'만 한다. (스피너로 가두지 않음)
// data를 미리 채워서 받는다. draftId가 있으면 '미완성 완성', 없으면 '갓 분석된 결과 확인'.
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { addDraft, removeDraft } from "@/lib/drafts";
import { won } from "@/lib/format";
import { toast } from "sonner";
import { X, Loader2, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import IncomeSourceChips from "@/components/IncomeSourceChips";
import { FIXED_ACTUAL, reconcileSavingsSteps, fallbackSavingsSteps } from "@shared/incomeSources";
import { incomeSourceUsual, type SavingsEntry } from "@/lib/ledger";
import { celebrateSave } from "@/lib/celebrate";
import SavingsCombo from "@/components/SavingsCombo";
import type { Prefill } from "@/lib/capture";

const DEFAULT_CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"];
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "");

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Props = {
  data: Prefill;
  onClose: () => void;
  onSaved?: () => void;
};

export default function QuickRecord({ data, onClose, onSaved }: Props) {
  const isCompleting = !!data.draftId;

  const [title, setTitle] = useState(data.title ?? "");
  const [category, setCategory] = useState(data.category || "식비");
  const [incomeSource, setIncomeSource] = useState<string | null>(data.incomeSource ?? null);
  const [original, setOriginal] = useState(data.originalAmount != null ? String(data.originalAmount) : "");
  const [actual, setActual] = useState(data.actualAmount != null ? String(data.actualAmount) : "");
  const [memo, setMemo] = useState(data.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const aiReason = data.aiReason ?? "";
  const date = data.date ?? todayStr();

  const { data: cats } = trpc.categories.list.useQuery(undefined);
  const { data: allEntries = [] } = trpc.savings.list.useQuery(); // #60-b 내 평소가 (캐시 재사용)
  const categoryNames =
    cats && cats.length ? cats.map((c: { name: string }) => c.name) : DEFAULT_CATEGORIES;

  const utils = trpc.useUtils();
  const createEntry = trpc.savings.create.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });

  const o = parseInt(original || "0", 10) || 0;
  const a = parseInt(actual || "0", 10) || 0;
  const profit = o - a;
  // #50 — 표시/저장용 연쇄 단계: AI가 준 단계 우선, 없으면 수익원 기반 단일 폴백. 항상 (기준가-실지출)에 맞춤.
  const displaySteps = useMemo(
    () =>
      reconcileSavingsSteps(
        data.savingsSteps && data.savingsSteps.length ? data.savingsSteps : fallbackSavingsSteps(incomeSource ?? null, o, a),
        o,
        a
      ),
    [data.savingsSteps, incomeSource, o, a]
  );

  async function handleSave() {
    if (!title.trim()) return toast.error("항목명을 입력해주세요");
    if (o <= 0) return toast.error("원가를 입력해주세요");
    if (a < 0) return toast.error("실제 지출을 확인해주세요");
    setSaving(true);
    try {
      await createEntry.mutateAsync({
        date,
        title: title.trim(),
        category,
        incomeSource: incomeSource ?? undefined,
        originalAmount: o,
        actualAmount: a,
        aiEstimated: isCompleting ? "no" : "yes",
        aiReason: aiReason || undefined,
        imageUrl: data.imageUrl || undefined,
        imageSig: data.imageSig, // #48
        memo: memo.trim() || undefined,
        savingsSteps: displaySteps.length ? displaySteps : undefined,
      });
      if (data.draftId) removeDraft(data.draftId);
      const usual = incomeSource === data.incomeSource ? data.sourceUsualActual : undefined;
      const bonus = usual != null && a < usual ? usual - a : undefined;
      if (profit > 0) celebrateSave({ profit, title: title.trim(), bonus });
      else toast.success("기록됐어요");
      onSaved?.();
      onClose();
    } catch {
      toast.error("저장에 실패했어요. 다시 시도해주세요");
    } finally {
      setSaving(false);
    }
  }

  function handleDefer() {
    if (!data.imageUrl) return toast.error("사진이 없어 보관할 수 없어요");
    addDraft({
      imageUrl: data.imageUrl,
      title: title.trim() || "제목 미정",
      category,
      originalAmount: original ? o : null,
      actualAmount: actual ? a : null,
      aiReason: aiReason || undefined,
      memo: memo.trim() || undefined,
      incomeSource,
      date,
    });
    toast.success("사진 저장됨 — 나중에 금액만 채우면 돼요");
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      style={{ animation: "qrFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes qrUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes qrFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-7 max-h-[90vh] overflow-y-auto"
        style={{ animation: "qrUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-8" />
          <div className="text-center">
            <p className="text-body font-semibold text-ink">
              {isCompleting ? "금액 채우기" : "거래 확인"}
            </p>
            <p className="voice-label mt-0.5">회시생 · 계상 전</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {/* 사진 */}
        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-line mb-4">
          {data.imageUrl ? (
            <img src={data.imageUrl} alt="기록 사진" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-faint text-body">사진 없음</div>
          )}
        </div>

        {/* #50 — 연쇄 절약 연출: 기준가 → 단계 할인 → 번 돈 */}
        <div className="mb-4">
          {profit >= 0 ? (
            <SavingsCombo originalAmount={o} steps={displaySteps} />
          ) : (
            <div className="text-center mb-2">
              <p className="text-micro text-ink-soft mb-0.5">이번 지출</p>
              <p className="font-mono text-hero font-bold tabular-nums text-red-400">−{won(Math.abs(profit))}</p>
            </div>
          )}
          <p className="text-micro text-ink-faint text-center font-mono">{date.replace(/-/g, ".")} 기록</p>
        </div>

        {/* 항목명 */}
        <label className="text-micro text-ink-soft block mb-1">항목명</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무엇을 먹었나요?"
          className="input-field mb-3"
        />

        {/* 카테고리 */}
        <label className="text-micro text-ink-soft block mb-1">카테고리</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categoryNames.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-caption transition-colors ${
                category === c ? "bg-emerald-500 text-white" : "bg-cream text-ink-soft active:bg-line"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 수익원 — 어떻게 번 돈인지 (AI가 짚고, 한 탭에 수정) */}
        <label className="text-micro text-ink-soft block mb-1">수익원</label>
        <div className="mb-2">
          <IncomeSourceChips
            value={incomeSource}
            onChange={(v) => {
              setIncomeSource(v);
              // #47 — 실지출이 사실상 고정인 유형은 자동 채움 (수정 가능). 새 기록 확정 플로우에만.
              if (v != null && FIXED_ACTUAL[v] !== undefined) setActual(String(FIXED_ACTUAL[v]));
            }}
          />
        </div>

        {/* #60-b — 기록의 복리 체감: 이 유형의 '내 평소가' (표본 2건부터, 칩 바꾸면 즉시 갱신) */}
        {(() => {
          const u = incomeSourceUsual(allEntries as SavingsEntry[], incomeSource);
          return u ? (
            <p className="text-micro text-ink-faint mb-3">
              사장님의 {incomeSource} 평소 실지출 — <span className="font-mono text-gold">₩{u.usualActual.toLocaleString("ko-KR")}</span> (최근 {u.sample}건 중앙값)
            </p>
          ) : <span className="block mb-1" />;
        })()}

        {/* 원가 / 실제 지출 */}
        <div className="flex gap-2.5 mb-2">
          <div className="flex-1">
            <label className="text-micro text-ink-soft block mb-1">원가 (원래 냈을 값)</label>
            <div className="flex items-center border border-line rounded-card px-3">
              <span className="text-ink-soft text-body mr-1">₩</span>
              <input
                value={original ? Number(original).toLocaleString("ko-KR") : ""}
                onChange={(e) => setOriginal(onlyDigits(e.target.value))}
                inputMode="numeric"
                placeholder="0"
                className="w-full py-2.5 text-body focus:outline-none tabular-nums"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="text-micro text-ink-soft block mb-1">실제 지출</label>
            <div className="flex items-center border border-line rounded-card px-3">
              <span className="text-ink-soft text-body mr-1">₩</span>
              <input
                value={actual ? Number(actual).toLocaleString("ko-KR") : ""}
                onChange={(e) => setActual(onlyDigits(e.target.value))}
                inputMode="numeric"
                placeholder="0"
                className="w-full py-2.5 text-body focus:outline-none tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* P2 — 지난 확정가 적용 안내 */}
        {data.priorOriginalAmount != null && (
          <p className="text-micro text-ink-faint mb-3 -mt-0.5">
            원가는 지난번 확정가 {won(data.priorOriginalAmount)} 기준
            {data.priorDate ? ` (${data.priorDate.slice(5).replace("-", ".")})` : ""}
            {data.aiOriginalAmount != null && data.aiOriginalAmount !== data.priorOriginalAmount
              ? ` · AI 추정은 ${won(data.aiOriginalAmount)}`
              : ""}
          </p>
        )}

        {/* 내 썰(메모) — 컨펌 단계에서 바로 적게 (편집까지 안 가도 됨) */}
        <label className="text-micro text-ink-soft block mb-1">내 썰 한 줄 (선택)</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="나만 보는 한 줄 일기"
          className="input-field mb-3"
        />

        {/* AI 근거 */}
        {aiReason && (
          <p className="text-micro text-ink-soft leading-relaxed mb-3 bg-cream rounded-card px-3 py-2">
            <span className="text-emerald-500">회시생</span> {aiReason}
          </p>
        )}

        {/* 저장 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 w-full btn-primary py-3.5 rounded-2xl disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : profit > 0 ? `+₩${profit.toLocaleString("ko-KR")} 계상하기` : "장부에 기록"}
        </button>

        {/* 나중에 / 미완성 삭제 */}
        {isCompleting ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-3 w-full text-caption text-ink-soft flex items-center justify-center gap-1 py-1.5"
          >
            <Trash2 size={13} /> 이 미완성 삭제
          </button>
        ) : (
          <button onClick={handleDefer} className="mt-3 w-full text-body text-ink-soft py-2">
            나중에 금액 채우기
          </button>
        )}
      </div>

      {/* 미완성 삭제 확인 — window.confirm 대체 */}
      {confirmDelete && (
        <ConfirmDialog
          title="미완성 기록을 삭제할까요?"
          description="보관 중인 사진과 입력값이 사라져요."
          confirmLabel="삭제"
          onConfirm={() => {
            if (data.draftId) removeDraft(data.draftId);
            toast.success("삭제됐어요");
            setConfirmDelete(false);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
