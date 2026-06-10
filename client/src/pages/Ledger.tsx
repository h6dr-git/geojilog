// 거지로그 — 장부(Ledger) 화면: 보기 전용 세그먼트(기록·달력·앨범) + '기록 추가' 시트.
// 네비 단일화: 탭 속 탭(기록추가|앨범 → 앨범|달력)을 없애고, 추가 행위는 시트 하나로 모았다.
// ============================================================

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";
import { smartCropToSquare } from "@/lib/smartCrop";
import {
  Upload, Camera, PenLine, Loader2,
  Copy, Trash2, ChevronDown, ChevronUp, ChevronRight,
  Pencil, X, Share2, RotateCw, Plus, Repeat,
} from "lucide-react";
import SavingsStoryCard from "@/components/SavingsStoryCard";
import MiniCalendar from "@/components/MiniCalendar";
import ConfirmDialog from "@/components/ConfirmDialog";
import Jarureu from "@/components/Jarureu";
import { SavingsEntry, fmt, todayStr, makeDefaultTitle } from "@/lib/ledger";
import { celebrateSave } from "@/lib/celebrate";

// 파일 시그니처(이름|크기|수정시각) — 같은 사진 중복 업로드 감지용
const fileSig = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

// 업로드 큐 아이템
interface QueueItem {
  id: string;
  file: File; // 원본 File 보관 → 분석 실패 시 재시도(재분석) 가능
  previewUrl: string;
  fileName: string;
  sig: string;           // 파일 시그니처 — 중복 감지용
  dup?: boolean;         // 같은 배치/큐 내 중복 의심
  status: "analyzing" | "ready" | "error";
  submitting: boolean;   // 개별 등록 로딩 상태
  title: string;
  category: string;
  originalAmount: string;
  actualAmount: string;
  aiReason: string;
  date: string;
  memo: string;
  imageUrl?: string;
  priorDate?: string; // P2 — 지난 확정가가 적용된 경우
  // 데이터 해자: AI 추정 원본값 보관
  aiOriginalAmount?: number;
  aiActualAmount?: number;
}

type MainTab = "list" | "calendar" | "album";

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function Ledger({ initialFocus = null }: { initialFocus?: "week" | null }) {
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

  // ── P1: 늘 지키는 것 — 제목 기준 2회 이상 기록된 항목 상위 4개 (최근 금액으로 원탭 재기록) ──
  const frequents = useMemo(() => {
    type Freq = { title: string; category: string; originalAmount: number; actualAmount: number; count: number; lastDate: string };
    const map = new Map<string, Freq>();
    for (const e of entries as SavingsEntry[]) {
      const key = e.title.trim().toLowerCase();
      if (!key) continue;
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
        if (e.date > cur.lastDate) {
          cur.lastDate = e.date;
          cur.title = e.title;
          cur.category = e.category;
          cur.originalAmount = e.originalAmount;
          cur.actualAmount = e.actualAmount;
        }
      } else {
        map.set(key, { title: e.title, category: e.category, originalAmount: e.originalAmount, actualAmount: e.actualAmount, count: 1, lastDate: e.date });
      }
    }
    return Array.from(map.values())
      .filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
      .slice(0, 4);
  }, [entries]);

  const [repeating, setRepeating] = useState(false);
  const handleQuickRepeat = async (f: { title: string; category: string; originalAmount: number; actualAmount: number }) => {
    if (repeating) return;
    setRepeating(true);
    try {
      await createEntry.mutateAsync({
        date: todayStr(),
        title: f.title,
        category: f.category,
        originalAmount: f.originalAmount,
        actualAmount: f.actualAmount,
        aiEstimated: "no",
      });
      const saved = f.originalAmount - f.actualAmount;
      if (saved > 0) celebrateSave({ profit: saved, title: f.title });
      else toast.success("기록됐습니다", { description: f.title });
    } catch {
      toast.error("등록에 실패했습니다");
    } finally {
      setRepeating(false);
    }
  };

  // ── 세그먼트 (회장님 탭 '주간 결산' 딥링크 → 달력의 주간 상세) ──
  const [mainTab, setMainTab] = useState<MainTab>(initialFocus === "week" ? "calendar" : "list");

  // ── 기록 추가 시트 ──
  const [showAdd, setShowAdd] = useState(false);

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

  // ── 스토리 공유 / 삭제 확인 ── (내보내기는 회장님 탭으로 일원화 — SSOT §9-4)
  const [storyEntry, setStoryEntry] = useState<SavingsEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavingsEntry | null>(null);

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

    const autoTitle = makeDefaultTitle(date, result.category);

    setQueue(prev => prev.map(it => it.id === itemId ? {
      ...it,
      status: "ready" as const,
      title: autoTitle,
      category: result.category,
      // P2 — 지난 확정가 우선 (기준가 일관성)
      originalAmount: String(result.prior?.originalAmount ?? result.estimatedOriginalAmount),
      priorDate: result.prior?.date,
      actualAmount: String(result.estimatedActualAmount),
      aiReason: result.reason,
      date,
      imageUrl: finalImageUrl,
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
      file,
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

  // 분석 실패 항목 재시도 — 보관해 둔 원본 File로 다시 분석 (큐 유지)
  const retryQueueItem = useCallback((item: QueueItem) => {
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "analyzing" as const } : it));
    processFile(item.file, item.id).catch(() => {
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
    });
  }, [processFile]);

  // ── 큐 아이템 등록 ──
  const handleQueueConfirm = async (item: QueueItem) => {
    if (!item.originalAmount || !item.actualAmount) {
      toast.error("원가와 실제 지출액을 입력해주세요");
      return;
    }
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, submitting: true } : it));
    try {
      await createEntry.mutateAsync({
        date: item.date,
        title: item.title || item.fileName,
        category: item.category,
        originalAmount: Number(item.originalAmount),
        actualAmount: Number(item.actualAmount),
        aiEstimated: "yes",
        aiOriginalAmount: item.aiOriginalAmount,
        aiActualAmount: item.aiActualAmount,
        aiReason: item.aiReason,
        imageUrl: item.imageUrl,
        memo: item.memo || undefined,
      });
      const saved = Math.max(0, Number(item.originalAmount) - Number(item.actualAmount));
      if (saved > 0) celebrateSave({ profit: saved, title: item.title || item.fileName });
      else toast.success("기록됐어요", { description: `${item.title || item.fileName} 기록됨` });
      setQueue(prev => {
        const it = prev.find(i => i.id === item.id);
        if (it) URL.revokeObjectURL(it.previewUrl);
        return prev.filter(i => i.id !== item.id);
      });
    } catch {
      toast.error("등록에 실패했습니다");
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

  // ── 수동 등록 ──
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
      const manualSaved = Number(manualForm.originalAmount) - Number(manualForm.actualAmount);
      if (manualSaved > 0) celebrateSave({ profit: manualSaved, title: manualForm.title });
      else toast.success("등록됐습니다");
      const d = todayStr();
      setManualForm({ date: d, title: makeDefaultTitle(d, "식비"), category: "식비", originalAmount: "", actualAmount: "", description: "", memo: "" });
      setManualTitleEdited(false);
      setShowManual(false);
    } catch {
      toast.error("등록에 실패했습니다");
    }
  };

  // 수동 입력 날짜/카테고리 변경 시 제목 자동 갱신 (userEdited 플래그 확인)
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
    e.preventDefault();
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

  // 분석 중/완료 개수 — 시트가 닫혀 있어도 진행 상황을 칩으로 보여준다
  const analyzingCount = queue.filter(q => q.status === "analyzing").length;
  const readyCount = queue.filter(q => q.status !== "analyzing").length;

  // ── 로그인 화면 ──
  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-cream gap-6 px-6">
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
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white text-body font-medium rounded-xl active:scale-[0.98] transition-transform"
        >
          <RotateCw size={16} />
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cream max-w-lg mx-auto px-5 pb-24">

      {/* ── 헤더: 제목 + 기록 추가 ── */}
      <header className="pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <p className="text-title font-semibold text-ink">장부</p>
          <p className="text-caption font-mono text-ink-soft tracking-wider">{(entries as SavingsEntry[]).length}끼 기록</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 pl-2.5 pr-3.5 py-2 rounded-full bg-emerald-500 text-white text-caption font-medium shadow-sm shadow-emerald-500/30 active:scale-95 transition-transform"
        >
          <Plus size={15} /> 기록 추가
        </button>
      </header>

      {/* ── 분석 진행 칩 — 시트를 닫아도 큐 상황이 보인다 ── */}
      {queue.length > 0 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2.5 mb-4 px-3.5 py-2.5 rounded-card border border-emerald-200 bg-emerald-50 text-left active:bg-emerald-100 transition-colors"
        >
          {analyzingCount > 0
            ? <Loader2 size={14} className="animate-spin text-emerald-500 shrink-0" />
            : <Upload size={14} className="text-emerald-500 shrink-0" />}
          <span className="flex-1 text-caption text-emerald-700">
            {analyzingCount > 0 ? `${analyzingCount}장 분석 중` : `${readyCount}장 확인 대기`}
          </span>
          <ChevronRight size={14} className="text-emerald-400 shrink-0" />
        </button>
      )}

      {/* ── 세그먼트: 기록 | 달력 | 앨범 (단일 네비) ── */}
      <div className="flex gap-1 mb-5 bg-line/50 rounded-full p-1">
        {([["list", "기록"], ["calendar", "달력"], ["album", "앨범"]] as [MainTab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`flex-1 py-2 rounded-full text-caption font-medium transition-all ${
              mainTab === t ? "bg-white text-ink shadow-sm" : "text-ink-soft active:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 기록(리스트) ── */}
      {mainTab === "list" && (
        <>
          <section className="mb-6">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-line rounded-lg animate-pulse" />)}
              </div>
            ) : (entries as SavingsEntry[]).length === 0 ? (
              <div className="flex flex-col items-center text-center py-10">
                <Jarureu level={0.12} size={64} />
                <p className="text-body font-medium text-ink mt-3">아직 장부가 비어 있어요</p>
                <p className="text-caption text-ink-soft mt-1">사진 한 장이면 자르르가 첫 수익을 찾아드려요</p>
                <button
                  onClick={() => setShowAdd(true)}
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
                          <div className="flex items-center gap-1.5">
                            {entry.ticker && (
                              <span className="text-micro font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded bg-gold/15 text-[#B07F1E] flex-shrink-0">
                                {entry.ticker}
                              </span>
                            )}
                            <p className="text-body font-medium text-ink truncate">{entry.title}</p>
                          </div>
                          {entry.memo && <p className="text-caption text-ink-soft truncate mt-0.5 italic">{entry.memo}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-body font-mono font-semibold text-emerald-500">+₩{fmt(entry.profit)}</p>
                          <p className="text-caption text-ink-soft tabular-nums">
                            <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                            <span className="mx-1 text-ink-faint">→</span>
                            <span className="text-ink-soft">₩{fmt(entry.actualAmount)}</span>
                          </p>
                        </div>
                        <button onClick={() => setStoryEntry(entry)} aria-label="공유 카드"
                          className="p-1.5 text-ink-faint active:text-emerald-500 transition-colors flex-shrink-0">
                          <Share2 size={13} />
                        </button>
                        <button onClick={() => startEdit(entry)} aria-label="수정"
                          className="p-1.5 text-ink-faint active:text-emerald-500 transition-colors flex-shrink-0">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)} aria-label="삭제"
                          className="p-1.5 text-ink-faint active:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    {/* 인라인 수정 폼 */}
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
                            className="flex-1 py-1.5 bg-emerald-500 text-white text-caption font-medium rounded-lg active:scale-[0.98] disabled:opacity-50 transition-transform">
                            {updateEntry.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "저장"}
                          </button>
                          <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }}
                            className="px-3 py-1.5 text-caption text-ink-soft border border-line rounded-lg active:bg-cream transition-colors">
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

        </>
      )}

      {/* ── 달력 ── */}
      {mainTab === "calendar" && (
        <section className="mb-6">
          <MiniCalendar
            entries={entries as SavingsEntry[]}
            view="calendar"
            initialDetailMode={initialFocus === "week" ? "week" : "day"}
          />
        </section>
      )}

      {/* ── 앨범 ── */}
      {mainTab === "album" && (
        <section className="mb-6">
          <MiniCalendar entries={entries as SavingsEntry[]} view="album" />
        </section>
      )}

      {/* 푸터 */}
      <footer className="text-center pb-4">
        <p className="text-caption text-ink-faint">거지답게 아껴서 벌었다</p>
      </footer>

      {/* ══════════ 기록 추가 시트 ══════════ */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          style={{ animation: "adFade .2s ease" }}
          onClick={() => setShowAdd(false)}
        >
          <style>{`@keyframes adUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes adFade{from{opacity:0}to{opacity:1}}`}</style>
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain"
            style={{ animation: "adUp .28s cubic-bezier(.2,.8,.2,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-8" />
              <span className="text-body font-medium text-ink">기록 추가</span>
              <button onClick={() => setShowAdd(false)} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
                <X size={20} />
              </button>
            </div>

            {/* P1 — 늘 지키는 것: 사진·AI 없이 탭 한 번으로 오늘 기록 (반복 절약의 지름길) */}
            {frequents.length > 0 && (
              <section className="mb-5">
                <p className="text-caption font-mono text-ink-soft tracking-widest uppercase mb-2">늘 지키는 것 — 탭 한 번</p>
                <div className="flex gap-2 flex-wrap">
                  {frequents.map((f) => (
                    <button
                      key={f.title}
                      onClick={() => handleQuickRepeat(f)}
                      disabled={repeating}
                      className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-caption text-emerald-700 font-medium active:scale-95 disabled:opacity-50 transition-transform"
                    >
                      <Repeat size={12} />
                      <span className="max-w-[8rem] truncate">{f.title}</span>
                      <span className="font-mono tabular-nums">+₩{fmt(Math.max(0, f.originalAmount - f.actualAmount))}</span>
                    </button>
                  ))}
                </div>
                <p className="text-micro text-ink-faint mt-1.5">오늘 날짜·지난 금액으로 바로 기록돼요. 금액이 다르면 목록에서 수정.</p>
              </section>
            )}

            {/* 사진 업로드 영역 */}
            <section className="mb-5">
              <div
                className="border-2 border-dashed border-line rounded-card p-6 text-center active:border-emerald-300 cursor-pointer transition-colors"
                onClick={() => galleryRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              >
                <Upload className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-body font-medium text-ink">사진을 올리면 자르르가 번 돈을 계산해요</p>
                <p className="text-caption text-ink-soft mt-1">한 번에 여러 장 · 탭해서 선택</p>
              </div>
              {/* 카메라 — 향후 앱 톤에 맞춘 자체 카메라로 교체할 단일 진입점(openCamera) */}
              <button
                onClick={openCamera}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 text-caption text-ink-soft border border-line rounded-lg active:border-emerald-300 active:text-emerald-600 transition-colors"
              >
                <Camera size={14} /> 카메라로 촬영
              </button>
            </section>

            {/* 업로드 큐 */}
            {queue.length > 0 && (
              <section className="mb-5 space-y-3">
                <p className="text-caption font-mono text-ink-soft tracking-widest uppercase">분석 대기열 ({queue.length})</p>
                {queue.map(item => (
                  <div key={item.id} className="border border-line rounded-card overflow-hidden">
                    {/* 중복 의심 배지 */}
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
                            자르르가 살펴보는 중...
                          </div>
                        </div>
                        <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft">
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* 오류 — 재분석 가능 */}
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
                          className="flex items-center gap-1 px-2.5 py-1.5 text-caption text-emerald-600 border border-emerald-200 rounded-lg active:bg-emerald-50 active:scale-95 transition-all flex-shrink-0"
                        >
                          <RotateCw size={12} /> 다시 시도
                        </button>
                        <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft flex-shrink-0">
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
                            <input
                              value={item.title}
                              onChange={e => updateQueueItem(item.id, { title: e.target.value })}
                              className="w-full text-body font-medium text-ink border-0 border-b border-line pb-0.5 focus:outline-none focus:border-emerald-400 bg-transparent"
                              placeholder="항목명"
                            />
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
                          <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft flex-shrink-0">
                            <X size={14} />
                          </button>
                        </div>

                        {/* 리빌 히어로 — 객관적 숫자 중심 (SSOT §9-2: '지켜냄' 워딩 제거) */}
                        <div className="flex items-baseline justify-between rounded-card bg-emerald-50 px-3 py-2.5">
                          <span className="text-micro font-medium text-emerald-700/70">이번에 번 돈</span>
                          <span className="font-mono text-xl font-extrabold tabular-nums text-emerald-600">
                            {item.originalAmount && item.actualAmount
                              ? `+₩${fmt(Math.max(0, Number(item.originalAmount) - Number(item.actualAmount)))}`
                              : "—"}
                          </span>
                        </div>

                        {/* AI 원가추정 보조줄 */}
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

                        {/* 내 썰(메모) */}
                        <input
                          value={item.memo}
                          onChange={e => updateQueueItem(item.id, { memo: e.target.value })}
                          placeholder="내 썰 한 줄 (선택)"
                          className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                        />

                        {/* P2 — 지난 확정가 적용 표시 */}
                        {item.priorDate && (
                          <p className="text-micro text-emerald-600/80">원가는 지난번 확정가 기준 ({item.priorDate.slice(5).replace("-", ".")})</p>
                        )}

                        {/* AI 근거 */}
                        {item.aiReason && (
                          <p className="text-micro text-ink-faint leading-relaxed">{item.aiReason}</p>
                        )}

                        <button
                          onClick={() => handleQueueConfirm(item)}
                          disabled={item.submitting}
                          className="w-full py-2.5 bg-emerald-500 text-white text-body font-medium rounded-lg active:scale-[0.98] disabled:opacity-50 transition-transform"
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
            <section>
              <button
                onClick={() => setShowManual(v => !v)}
                className="w-full flex items-center justify-between py-3 text-body text-ink-soft active:text-ink transition-colors"
              >
                <span className="flex items-center gap-1.5"><PenLine size={14} /> 직접 입력</span>
                {showManual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

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
                    className="w-full py-2.5 bg-emerald-500 text-white text-body font-medium rounded-lg active:scale-[0.98] disabled:opacity-50 transition-transform">
                    {createEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "등록"}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      )}

      {/* 스토리 카드 모달 */}
      {storyEntry && (
        <SavingsStoryCard
          entry={storyEntry}
          onClose={() => setStoryEntry(null)}
        />
      )}

      {/* 삭제 확인 다이얼로그 — window.confirm 대체 */}
      {deleteTarget && (
        <ConfirmDialog
          title="기록을 삭제할까요?"
          description={`"${deleteTarget.title}" 기록이 장부에서 사라져요.`}
          confirmLabel="삭제"
          onConfirm={() => {
            deleteEntry.mutate({ id: deleteTarget.id });
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
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
