// 거지로그 — 장부(Ledger) 화면: 기록 리스트·미니 캘린더·입력/수정·내보내기. (탭바 "장부")
// ============================================================

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";
import { smartCropToSquare } from "@/lib/smartCrop";
import {
  Upload, Camera, PenLine, Loader2, Download,
  Copy, Trash2, ChevronDown, ChevronUp, Check,
  Pencil, X, Share2, RotateCw,
} from "lucide-react";
import SavingsStoryCard from "@/components/SavingsStoryCard";
import MiniCalendar from "@/components/MiniCalendar";
import Jarureu from "@/components/Jarureu";
import { SavingsEntry, ExportRange, fmt, todayStr, makeDefaultTitle, filterByRange, toMarkdownTable, toCsv } from "@/lib/ledger";

// 파일 시그니처(이름|크기|수정시각) — 같은 사진 중복 업로드 감지용
const fileSig = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

// 업로드 큐 아이템 — submitting 필드 추가 (버그 #1 수정)
interface QueueItem {
  id: string;
  file: File; // [작업1-a] 원본 File 보관 → 분석 실패 시 재시도(재분석) 가능
  previewUrl: string;
  fileName: string;
  sig: string;           // 파일 시그니처 — 중복 감지용
  dup?: boolean;         // 같은 배치/큐 내 중복 의심 (향후 저장기록 지문 대조로 확장)
  status: "analyzing" | "ready" | "error";
  submitting: boolean; // 개별 등록 로딩 상태
  title: string;
  category: string;
  originalAmount: string;
  actualAmount: string;
  aiReason: string;
  date: string;
  memo: string;
  imageUrl?: string;
  // 데이터 해자: AI 추정 원본값 보관(사용자가 폼에서 원가/실제를 고쳐도 유지 → create 시 함께 전송)
  aiOriginalAmount?: number;
  aiActualAmount?: number;
}

type MainTab = "input" | "calendar";

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function Ledger() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: isAuthenticated });

  const createEntry = trpc.savings.create.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const updateEntry = trpc.savings.update.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const deleteEntry = trpc.savings.delete.useMutation({ onSuccess: () => utils.savings.list.invalidate() });
  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadCroppedImage = trpc.ai.uploadImage.useMutation();

  const categoryNames = useMemo(
    () => (categories.length > 0 ? categories.map((c: { name: string }) => c.name) : ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"]),
    [categories]
  );


  // ── 탭 ──
  const [mainTab, setMainTab] = useState<MainTab>("calendar");

  // ── 업로드 큐 ──
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // ── 수동 입력 — userEdited 플래그로 자동 제목 덮어쓰기 방지 ──
  const [showManual, setShowManual] = useState(false);
  const [manualTitleEdited, setManualTitleEdited] = useState(false);
  const [manualForm, setManualForm] = useState(() => {
    const d = todayStr();
    return {
      date: d, title: makeDefaultTitle(d, "식비"), category: "식비",
      originalAmount: "", actualAmount: "", description: "", memo: "",
    };
  });

  // ── 인라인 수정 ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string; category: string; originalAmount: string;
    actualAmount: string; memo: string; date: string;
  } | null>(null);

  // ── 스토리 공유 ──
  const [storyEntry, setStoryEntry] = useState<SavingsEntry | null>(null);

  // ── Export ──
  const [showExport, setShowExport] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [copied, setCopied] = useState(false);

  // ── AI 이미지 처리 ──
  const processFile = useCallback(async (file: File, itemId: string) => {
    const exifDate = await getExifDate(file);
    const date = exifDate ?? todayStr();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const r = (e.target?.result as string).split(",")[1];
        if (r) resolve(r); else reject(new Error("읽기 실패"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const result = await analyzeImage.mutateAsync({ imageBase64: base64, mimeType: file.type });

    let finalImageUrl = result.imageUrl;
    try {
      const croppedBlob = await smartCropToSquare(file, result.cropBox ?? { x: 0.5, y: 0.5 });
      const croppedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const r = (e.target?.result as string).split(",")[1];
          if (r) resolve(r); else reject();
        };
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });
      const cropResult = await uploadCroppedImage.mutateAsync({ imageBase64: croppedBase64, mimeType: "image/jpeg" });
      finalImageUrl = cropResult.imageUrl;
    } catch { /* 크롭 실패 시 원본 유지 */ }

    // 버그 #4: AI 카테고리 기반 자동 제목 생성
    const autoTitle = makeDefaultTitle(date, result.category);

    setQueue(prev => prev.map(it => it.id === itemId ? {
      ...it,
      status: "ready" as const,
      title: autoTitle,
      category: result.category,
      originalAmount: String(result.estimatedOriginalAmount),
      actualAmount: String(result.estimatedActualAmount),
      aiReason: result.reason,
      date,
      imageUrl: finalImageUrl,
      // 데이터 해자: 사용자 확정값과 비교할 AI 추정 원본 보관
      aiOriginalAmount: result.estimatedOriginalAmount,
      aiActualAmount: result.estimatedActualAmount,
    } : it));
  }, [analyzeImage, uploadCroppedImage]);

  // 카메라 진입점 — 지금은 기기 카메라. 향후 앱 톤에 맞춘 자체 카메라로 교체할 단일 훅.
  const openCamera = useCallback(() => cameraRef.current?.click(), []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) return;

    const newItems: QueueItem[] = arr.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, // [작업1-a] 원본 File 보관 → 재시도 가능
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      sig: fileSig(file),
      status: "analyzing" as const,
      submitting: false,
      title: "", category: categoryNames[0] ?? "식비",
      originalAmount: "", actualAmount: "",
      aiReason: "", date: todayStr(), memo: "",
    }));

    // 중복 표시: 이미 큐에 있거나 같은 배치 내 동일 파일이면 dup 마크(등록은 막지 않음)
    // 향후: 저장된 기록의 이미지 지문과 대조해 '예전에 올린 사진'까지 확장
    setQueue(prev => {
      const seen = new Set(prev.map(it => it.sig));
      return [...prev, ...newItems.map(it => {
        const isDup = seen.has(it.sig);
        seen.add(it.sig);
        return isDup ? { ...it, dup: true } : it;
      })];
    });

    newItems.forEach((item) => {
      processFile(item.file, item.id).catch(() => {
        setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
      });
    });
  }, [processFile, categoryNames]);

  // [작업1-a] 분석 실패 항목 재시도 — 보관해 둔 원본 File로 다시 분석 (큐 유지)
  const retryQueueItem = useCallback((item: QueueItem) => {
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "analyzing" as const } : it));
    processFile(item.file, item.id).catch(() => {
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
    });
  }, [processFile]);

  // ── 큐 아이템 등록 — 버그 #1: 개별 submitting 상태 사용 ──
  const handleQueueConfirm = async (item: QueueItem) => {
    if (!item.originalAmount || !item.actualAmount) {
      toast.error("원가와 실제 지출액을 입력해주세요");
      return;
    }
    // 해당 아이템만 submitting = true
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, submitting: true } : it));
    try {
      await createEntry.mutateAsync({
        date: item.date,
        title: item.title || item.fileName,
        category: item.category,
        originalAmount: Number(item.originalAmount),
        actualAmount: Number(item.actualAmount),
        aiEstimated: "yes",
        // 데이터 해자: 보관해둔 AI 추정 원본 전달(서버가 사용자 확정값과 다르면 보정 기록)
        aiOriginalAmount: item.aiOriginalAmount,
        aiActualAmount: item.aiActualAmount,
        aiReason: item.aiReason,
        imageUrl: item.imageUrl,
        memo: item.memo || undefined,
      });
      const saved = Math.max(0, Number(item.originalAmount) - Number(item.actualAmount));
      toast.success(`+₩${fmt(saved)} 지켜냈어요`, { description: `${item.title || item.fileName} 기록됨` });
      setQueue(prev => {
        const it = prev.find(i => i.id === item.id);
        if (it) URL.revokeObjectURL(it.previewUrl);
        return prev.filter(i => i.id !== item.id);
      });
    } catch {
      toast.error("등록에 실패했습니다");
      // 실패 시 submitting 복원
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, submitting: false } : it));
    }
  };

  const removeQueueItem = (id: string) => {
    setQueue(prev => {
      const it = prev.find(i => i.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const updateQueueItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  // ── 수동 등록 — 버그 #3: form onSubmit으로 Enter 제출 지원 ──
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.title || !manualForm.originalAmount || !manualForm.actualAmount) return;
    try {
      await createEntry.mutateAsync({
        date: manualForm.date,
        title: manualForm.title,
        category: manualForm.category,
        originalAmount: Number(manualForm.originalAmount),
        actualAmount: Number(manualForm.actualAmount),
        description: manualForm.description || undefined,
        memo: manualForm.memo || undefined,
        aiEstimated: "no",
      });
      toast.success("등록됐습니다");
      const d = todayStr();
      setManualForm({ date: d, title: makeDefaultTitle(d, "식비"), category: "식비", originalAmount: "", actualAmount: "", description: "", memo: "" });
      setManualTitleEdited(false);
      setShowManual(false);
    } catch {
      toast.error("등록에 실패했습니다");
    }
  };

  // 버그 #4: 수동 입력 날짜/카테고리 변경 시 제목 자동 갱신 (userEdited 플래그 확인)
  const handleManualDateChange = (date: string) => {
    setManualForm(f => ({
      ...f,
      date,
      title: manualTitleEdited ? f.title : makeDefaultTitle(date, f.category),
    }));
  };

  const handleManualCategoryChange = (category: string) => {
    setManualForm(f => ({
      ...f,
      category,
      title: manualTitleEdited ? f.title : makeDefaultTitle(f.date, category),
    }));
  };

  // ── 인라인 수정 ──
  const startEdit = (entry: SavingsEntry) => {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      category: entry.category,
      originalAmount: String(entry.originalAmount),
      actualAmount: String(entry.actualAmount),
      memo: entry.memo ?? "",
      date: entry.date,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent, id: number) => {
    e.preventDefault(); // 버그 #3: form 제출로 Enter 키 지원
    if (!editForm) return;
    try {
      await updateEntry.mutateAsync({
        id,
        title: editForm.title,
        category: editForm.category,
        originalAmount: Number(editForm.originalAmount),
        actualAmount: Number(editForm.actualAmount),
        memo: editForm.memo || null,
        date: editForm.date,
      });
      toast.success("수정됐습니다");
      setEditingId(null);
      setEditForm(null);
    } catch {
      toast.error("수정에 실패했습니다");
    }
  };

  // ── Export ──
  const exportEntries = useMemo(
    () => filterByRange(entries as SavingsEntry[], exportRange, customFrom, customTo),
    [entries, exportRange, customFrom, customTo]
  );

  const handleCopyMd = async () => {
    const md = toMarkdownTable(exportEntries);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("마크다운 테이블이 클립보드에 복사됐습니다");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("마크다운 테이블이 클립보드에 복사됐습니다");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("복사에 실패했습니다. 직접 선택하여 복사해주세요.");
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const handleDownloadCsv = () => {
    const csv = toCsv(exportEntries);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = { all: "전체", month: "이번달", week: "이번주", custom: "기간" }[exportRange];
    a.download = `거지로그_${label}_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 다운로드됩니다");
  };

  // ── 로그인 화면 ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-6 px-6">
        <div className="text-center">
          <h1 className="text-hero font-bold tracking-tight text-ink">거지로그</h1>
          <p className="mt-2 text-body text-ink-soft">절약한 만큼 번다</p>
        </div>
        <p className="text-body text-ink-soft text-center leading-relaxed">
          연결이 잠시 불안정해 데이터를 불러오지 못했어요.<br />
          잠깐 후 다시 시도해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white text-body font-medium rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <Loader2 size={16} />
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream max-w-lg mx-auto px-5 pb-24">

      {/* ── 헤더 ── */}
      <header className="pt-12 pb-5 flex items-end justify-between">
        <p className="text-title font-semibold text-ink">장부</p>
        <p className="text-caption font-mono text-ink-soft tracking-wider">{(entries as SavingsEntry[]).length}끼 기록</p>
      </header>

      {/* ── 탭 ── */}
      <div className="flex border-b border-line mb-6">
        {(["input", "calendar"] as MainTab[]).map(t => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`flex-1 py-2.5 text-body font-medium transition-colors ${
              mainTab === t
                ? "text-emerald-600 border-b-2 border-emerald-500 -mb-px"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {{ input: "기록 추가", calendar: "앨범" }[t]}
          </button>
        ))}
      </div>

      {/* ── 입력 탭 ── */}
      {mainTab === "input" && (
        <>
          {/* 사진 업로드 영역 */}
          <section className="mb-6">
            <div
              className="border-2 border-dashed border-line rounded-card p-6 text-center hover:border-emerald-300 cursor-pointer transition-colors"
              onClick={() => galleryRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <Upload className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
              <p className="text-body font-medium text-ink">사진을 올리면 자르르가 절약액을 계산해요</p>
              <p className="text-caption text-ink-soft mt-1">한 번에 여러 장 · 드래그앤드롭 또는 탭해서 선택</p>
            </div>
            {/* 카메라 — 향후 앱 톤에 맞춘 자체 카메라로 교체할 단일 진입점(openCamera) */}
            <button
              onClick={openCamera}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-caption text-ink-soft border border-line rounded-lg hover:border-emerald-300 hover:text-emerald-600 transition-colors"
            >
              <Camera size={14} /> 카메라로 촬영
            </button>
          </section>

          {/* 업로드 큐 */}
          {queue.length > 0 && (
            <section className="mb-6 space-y-3">
              <p className="text-caption font-mono text-ink-soft tracking-widest uppercase">분석 대기열 ({queue.length})</p>
              {queue.map(item => (
                <div key={item.id} className="border border-line rounded-card overflow-hidden">
                  {/* 중복 의심 배지 — 같은 사진을 또 올렸을 때 (등록은 가능) */}
                  {item.dup && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-micro text-amber-700">
                      <Copy size={12} /> 이미 추가한 사진과 같아 보여요
                    </div>
                  )}
                  {/* 분석 중 스켈레톤 */}
                  {item.status === "analyzing" && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 rounded-lg bg-line animate-pulse flex-shrink-0 overflow-hidden">
                        <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-50" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-line rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-line rounded animate-pulse w-1/2" />
                        <div className="flex items-center gap-1.5 text-caption text-ink-soft">
                          <Loader2 size={12} className="animate-spin text-emerald-500" />
                          AI 분석 중...
                        </div>
                      </div>
                      <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint hover:text-ink-soft">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* 오류 — [작업1-a] 보관한 원본 File로 재분석 가능 */}
                  {item.status === "error" && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 rounded-lg bg-red-50 flex-shrink-0 overflow-hidden">
                        <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-caption text-red-500">분석에 실패했어요</p>
                        <p className="text-caption text-ink-soft truncate">다시 시도하거나 아래에서 직접 입력하세요</p>
                      </div>
                      <button
                        onClick={() => retryQueueItem(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-caption text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 active:scale-95 transition-all flex-shrink-0"
                      >
                        <RotateCw size={12} /> 다시 시도
                      </button>
                      <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint hover:text-ink-soft flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* 분석 완료 — 수정 가능한 폼 */}
                  {item.status === "ready" && (
                    <div className="p-3 space-y-3">
                      <div className="flex items-start gap-3">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {/* 항목명 */}
                          <input
                            value={item.title}
                            onChange={e => updateQueueItem(item.id, { title: e.target.value })}
                            className="w-full text-body font-medium text-ink border-0 border-b border-line pb-0.5 focus:outline-none focus:border-emerald-400 bg-transparent"
                            placeholder="항목명"
                          />
                          {/* 날짜 + 카테고리 */}
                          <div className="flex gap-2 mt-1.5">
                            <input
                              type="date"
                              value={item.date}
                              onChange={e => updateQueueItem(item.id, { date: e.target.value })}
                              className="text-caption text-ink-soft border-0 border-b border-line focus:outline-none focus:border-emerald-300 bg-transparent w-28"
                            />
                            <select
                              value={item.category}
                              onChange={e => updateQueueItem(item.id, { category: e.target.value })}
                              className="text-caption text-ink-soft border-0 border-b border-line focus:outline-none focus:border-emerald-300 bg-transparent"
                            >
                              {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint hover:text-ink-soft flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>

                      {/* [작업5] 리빌 히어로 — 도파민은 "지켜냄"(절약=수익 리프레임) */}
                      <div className="flex items-baseline justify-between rounded-card bg-emerald-50 px-3 py-2.5">
                        <span className="text-micro font-medium text-emerald-700/70">이번에 지켜낸 돈</span>
                        <span className="font-mono text-xl font-extrabold tabular-nums text-emerald-600">
                          {item.originalAmount && item.actualAmount
                            ? `+₩${fmt(Math.max(0, Number(item.originalAmount) - Number(item.actualAmount)))}`
                            : "—"}
                          <span className="ml-1 text-caption font-semibold text-emerald-600/80">지켜냄</span>
                        </span>
                      </div>

                      {/* [작업5] AI 원가추정은 작은 보조줄 — 바로 탭해서 수정 (원가 → 실제) */}
                      <div className="flex items-center gap-2 px-1 text-micro text-ink-soft">
                        <span className="font-mono uppercase tracking-wider text-ink-faint">AI 추정</span>
                        <span className="flex items-center gap-1">원가
                          <input type="number" value={item.originalAmount}
                            onChange={e => updateQueueItem(item.id, { originalAmount: e.target.value })}
                            className="w-16 border-0 border-b border-line bg-transparent text-right tabular-nums text-ink-soft focus:border-emerald-400 focus:outline-none" />
                        </span>
                        <span className="text-ink-faint">→</span>
                        <span className="flex items-center gap-1">실제
                          <input type="number" value={item.actualAmount}
                            onChange={e => updateQueueItem(item.id, { actualAmount: e.target.value })}
                            className="w-16 border-0 border-b border-line bg-transparent text-right tabular-nums text-ink-soft focus:border-emerald-400 focus:outline-none" />
                        </span>
                      </div>

                      {/* 내 썰(메모) — 사적 화면 노출 OK, 공유 카드엔 기본 미포함 */}
                      <input
                        value={item.memo}
                        onChange={e => updateQueueItem(item.id, { memo: e.target.value })}
                        placeholder="내 썰 한 줄 (선택)"
                        className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                      />

                      {/* AI 근거 — 더 작게 보조 표기 */}
                      {item.aiReason && (
                        <p className="text-micro text-ink-faint leading-relaxed">{item.aiReason}</p>
                      )}

                      {/* 버그 #1: item.submitting 으로 개별 로딩 */}
                      <button
                        onClick={() => handleQueueConfirm(item)}
                        disabled={item.submitting}
                        className="w-full py-2 bg-emerald-500 text-white text-body font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {item.submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "등록"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* 직접 입력 */}
          <section className="mb-6">
            <button
              onClick={() => setShowManual(v => !v)}
              className="w-full flex items-center justify-between py-3 text-body text-ink-soft hover:text-ink transition-colors"
            >
              <span className="flex items-center gap-1.5"><PenLine size={14} /> 직접 입력</span>
              {showManual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* 버그 #3: form 태그 + type="submit" 으로 Enter 키 제출 지원 */}
            {showManual && (
              <form onSubmit={handleManualSubmit} className="border border-line rounded-card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">날짜</label>
                    <input type="date" value={manualForm.date}
                      onChange={e => handleManualDateChange(e.target.value)}
                      className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">카테고리</label>
                    <select value={manualForm.category}
                      onChange={e => handleManualCategoryChange(e.target.value)}
                      className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white">
                      {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-caption text-ink-soft mb-1 block">항목명</label>
                  <input type="text" value={manualForm.title}
                    onChange={e => {
                      setManualTitleEdited(true);
                      setManualForm(f => ({ ...f, title: e.target.value }));
                    }}
                    className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">원가 (원)</label>
                    <input type="number" placeholder="9000" value={manualForm.originalAmount}
                      onChange={e => setManualForm(f => ({ ...f, originalAmount: e.target.value }))}
                      className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-caption text-ink-soft mb-1 block">실제 지출 (원)</label>
                    <input type="number" placeholder="3000" value={manualForm.actualAmount}
                      onChange={e => setManualForm(f => ({ ...f, actualAmount: e.target.value }))}
                      className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>
                <div>
                  <label className="text-caption text-ink-soft mb-1 block">메모 (선택)</label>
                  <input type="text" placeholder="메모를 남겨보세요" value={manualForm.memo}
                    onChange={e => setManualForm(f => ({ ...f, memo: e.target.value }))}
                    className="w-full text-body border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400" />
                </div>
                {manualForm.originalAmount && manualForm.actualAmount && (
                  <p className="text-caption text-emerald-600 font-medium">
                    수익: +₩{fmt(Number(manualForm.originalAmount) - Number(manualForm.actualAmount))}
                  </p>
                )}
                <button type="submit" disabled={createEntry.isPending}
                  className="w-full py-2.5 bg-emerald-500 text-white text-body font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                  {createEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "등록"}
                </button>
              </form>
            )}
          </section>

          {/* 기록 목록 */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-caption font-mono text-ink-soft tracking-widest uppercase">기록</h2>
              <span className="text-caption text-ink-soft">{(entries as SavingsEntry[]).length}건</span>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-line rounded-lg animate-pulse" />)}
              </div>
            ) : (entries as SavingsEntry[]).length === 0 ? (
              <div className="flex flex-col items-center text-center py-10">
                <Jarureu level={0.12} size={64} />
                <p className="text-body font-medium text-ink mt-3">아직 장부가 비어 있어요</p>
                <p className="text-caption text-ink-soft mt-1">사진 한 장이면 자르르가 첫 절약을 찾아드려요</p>
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-caption font-medium active:scale-95 transition-transform"
                >
                  <Camera size={14} /> 첫 기록 남기기
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {(entries as SavingsEntry[]).map(entry => (
                  <div key={entry.id}>
                    {/* 일반 행 */}
                    {editingId !== entry.id && (
                      <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                        {entry.imageUrl
                          ? <img src={entry.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-line flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          {/* [작업2] 티커칩 + 제목 */}
                          <div className="flex items-center gap-1.5">
                            {entry.ticker && (
                              <span className="text-micro font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[#E0A92E]/15 text-[#B07F1E] flex-shrink-0">
                                {entry.ticker}
                              </span>
                            )}
                            <p className="text-body font-medium text-ink truncate">{entry.title}</p>
                          </div>
                          {/* 내 썰(메모) 한 줄 미리보기 — 사적 화면이라 노출 OK */}
                          {entry.memo && <p className="text-caption text-ink-soft truncate mt-0.5 italic">{entry.memo}</p>}
                        </div>
                        {/* 버그 #2: 원가(취소선) → 실제지출 나란히 + 절약수익 */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-body font-mono font-semibold text-emerald-500">+₩{fmt(entry.profit)}</p>
                          <p className="text-caption text-ink-soft tabular-nums">
                            <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                            <span className="mx-1 text-ink-faint">→</span>
                            <span className="text-ink-soft">₩{fmt(entry.actualAmount)}</span>
                          </p>
                        </div>
                        <button onClick={() => setStoryEntry(entry)}
                          className="p-1.5 text-ink-faint hover:text-emerald-500 transition-colors flex-shrink-0">
                          <Share2 size={13} />
                        </button>
                        <button onClick={() => startEdit(entry)}
                          className="p-1.5 text-ink-faint hover:text-emerald-500 transition-colors flex-shrink-0">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`"${entry.title}" 기록을 삭제할까요?`)) deleteEntry.mutate({ id: entry.id }); }}
                          className="p-1.5 text-ink-faint hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    {/* 인라인 수정 폼 — 버그 #3: form 태그로 감싸서 Enter 키 제출 지원 */}
                    {editingId === entry.id && editForm && (
                      <form
                        onSubmit={e => handleEditSubmit(e, entry.id)}
                        className="border border-emerald-200 rounded-card p-3 my-1 space-y-2 bg-emerald-50/30"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-micro text-ink-soft block mb-0.5">날짜</label>
                            <input type="date" value={editForm.date}
                              onChange={e => setEditForm(f => f ? { ...f, date: e.target.value } : f)}
                              className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-micro text-ink-soft block mb-0.5">카테고리</label>
                            <select value={editForm.category}
                              onChange={e => setEditForm(f => f ? { ...f, category: e.target.value } : f)}
                              className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white">
                              {categoryNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-micro text-ink-soft block mb-0.5">항목명</label>
                          <input value={editForm.title}
                            onChange={e => setEditForm(f => f ? { ...f, title: e.target.value } : f)}
                            className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-micro text-ink-soft block mb-0.5">원가</label>
                            <input type="number" value={editForm.originalAmount}
                              onChange={e => setEditForm(f => f ? { ...f, originalAmount: e.target.value } : f)}
                              className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-micro text-ink-soft block mb-0.5">실제 지출</label>
                            <input type="number" value={editForm.actualAmount}
                              onChange={e => setEditForm(f => f ? { ...f, actualAmount: e.target.value } : f)}
                              className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                          </div>
                        </div>
                        <div>
                          <label className="text-micro text-ink-soft block mb-0.5">메모</label>
                          <input value={editForm.memo}
                            onChange={e => setEditForm(f => f ? { ...f, memo: e.target.value } : f)}
                            placeholder="메모 (선택)"
                            className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white" />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={updateEntry.isPending}
                            className="flex-1 py-1.5 bg-emerald-500 text-white text-caption font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                            {updateEntry.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "저장"}
                          </button>
                          <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }}
                            className="px-3 py-1.5 text-caption text-ink-soft border border-line rounded-lg hover:bg-cream transition-colors">
                            취소
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export */}
          <section className="mb-6">
            <button onClick={() => setShowExport(v => !v)}
              className="w-full flex items-center justify-between py-3 text-body text-ink-soft hover:text-ink transition-colors">
              <span className="flex items-center gap-1.5"><Download size={14} /> 데이터 내보내기</span>
              {showExport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showExport && (
              <div className="border border-line rounded-card p-4 space-y-4">
                <div>
                  <p className="text-caption text-ink-soft mb-2">기간 선택</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "month", "week", "custom"] as ExportRange[]).map(r => (
                      <button key={r} onClick={() => setExportRange(r)}
                        className={`px-3 py-1.5 text-caption rounded-lg border transition-colors ${
                          exportRange === r ? "bg-emerald-500 text-white border-emerald-500" : "border-line text-ink-soft hover:border-emerald-300"
                        }`}>
                        {{ all: "전체", month: "이번 달", week: "이번 주", custom: "직접 선택" }[r]}
                      </button>
                    ))}
                  </div>
                  {exportRange === "custom" && (
                    <div className="flex gap-2 mt-2">
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        className="flex-1 text-caption border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400" />
                      <span className="text-caption text-ink-soft self-center">~</span>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        className="flex-1 text-caption border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400" />
                    </div>
                  )}
                </div>
                <div className="bg-cream rounded-lg px-3 py-2">
                  <p className="text-caption text-ink-soft">
                    {exportEntries.length}건 · 수익{" "}
                    <span className="font-semibold text-emerald-600">₩{fmt(exportEntries.reduce((s, e) => s + e.profit, 0))}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopyMd} disabled={exportEntries.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-body border border-line rounded-lg hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 transition-colors">
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    Notion MD 복사
                  </button>
                  <button onClick={handleDownloadCsv} disabled={exportEntries.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-body border border-line rounded-lg hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 transition-colors">
                    <Download size={14} />
                    CSV 다운로드
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── 캘린더 탭 ── */}
      {mainTab === "calendar" && (
        <section className="mb-6">
          <MiniCalendar entries={entries as SavingsEntry[]} />
        </section>
      )}

      {/* 푸터 */}
      <footer className="text-center pb-4">
        <p className="text-caption text-ink-faint">거지답게 아꼈서 벌었다</p>
      </footer>

      {/* 스토리 카드 모달 */}
      {storyEntry && (
        <SavingsStoryCard
          entry={storyEntry}
          onClose={() => setStoryEntry(null)}
        />
      )}

      {/* hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
