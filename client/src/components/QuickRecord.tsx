// 1탭 기록 시트 — 사진 한 장으로 끝.
// 신규 촬영: 사진 → AI가 항목·금액 자동 채움 → '저장' 한 번. 또는 '나중에'(미완성 보관).
// 미완성 완성: draft를 받아 금액만 확인 후 저장.
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { addDraft, removeDraft, type Draft } from "@/lib/drafts";
import { won } from "@/lib/format";
import { toast } from "sonner";
import { X, Loader2, Trash2 } from "lucide-react";

const DEFAULT_CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"];

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("파일을 읽지 못했습니다"));
    r.readAsDataURL(file);
  });
}

const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "");

type Props = {
  file?: File | null;
  draft?: Draft | null;
  onClose: () => void;
  onSaved?: () => void;
};

export default function QuickRecord({ file, draft, onClose, onSaved }: Props) {
  const isCompleting = !!draft;

  const [phase, setPhase] = useState<"analyzing" | "ready" | "error">(
    isCompleting ? "ready" : "analyzing",
  );
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageUrl, setImageUrl] = useState(draft?.imageUrl ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [category, setCategory] = useState(draft?.category ?? "식비");
  const [original, setOriginal] = useState(draft?.originalAmount != null ? String(draft.originalAmount) : "");
  const [actual, setActual] = useState(draft?.actualAmount != null ? String(draft.actualAmount) : "");
  const [aiReason, setAiReason] = useState(draft?.aiReason ?? "");
  const [saving, setSaving] = useState(false);
  const date = draft?.date ?? todayStr();

  const { data: cats } = trpc.categories.list.useQuery(undefined);
  const categoryNames = useMemo(
    () => (cats && cats.length ? cats.map((c: { name: string }) => c.name) : DEFAULT_CATEGORIES),
    [cats],
  );

  const utils = trpc.useUtils();
  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadImage = trpc.ai.uploadImage.useMutation();
  const createEntry = trpc.savings.create.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });

  // body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 신규 촬영 → 미리보기 + AI 분석
  useEffect(() => {
    if (!file) return;
    const obj = URL.createObjectURL(file);
    setPreviewUrl(obj);
    let cancelled = false;
    (async () => {
      let base64 = "";
      try {
        base64 = await fileToBase64(file);
      } catch {
        if (!cancelled) setPhase("error");
        return;
      }
      try {
        const r = await analyzeImage.mutateAsync({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
        if (cancelled) return;
        setImageUrl(r.imageUrl);
        setTitle(r.title);
        setCategory(r.category);
        setOriginal(String(r.estimatedOriginalAmount));
        setActual(String(r.estimatedActualAmount));
        setAiReason(r.reason);
        setPhase("ready");
      } catch {
        // 분석 실패해도 사진은 저장해서 직접 입력/나중에가 가능하게
        try {
          const u = await uploadImage.mutateAsync({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
          if (!cancelled) setImageUrl(u.imageUrl);
        } catch {
          /* 사진 저장도 실패 — imageUrl 없이 진행 */
        }
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      URL.revokeObjectURL(obj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const o = parseInt(original || "0", 10) || 0;
  const a = parseInt(actual || "0", 10) || 0;
  const profit = o - a;

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
        originalAmount: o,
        actualAmount: a,
        aiEstimated: isCompleting ? "no" : "yes",
        aiReason: aiReason || undefined,
        imageUrl: imageUrl || undefined,
      });
      if (draft) removeDraft(draft.id);
      toast.success("기록됐어요");
      onSaved?.();
      onClose();
    } catch {
      toast.error("저장에 실패했어요. 다시 시도해주세요");
    } finally {
      setSaving(false);
    }
  }

  function handleDefer() {
    if (!imageUrl) return toast.error("사진을 아직 저장하지 못했어요. 잠시 후 다시 시도해주세요");
    addDraft({
      imageUrl,
      title: title.trim() || "제목 미정",
      category,
      originalAmount: original ? o : null,
      actualAmount: actual ? a : null,
      aiReason: aiReason || undefined,
      date,
    });
    toast.success("사진 저장됨 — 나중에 금액만 채우면 돼요");
    onClose();
  }

  const analyzing = phase === "analyzing";
  const shownImage = previewUrl || imageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      style={{ animation: "qrFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes qrUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes qrFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-7 max-h-[90vh] overflow-y-auto"
        style={{ animation: "qrUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 그랩바 + 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-8" />
          <span className="text-sm font-medium text-gray-700">
            {isCompleting ? "금액 채우기" : "한 끼 기록"}
          </span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* 사진 */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 mb-4">
          {shownImage ? (
            <img src={shownImage} alt="기록 사진" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">사진 없음</div>
          )}
          {analyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs text-gray-500">자르르가 가격을 살펴보는 중…</p>
            </div>
          )}
        </div>

        {/* 절약 수익 강조 */}
        <div className="text-center mb-4">
          <p className="text-[11px] text-gray-400 mb-0.5">이번 한 끼로 아낀 돈</p>
          <p
            className={`font-mono text-3xl font-bold tabular-nums ${
              profit >= 0 ? "text-emerald-500" : "text-red-400"
            }`}
          >
            {profit >= 0 ? "+" : "−"}
            {won(Math.abs(profit))}
          </p>
        </div>

        {/* 항목명 */}
        <label className="text-[11px] text-gray-400 block mb-1">항목명</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={analyzing ? "분석 중…" : "무엇을 먹었나요?"}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-emerald-400"
        />

        {/* 카테고리 칩 */}
        <label className="text-[11px] text-gray-400 block mb-1">카테고리</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categoryNames.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                category === c
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-500 active:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 원가 / 실제 지출 */}
        <div className="flex gap-2.5 mb-2">
          <div className="flex-1">
            <label className="text-[11px] text-gray-400 block mb-1">원가 (안 아꼈으면)</label>
            <div className="flex items-center border border-gray-200 rounded-xl px-3">
              <span className="text-gray-400 text-sm mr-1">₩</span>
              <input
                value={original ? Number(original).toLocaleString("ko-KR") : ""}
                onChange={(e) => setOriginal(onlyDigits(e.target.value))}
                inputMode="numeric"
                placeholder="0"
                className="w-full py-2.5 text-sm focus:outline-none tabular-nums"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-gray-400 block mb-1">실제 지출</label>
            <div className="flex items-center border border-gray-200 rounded-xl px-3">
              <span className="text-gray-400 text-sm mr-1">₩</span>
              <input
                value={actual ? Number(actual).toLocaleString("ko-KR") : ""}
                onChange={(e) => setActual(onlyDigits(e.target.value))}
                inputMode="numeric"
                placeholder="0"
                className="w-full py-2.5 text-sm focus:outline-none tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* AI 근거 */}
        {aiReason && !analyzing && (
          <p className="text-[11px] text-gray-400 leading-relaxed mb-3 bg-gray-50 rounded-xl px-3 py-2">
            <span className="text-emerald-500">자르르</span> {aiReason}
          </p>
        )}

        {/* 저장 */}
        <button
          onClick={handleSave}
          disabled={saving || analyzing}
          className="mt-2 w-full bg-emerald-500 text-white font-medium py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "저장"}
        </button>

        {/* 나중에 / 미완성 삭제 */}
        {isCompleting ? (
          <button
            onClick={() => {
              if (draft && confirm("이 미완성 기록을 삭제할까요?")) {
                removeDraft(draft.id);
                toast.success("삭제됐어요");
                onClose();
              }
            }}
            className="mt-3 w-full text-xs text-gray-400 flex items-center justify-center gap-1 py-1.5"
          >
            <Trash2 size={13} /> 이 미완성 삭제
          </button>
        ) : (
          <button
            onClick={handleDefer}
            disabled={analyzing && !imageUrl}
            className="mt-3 w-full text-sm text-gray-500 py-2 disabled:opacity-40"
          >
            나중에 금액 채우기
          </button>
        )}
      </div>
    </div>
  );
}
