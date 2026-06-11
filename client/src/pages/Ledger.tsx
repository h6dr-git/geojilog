// 거지로그 — 장부: 기록 단일 뷰 + '기록 추가' 시트.
// 2026-06-10 재편: 사진 탭 폐지(장부 메타포에서 사진은 1급 객체가 아니라 기록의 증빙).
// 월간 결산·이달의 카드는 '서재' 탭으로 이사. 행 탭 → 상세 시트에서 보기·수정·삭제.
// ============================================================

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";
import { smartCropToSquare } from "@/lib/smartCrop";
import {
  Upload, Camera, PenLine, Loader2,
  Copy, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  X, RotateCw, Plus, CalendarDays,
} from "lucide-react";
import EntryDetailSheet from "@/components/EntryDetailSheet";
import IncomeSourceChips, { useIncomeSourceList } from "@/components/IncomeSourceChips";
import IncomeSourceSheet, { UNCLASSIFIED_KEY } from "@/components/IncomeSourceSheet";
import { UNCLASSIFIED, FIXED_ACTUAL } from "@shared/incomeSources";
import Jarureu from "@/components/Jarureu";
import { SavingsEntry, fmt, todayStr, makeDefaultTitle, KO_DAYS, incomeSourceUsual } from "@/lib/ledger";
import { celebrateSave } from "@/lib/celebrate";
import { analyzingStart, analyzingEnd } from "@/lib/analyzing";

// 파일 시그니처(이름|크기|수정시각) — 같은 사진 중복 업로드 감지용
const fileSig = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

// 업로드 큐 아이템
interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  sig: string;
  dup?: boolean;
  status: "analyzing" | "ready" | "error";
  submitting: boolean;
  title: string;
  category: string;
  originalAmount: string;
  actualAmount: string;
  aiReason: string;
  date: string;
  memo: string;
  incomeSource: string | null; // #37+#38 수익원 (AI 분류 → 사용자 수정)
  imageUrl?: string;
  priorDate?: string; // P2 — 지난 확정가가 적용된 경우
  nSplit?: string;     // #33 엔빵 — 인원 (원가=총 추정액÷n, 실제는 청구액 직접 입력)
  priorUsualActual?: number; // 단골 평소가 (#37)
  groupOriginal?: number;    // #43 — AI 전체 원가 추정 (단체)
  groupActual?: number;      // #43 — AI 전체 실제 추정 (단체)
  aiOriginalAmount?: number;
  aiActualAmount?: number;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function Ledger({ weekFocusNonce = 0 }: { weekFocusNonce?: number }) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.savings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: isAuthenticated });

  const createEntry = trpc.savings.create.useMutation({
    onSuccess: () => utils.savings.list.invalidate(),
  });
  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadCroppedImage = trpc.ai.uploadImage.useMutation();

  const categoryNames = useMemo(
    () => (categories.length > 0 ? categories.map((c: { name: string }) => c.name) : ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"]),
    [categories]
  );

  // ── 월 네비게이션 (기록·사진 공통) ──
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const prevMonth = () => { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setFilterDate(null); };
  const nextMonth = () => { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setFilterDate(null); };
  const handleMonthJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m] = e.target.value.split("-").map(Number);
    if (y && m) { setViewDate(new Date(y, m - 1, 1)); setFilterDate(null); }
  };

  // ── 접이식 달력 — 접기 효익: 가계부의 주 사용(기록 확인)이 첫 화면에 보이게. 선호는 기기별 기억 ──
  const [showCal, setShowCal] = useState<boolean>(() => {
    try { return localStorage.getItem("geojilog:ledger-cal") === "1"; } catch { return false; }
  });
  const toggleCal = () => setShowCal((v) => {
    const next = !v;
    try { localStorage.setItem("geojilog:ledger-cal", next ? "1" : "0"); } catch { /* 무시 */ }
    return next;
  });

  // ── 주간 딥링크 (서재 '주간 보고' → 이번 주 기록만) — keep-mounted라 nonce 증가로 신호받음 ──
  const [weekFilter, setWeekFilter] = useState<{ start: string; end: string } | null>(null);
  useEffect(() => {
    if (weekFocusNonce <= 0) return;
    const e = new Date(); e.setHours(0, 0, 0, 0);
    const s = new Date(e); s.setDate(s.getDate() - 6);
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setWeekFilter({ start: f(s), end: f(e) });
  }, [weekFocusNonce]);

  // ── 데이터 (서버가 날짜순 정렬) ──
  const monthEntries = useMemo(
    () => (entries as SavingsEntry[]).filter((e) => e.date.startsWith(ym)),
    [entries, ym]
  );
  const dateScoped = useMemo(() => {
    if (weekFilter) return (entries as SavingsEntry[]).filter((e) => e.date >= weekFilter.start && e.date <= weekFilter.end);
    if (filterDate) return monthEntries.filter((e) => e.date === filterDate);
    return monthEntries;
  }, [entries, monthEntries, weekFilter, filterDate]);

  // ── #37+#38 수익원 필터 — 날짜 스코프 위에 겹친다 ──
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of dateScoped) {
      const k = e.incomeSource ?? UNCLASSIFIED_KEY;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [dateScoped]);
  const displayEntries = useMemo(() => {
    if (!sourceFilter) return dateScoped;
    return dateScoped.filter((e) =>
      sourceFilter === UNCLASSIFIED_KEY ? !e.incomeSource : e.incomeSource === sourceFilter
    );
  }, [dateScoped, sourceFilter]);

  // 날짜별 그룹 (장부의 본질: "언제, 얼마")
  const groups = useMemo(() => {
    const map = new Map<string, SavingsEntry[]>();
    for (const e of displayEntries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [displayEntries]);

  const monthTotal = useMemo(() => monthEntries.reduce((s, e) => s + e.profit, 0), [monthEntries]);
  // 달력용 일자별 합계 — 점 표시 대신 금액 숫자 (피드백)
  const profitByDate = useMemo(() => {
    const map: Record<string, number> = {};
    monthEntries.forEach((e) => { map[e.date] = (map[e.date] ?? 0) + e.profit; });
    return map;
  }, [monthEntries]);

  // 달력 그리드 (7열)
  const calWeeks = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [year, month]);

  // ── 상세 ── (공유 카드 진입은 '카드 스킨 프로젝트'로 분리 — 피드백 #20 철회)
  const [detailEntry, setDetailEntry] = useState<SavingsEntry | null>(null);

  // ── 기록 추가 시트 ──
  const [showAdd, setShowAdd] = useState(false);
  // #31 재작업 — 업로드하면 시트가 '내려가고', 분석 시작 연출이 잠깐 뜬다 (완료 리빌의 짝)
  const [startFx, setStartFx] = useState(false);
  const startFxTimer = useRef<number | undefined>(undefined);
  const [startFxLeaving, setStartFxLeaving] = useState(false);
  const startFxTimer2 = useRef<number | undefined>(undefined);
  function playStartFx() {
    setShowAdd(false); // 업로드 창은 내려간다 — 분석은 백그라운드 (전역 자르르 필 + 진행 칩이 잇는다)
    setStartFx(true);
    setStartFxLeaving(false);
    window.clearTimeout(startFxTimer.current);
    window.clearTimeout(startFxTimer2.current);
    // #31 코멘트: 뚝 사라지지 않게 — 1.5초 보여주고 0.5초에 걸쳐 잦아든다
    startFxTimer.current = window.setTimeout(() => setStartFxLeaving(true), 1500);
    startFxTimer2.current = window.setTimeout(() => setStartFx(false), 2000);
  }

  // ── 업로드 큐 ──
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // ── 수동 입력 ──
  const [showManual, setShowManual] = useState(false);
  const [manualTitleEdited, setManualTitleEdited] = useState(false);
  const [manualSplit, setManualSplit] = useState(""); // #33 엔빵 인원
  const [manualSource, setManualSource] = useState<string | null>(null); // #37+#38 수익원
  const [manualForm, setManualForm] = useState(() => {
    const d = todayStr();
    return { date: d, title: makeDefaultTitle(d, "식비"), category: "식비", originalAmount: "", actualAmount: "", description: "", memo: "" };
  });

  // #47 — 수익원 목록 (기본 9종 + 내 커스텀) — 큐 select 옵션용
  const incomeSourceList = useIncomeSourceList();

  // ── AI 이미지 처리 ──
  const processFile = useCallback(async (file: File, itemId: string) => {
    analyzingStart(); // 전역 분석 표시 (모든 탭에서 보임)
    try {
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
      incomeSource: result.incomeSource, // #37+#38 — AI 분류 (큐에서 수정 가능)
      // #43 — 단체면 '내 몫'이 바로 꽂힌다 (서버가 균등 분배 계산). 단독이면 단골 우선(P2).
      originalAmount: String(result.myShare?.originalAmount ?? result.prior?.originalAmount ?? result.estimatedOriginalAmount),
      priorDate: result.prior?.date,
      priorUsualActual: result.prior?.usualActual,
      nSplit: result.myShare ? String(result.myShare.peopleCount) : undefined,
      groupOriginal: result.myShare?.groupOriginalAmount,
      groupActual: result.myShare?.groupActualAmount,
      actualAmount: String(result.myShare?.actualAmount ?? result.estimatedActualAmount),
      aiReason: result.reason,
      date,
      imageUrl: finalImageUrl,
      aiOriginalAmount: result.estimatedOriginalAmount,
      aiActualAmount: result.estimatedActualAmount,
    } : it));
    } finally {
      analyzingEnd();
    }
  }, [analyzeImage, uploadCroppedImage]);

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
      aiReason: "", date: todayStr(), memo: "", incomeSource: null,
    }));

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

    playStartFx(); // #31 — 시트 내려가고 시작 연출
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processFile, categoryNames]);

  const retryQueueItem = useCallback((item: QueueItem) => {
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "analyzing" as const } : it));
    processFile(item.file, item.id).catch(() => {
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
    });
  }, [processFile]);

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
        incomeSource: item.incomeSource ?? undefined,
        originalAmount: Number(item.originalAmount),
        actualAmount: Number(item.actualAmount),
        aiEstimated: "yes",
        aiOriginalAmount: item.aiOriginalAmount,
        aiActualAmount: item.aiActualAmount,
        aiReason: item.aiReason,
        // #43 — 전체 추론값 보존 (파인튜닝·데이터 해자)
        aiPeopleCount: item.nSplit ? Number(item.nSplit) || undefined : undefined,
        aiGroupOriginalAmount: item.groupOriginal,
        aiGroupActualAmount: item.groupActual,
        imageUrl: item.imageUrl,
        memo: item.memo || undefined,
      });
      const saved = Math.max(0, Number(item.originalAmount) - Number(item.actualAmount));
      const actualNum = Number(item.actualAmount);
      // #37+#38 — 보너스 기준은 유형 평소가(최근 실지출 중앙값). 유형을 바꿨어도 그 유형 기준으로 맞다.
      const su = incomeSourceUsual(entries as SavingsEntry[], item.incomeSource);
      const bonus = su != null && actualNum < su.usualActual ? su.usualActual - actualNum : undefined;
      if (saved > 0) celebrateSave({ profit: saved, title: item.title || item.fileName, bonus });
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
        incomeSource: manualSource ?? undefined,
        originalAmount: Number(manualForm.originalAmount),
        actualAmount: Number(manualForm.actualAmount),
        description: manualForm.description || undefined,
        memo: manualForm.memo || undefined,
        aiEstimated: "no",
      });
      const manualSaved = Number(manualForm.originalAmount) - Number(manualForm.actualAmount);
      // #37+#38 — 보너스 기준은 유형 평소가(최근 실지출 중앙값)
      const manualActual = Number(manualForm.actualAmount);
      const manualSu = incomeSourceUsual(entries as SavingsEntry[], manualSource);
      const manualBonus = manualSu && manualActual < manualSu.usualActual ? manualSu.usualActual - manualActual : undefined;
      if (manualSaved > 0) celebrateSave({ profit: manualSaved, title: manualForm.title, bonus: manualBonus });
      else toast.success("등록됐습니다");
      const d = todayStr();
      setManualForm({ date: d, title: makeDefaultTitle(d, "식비"), category: "식비", originalAmount: "", actualAmount: "", description: "", memo: "" });
      setManualSource(null);
      setManualTitleEdited(false);
      setShowManual(false);
    } catch {
      toast.error("등록에 실패했습니다");
    }
  };

  const handleManualDateChange = (date: string) => {
    setManualForm(f => ({ ...f, date, title: manualTitleEdited ? f.title : makeDefaultTitle(date, f.category) }));
  };
  const handleManualCategoryChange = (category: string) => {
    setManualForm(f => ({ ...f, category, title: manualTitleEdited ? f.title : makeDefaultTitle(f.date, category) }));
  };

  const analyzingCount = queue.filter(q => q.status === "analyzing").length;
  const readyCount = queue.filter(q => q.status !== "analyzing").length;
  const todayFull = todayStr();

  // ── 로그인/로딩 ──
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

      {/* ── 헤더 ── */}
      <header className="pt-12 pb-4 flex items-center justify-between">
        <p className="text-title font-semibold text-ink">장부</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 pl-2.5 pr-3.5 py-2 rounded-full bg-emerald-500 text-white text-caption font-medium shadow-sm shadow-emerald-500/30 active:scale-95 transition-transform"
        >
          <Plus size={15} /> 기록 추가
        </button>
      </header>

      {/* ── 분석 진행 칩 ── */}
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

      {/* ── 월 네비 + 달력 토글 (주간 필터 중엔 숨김) ── */}
      {!weekFilter && (
        <div className="flex items-center justify-between mb-1">
          <button onClick={prevMonth} aria-label="이전 달" className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-ink-soft active:bg-line/60 active:scale-95 transition-all">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => monthInputRef.current?.showPicker?.() ?? monthInputRef.current?.click()}
              className="text-body font-medium text-ink active:text-emerald-600 transition-colors flex items-center gap-1"
            >
              {year}년 {month + 1}월
              <ChevronDown size={12} className="text-ink-soft" />
            </button>
            {(
              <button
                onClick={toggleCal}
                aria-label="달력 보기"
                className={`ml-1 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showCal ? "text-emerald-600 bg-emerald-50" : "text-ink-soft active:bg-line/60"}`}
              >
                <CalendarDays size={15} />
              </button>
            )}
          </div>
          <button onClick={nextMonth} aria-label="다음 달" className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-ink-soft active:bg-line/60 active:scale-95 transition-all">
            <ChevronRight size={16} />
          </button>
          <input ref={monthInputRef} type="month" value={ym} onChange={handleMonthJump} className="sr-only" tabIndex={-1} />
        </div>
      )}

      {/* 주간 필터 브레드크럼 (달력 주 선택·회장님 결산 딥링크 공용) */}
      {weekFilter && (
        <div className="flex items-center gap-1.5 mb-2.5 px-1 text-caption">
          <button onClick={() => setWeekFilter(null)} className="text-ink-soft underline-offset-2 active:text-ink transition-colors">
            전체
          </button>
          <ChevronRight size={11} className="text-ink-faint" />
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            {weekFilter.start.slice(5).replace("-", ".")} ~ {weekFilter.end.slice(5).replace("-", ".")} 주간
            <button onClick={() => setWeekFilter(null)} aria-label="필터 해제" className="w-4 h-4 rounded-full bg-line/70 flex items-center justify-center text-ink-soft active:bg-line">
              <X size={9} />
            </button>
          </span>
        </div>
      )}

      {/* ── #37+#38 수익원 필터 칩 — 현재 기간에 있는 유형만, 끝에 '관리' ── */}
      {(dateScoped.length > 0 || sourceFilter) && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setSourceFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-caption transition-colors ${
              !sourceFilter ? "bg-ink text-white" : "bg-white border border-line text-ink-soft active:bg-cream"
            }`}
          >
            전체
          </button>
          {incomeSourceList.filter((src) => (sourceCounts.get(src) ?? 0) > 0 || sourceFilter === src).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(sourceFilter === src ? null : src)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-caption transition-colors ${
                sourceFilter === src ? "bg-gold text-white" : "bg-white border border-line text-ink-soft active:bg-cream"
              }`}
            >
              {src} <span className="tabular-nums opacity-70">{sourceCounts.get(src) ?? 0}</span>
            </button>
          ))}
          {((sourceCounts.get(UNCLASSIFIED_KEY) ?? 0) > 0 || sourceFilter === UNCLASSIFIED_KEY) && (
            <button
              onClick={() => setSourceFilter(sourceFilter === UNCLASSIFIED_KEY ? null : UNCLASSIFIED_KEY)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-caption transition-colors ${
                sourceFilter === UNCLASSIFIED_KEY ? "bg-ink-soft text-white" : "bg-white border border-dashed border-line text-ink-faint active:bg-cream"
              }`}
            >
              {UNCLASSIFIED} <span className="tabular-nums opacity-70">{sourceCounts.get(UNCLASSIFIED_KEY) ?? 0}</span>
            </button>
          )}
          <button
            onClick={() => setShowSources(true)}
            className="shrink-0 px-3 py-1.5 rounded-full text-caption bg-white border border-line text-emerald-600 font-medium active:bg-emerald-50 transition-colors"
          >
            관리
          </button>
        </div>
      )}

      {/* ════════ 기록 ════════ */}
      {(
        <section className="mb-6">
          {/* 접이식 달력 — 날짜 탭하면 그 날만 필터 */}
          {showCal && !weekFilter && (
            <div className="bg-white border border-line rounded-card px-2 py-3 mb-3">
              <div className="grid grid-cols-8 mb-1">
                {KO_DAYS.map((d, i) => (
                  <div key={d} className={`text-center text-micro py-0.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-ink-soft"}`}>{d}</div>
                ))}
                <div />
              </div>
              {calWeeks.map((week, wi) => {
                // 이 주의 실제 날짜 범위 (주간 보기용)
                const firstD = week.find((d) => d !== null);
                const lastD = [...week].reverse().find((d) => d !== null);
                const weekStart = firstD ? `${ym}-${String(firstD).padStart(2, "0")}` : null;
                const weekEnd = lastD ? `${ym}-${String(lastD).padStart(2, "0")}` : null;
                return (
                  <div key={wi} className="grid grid-cols-8">
                    {week.map((day, di) => {
                      if (day === null) return <div key={`e${wi}-${di}`} />;
                      const ds = `${ym}-${String(day).padStart(2, "0")}`;
                      const profit = profitByDate[ds];
                      const selected = filterDate === ds;
                      const isToday = ds === todayFull;
                      return (
                        <button
                          key={ds}
                          onClick={() => setFilterDate(selected ? null : ds)}
                          className="flex flex-col items-center py-1 min-h-[42px] rounded-lg active:bg-line/50 transition-colors"
                        >
                          <span className={`text-caption w-6 h-6 flex items-center justify-center rounded-full ${
                            selected ? "bg-emerald-500 text-white font-semibold"
                            : isToday ? "border border-gold/60 text-ink font-medium"
                            : "text-ink"
                          }`}>{day}</span>
                          {/* 금액 숫자 — 점보다 정보가 많다 (피드백) */}
                          {profit !== undefined && (
                            <span className="text-emerald-500 font-medium leading-tight tabular-nums" style={{ fontSize: "8.5px" }}>
                              +{fmt(profit)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* 주 단위 보기 (피드백 4) */}
                    <button
                      onClick={() => weekStart && weekEnd && setWeekFilter({ start: weekStart, end: weekEnd })}
                      aria-label="이 주만 보기"
                      className="flex items-center justify-center text-ink-faint active:text-emerald-500 transition-colors"
                      title="이 주만 보기"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                );
              })}
              <p className="text-center text-micro text-ink-faint mt-1.5">날짜를 누르면 그날만 · 오른쪽 화살표는 그 주만</p>
            </div>
          )}

          {/* 날짜 필터 칩 */}
          {/* 필터 브레드크럼 — 배너보다 조용하게, 경로처럼 (피드백 #15 재작업) */}
          {filterDate && (
            <div className="flex items-center gap-1.5 mb-2.5 px-1 text-caption">
              <button onClick={() => setFilterDate(null)} className="text-ink-soft underline-offset-2 active:text-ink transition-colors">
                {month + 1}월 전체
              </button>
              <ChevronRight size={11} className="text-ink-faint" />
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                {(() => { const d = new Date(filterDate + "T00:00:00"); return `${d.getDate()}일 (${KO_DAYS[d.getDay()]})`; })()}
                <button onClick={() => setFilterDate(null)} aria-label="필터 해제" className="w-4 h-4 rounded-full bg-line/70 flex items-center justify-center text-ink-soft active:bg-line">
                  <X size={9} />
                </button>
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-line rounded-lg animate-pulse" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10">
              <Jarureu level={0.12} size={64} />
              <p className="text-body font-medium text-ink mt-3">
                {(entries as SavingsEntry[]).length === 0 ? "아직 장부가 비어 있어요" : "이 기간엔 기록이 없어요"}
              </p>
              {(entries as SavingsEntry[]).length === 0 && (
                <>
                  <p className="text-caption text-ink-soft mt-1">사진 한 장이면 자르르가 첫 수익을 찾아드려요</p>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white text-caption font-medium active:scale-95 transition-transform"
                  >
                    <Camera size={14} /> 첫 기록 남기기
                  </button>
                </>
              )}
            </div>
          ) : (
            <div>
              {groups.map(([date, items]) => {
                const d = new Date(date + "T00:00:00");
                const dayTotal = items.reduce((s, e) => s + e.profit, 0);
                return (
                  <div key={date} className="mb-1">
                    {/* 날짜 그룹 헤더 — 장부의 뼈대 */}
                    <div className="flex items-baseline justify-between pt-3 pb-1.5 px-1">
                      <span className="text-caption font-medium text-ink-soft">
                        {d.getDate()}일 <span className={d.getDay() === 0 ? "text-red-400" : d.getDay() === 6 ? "text-blue-400" : ""}>({KO_DAYS[d.getDay()]})</span>
                        {date === todayFull && <span className="ml-1.5 text-micro text-emerald-600">오늘</span>}
                      </span>
                      <span className="text-caption font-mono text-emerald-600 tabular-nums">+₩{fmt(dayTotal)}</span>
                    </div>
                    <div className="bg-white border border-line rounded-card overflow-hidden">
                      {items.map((entry, i) => (
                        <button
                          key={entry.id}
                          onClick={() => setDetailEntry(entry)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-cream transition-colors ${i > 0 ? "border-t border-line" : ""}`}
                        >
                          {entry.imageUrl
                            ? <img src={entry.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            : <div className="w-10 h-10 rounded-lg bg-line flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-body font-medium text-ink truncate">{entry.title}</p>
                            {entry.memo
                              ? <p className="text-caption text-ink-soft truncate italic">{entry.memo}</p>
                              : <p className="text-caption text-ink-faint truncate">{entry.category}{entry.incomeSource ? ` · ${entry.incomeSource}` : ""}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-body font-mono font-semibold text-emerald-500 tabular-nums">+₩{fmt(entry.profit)}</p>
                            <p className="text-micro text-ink-faint tabular-nums">
                              <span className="line-through">₩{fmt(entry.originalAmount)}</span>
                              <span className="mx-0.5">→</span>₩{fmt(entry.actualAmount)}
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-ink-faint flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* 월 합계 */}
              {!filterDate && !weekFilter && groups.length > 0 && (
                <div className="flex justify-between items-center mt-4 px-1">
                  <span className="text-caption text-ink-soft">
                    {month + 1}월{sourceFilter ? ` ${sourceFilter === UNCLASSIFIED_KEY ? UNCLASSIFIED : sourceFilter}` : ""} 합계 · {displayEntries.length}건
                  </span>
                  <span className="text-body font-mono font-semibold text-emerald-600 tabular-nums">
                    +₩{fmt(sourceFilter ? displayEntries.reduce((t, e) => t + e.profit, 0) : monthTotal)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

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

            {/* 사진 업로드 영역 — 업로드가 시작되면 큰 드롭존은 내려가고 컴팩트 행으로 (#31) */}
            {queue.length === 0 ? (
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
                <button
                  onClick={openCamera}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 text-caption text-ink-soft border border-line rounded-lg active:border-emerald-300 active:text-emerald-600 transition-colors"
                >
                  <Camera size={14} /> 카메라로 촬영
                </button>
              </section>
            ) : (
              <section className="mb-4 flex gap-2">
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-caption text-ink-soft border border-dashed border-line rounded-lg active:border-emerald-300 active:text-emerald-600 transition-colors"
                >
                  <Upload size={14} /> 사진 더 올리기
                </button>
                <button
                  onClick={openCamera}
                  aria-label="카메라로 촬영"
                  className="px-4 py-2.5 text-ink-soft border border-line rounded-lg active:border-emerald-300 active:text-emerald-600 transition-colors"
                >
                  <Camera size={14} />
                </button>
              </section>
            )}

            {/* 업로드 큐 */}
            {queue.length > 0 && (
              <section className="mb-5 space-y-3">
                <p className="text-caption font-mono text-ink-soft tracking-widest uppercase">분석 대기열 ({queue.length})</p>
                {queue.map(item => (
                  <div key={item.id} className="border border-line rounded-card overflow-hidden animate-bubble-in">
                    {item.dup && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-micro text-amber-700">
                        <Copy size={12} /> 이미 추가한 사진과 같아 보여요
                      </div>
                    )}
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
                            <div className="flex gap-2 mt-1.5 flex-wrap">
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
                              <select
                                value={item.incomeSource ?? ""}
                                onChange={e => {
                                  const v = e.target.value || null;
                                  // #47 — 고정가 유형은 실지출 자동 채움 (생성 플로우, 수정 가능)
                                  const patch: Partial<QueueItem> = { incomeSource: v };
                                  if (v != null && FIXED_ACTUAL[v] !== undefined) patch.actualAmount = String(FIXED_ACTUAL[v]);
                                  updateQueueItem(item.id, patch);
                                }}
                                className={`text-caption border-0 border-b border-line focus:outline-none focus:border-emerald-300 bg-transparent ${item.incomeSource ? "text-gold" : "text-ink-faint"}`}
                              >
                                <option value="">수익원 — {UNCLASSIFIED}</option>
                                {incomeSourceList.map((src) => <option key={src} value={src}>{src}</option>)}
                              </select>
                            </div>
                          </div>
                          <button onClick={() => removeQueueItem(item.id)} className="p-1 text-ink-faint active:text-ink-soft flex-shrink-0">
                            <X size={14} />
                          </button>
                        </div>

                        <div className="flex items-baseline justify-between rounded-card bg-emerald-50 px-3 py-2.5">
                          <span className="text-micro font-medium text-emerald-700/70">이번에 번 돈</span>
                          <span className="font-mono text-xl font-extrabold tabular-nums text-emerald-600">
                            {item.originalAmount && item.actualAmount
                              ? `+₩${fmt(Math.max(0, Number(item.originalAmount) - Number(item.actualAmount)))}`
                              : "—"}
                          </span>
                        </div>

                        {/* #43 — 객관 지표 라벨 (AI가 추정해 채워둔 값, 사용자가 확정) */}
                        <div className="flex items-center gap-2 px-1 text-micro text-ink-soft">
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

                        {item.priorDate && (
                          <p className="text-micro text-emerald-600/80">원가는 지난번 확정가 기준 ({item.priorDate.slice(5).replace("-", ".")})</p>
                        )}

                        {/* #43 — 인원: 객관 지표. AI가 채워두고, 바꾸면 내 몫이 즉시 재계산된다 (적용 버튼 없음) */}
                        <div className="flex items-center gap-2 px-1 text-micro text-ink-soft">
                          <span className="flex items-center gap-1">인원
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={item.nSplit ?? "1"}
                              onChange={e => {
                                const v = e.target.value;
                                const n = Number(v);
                                const baseO = item.groupOriginal ?? item.aiOriginalAmount ?? (Number(item.originalAmount) || 0);
                                const baseA = item.groupActual ?? item.aiActualAmount ?? (Number(item.actualAmount) || 0);
                                if (n >= 1 && Number.isFinite(n)) {
                                  updateQueueItem(item.id, {
                                    nSplit: v,
                                    originalAmount: String(Math.round(baseO / n)),
                                    actualAmount: String(Math.round(baseA / n)),
                                  });
                                } else {
                                  updateQueueItem(item.id, { nSplit: v });
                                }
                              }}
                              className="w-12 border-0 border-b border-line bg-transparent text-right tabular-nums text-ink-soft focus:border-emerald-400 focus:outline-none"
                            />
                          </span>
                          명
                        </div>
                        {item.groupOriginal != null && Number(item.nSplit) >= 2 && (
                          <p className="text-micro text-ink-faint px-1">
                            전체 약 ₩{fmt(item.groupOriginal)}(원가)·₩{fmt(item.groupActual ?? 0)}(실제)를 {item.nSplit}명 기준으로 나눈 내 몫이에요
                          </p>
                        )}

                        <input
                          value={item.memo}
                          onChange={e => updateQueueItem(item.id, { memo: e.target.value })}
                          placeholder="내 썰 한 줄 (선택)"
                          className="w-full text-caption border border-line rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400"
                        />

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
                    <label className="text-caption text-ink-soft mb-1 block">수익원 (어떻게 번 돈인가요?)</label>
                    <IncomeSourceChips
                      value={manualSource}
                      onChange={(v) => {
                        setManualSource(v);
                        // #47 — 고정가 유형은 실지출 자동 채움 (수정 가능)
                        if (v != null && FIXED_ACTUAL[v] !== undefined)
                          setManualForm((f) => ({ ...f, actualAmount: String(FIXED_ACTUAL[v]) }));
                      }}
                      allowNone
                    />
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
                  {/* #33 엔빵 — 총액을 적은 뒤 인원으로 나누기 */}
                  <div className="flex items-center gap-2 text-caption text-ink-soft">
                    <span>엔빵</span>
                    <input
                      type="number" min={2} max={30} placeholder="인원"
                      value={manualSplit}
                      onChange={e => setManualSplit(e.target.value)}
                      className="w-14 border border-line rounded-lg px-2 py-1 text-right tabular-nums focus:outline-none focus:border-emerald-400"
                    />
                    명
                    {Number(manualSplit) >= 2 && manualForm.originalAmount && (
                      <button
                        type="button"
                        onClick={() => {
                          const n = Number(manualSplit);
                          setManualForm(f => ({
                            ...f,
                            originalAmount: String(Math.round((Number(f.originalAmount) || 0) / n)),
                            actualAmount: f.actualAmount ? String(Math.round((Number(f.actualAmount) || 0) / n)) : f.actualAmount,
                          }));
                          setManualSplit("");
                        }}
                        className="px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-600 active:bg-emerald-50 transition-colors"
                      >
                        ÷ 나누기
                      </button>
                    )}
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

      {/* 기록 상세 — 보기·수정·삭제·공유 */}
      {detailEntry && (
        <EntryDetailSheet
          entry={detailEntry}
          categoryNames={categoryNames}
          onClose={() => setDetailEntry(null)}
        />
      )}

      {/* #31 — 분석 시작 연출 (완료 리빌의 짝). 끝날 땐 0.5초 페이드아웃으로 잦아든다 */}
      {startFx && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center pointer-events-none"
          style={{
            background: "rgba(22,32,26,0.85)",
            animation: startFxLeaving ? "sfxOut .5s ease forwards" : "adFade .25s ease",
          }}
        >
          <style>{`@keyframes sfxOut{from{opacity:1}to{opacity:0}}@keyframes adFade{from{opacity:0}to{opacity:1}}`}</style>
          <div style={{ animation: "prop-in .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <Jarureu level={0.5} size={96} analyzing />
          </div>
          <p className="mt-4 text-body font-medium" style={{ color: "#d8cfae" }}>자르르가 살펴보기 시작했어요</p>
          <p className="mt-1 text-caption" style={{ color: "#7E8C82" }}>끝나면 알려드릴게요 — 다른 일 보셔도 됩니다</p>
        </div>
      )}

      {/* #37+#38 — 수익원 통계·관리 */}
      {showSources && (
        <IncomeSourceSheet
          entries={entries as SavingsEntry[]}
          onClose={() => setShowSources(false)}
          onPick={(key) => { setSourceFilter(key); setShowSources(false); }}
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
