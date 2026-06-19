import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";
import { sha256File } from "@/lib/fingerprint";
import { smartCropToSquare } from "@/lib/smartCrop";
import { fileToCompressedBase64 } from "@/lib/compressImage";
import { useIncomeSourceList } from "@/components/IncomeSourceChips";
import { LEDGER_LABELS } from "@shared/ledgerLabels";
import { amountsForProfitKind, inferProfitKind, type ProfitKind } from "@shared/profitKinds";
import { SavingsEntry, todayStr, makeDefaultTitle, incomeSourceUsual } from "@/lib/ledger";
import { celebrateSave } from "@/lib/celebrate";
import { analyzingStart, analyzingEnd } from "@/lib/analyzing";
import type { trpc } from "@/lib/trpc";
import { fileSig, type QueueItem } from "./types";

type CreateMut = ReturnType<typeof trpc.savings.create.useMutation>;
type AnalyzeMut = ReturnType<typeof trpc.ai.analyzeImage.useMutation>;
type UploadMut = ReturnType<typeof trpc.ai.uploadImage.useMutation>;

export function useLedgerCaptureQueue(
  entries: SavingsEntry[],
  categoryNames: string[],
  openAddNonce: number,
  createEntry: CreateMut,
  analyzeImage: AnalyzeMut,
  uploadCroppedImage: UploadMut,
) {
  const [showAdd, setShowAdd] = useState(false);
  const [startFx, setStartFx] = useState(false);
  const startFxTimer = useRef<number | undefined>(undefined);
  const [startFxLeaving, setStartFxLeaving] = useState(false);
  const startFxTimer2 = useRef<number | undefined>(undefined);

  function playStartFx() {
    setShowAdd(false);
    setStartFx(true);
    setStartFxLeaving(false);
    window.clearTimeout(startFxTimer.current);
    window.clearTimeout(startFxTimer2.current);
    startFxTimer.current = window.setTimeout(() => setStartFxLeaving(true), 1500);
    startFxTimer2.current = window.setTimeout(() => setStartFx(false), 2000);
  }

  useEffect(() => {
    if (openAddNonce <= 0) return;
    setShowAdd(true);
    setShowManual(true);
  }, [openAddNonce]);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [showManual, setShowManual] = useState(false);
  const [manualTitleEdited, setManualTitleEdited] = useState(false);
  const [manualSplit, setManualSplit] = useState("");
  const [manualSource, setManualSource] = useState<string | null>(null);
  const [manualProfitKind, setManualProfitKind] = useState<ProfitKind>("save");
  const [manualForm, setManualForm] = useState(() => {
    const d = todayStr();
    return { date: d, title: makeDefaultTitle(d, "식비"), category: "식비", originalAmount: "", actualAmount: "", description: "", memo: "" };
  });

  const incomeSourceList = useIncomeSourceList();

  const processFile = useCallback(async (file: File, itemId: string, opts?: { ignoreDup?: boolean }) => {
    analyzingStart();
    try {
      const exifDate = await getExifDate(file);
      const date = exifDate ?? todayStr();
      const imageSig = await sha256File(file);

      const { base64, mimeType: uploadMime } = await fileToCompressedBase64(file);

      const result = await analyzeImage.mutateAsync({
        imageBase64: base64,
        mimeType: uploadMime,
        imageSig: imageSig ?? undefined,
        ignoreDuplicate: opts?.ignoreDup ?? false,
      });

      if (result.duplicate) {
        setQueue(prev => prev.map(it => it.id === itemId
          ? { ...it, status: "duplicate" as const, dupInfo: result.duplicate!, imageSig: imageSig ?? undefined }
          : it));
        return;
      }

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
      } catch { /* crop fail — keep original */ }

      const autoTitle = makeDefaultTitle(date, result.category);
      const readyOriginal = result.myShare?.originalAmount ?? result.prior?.originalAmount ?? result.estimatedOriginalAmount;
      const readyActual = result.myShare?.actualAmount ?? result.estimatedActualAmount;

      setQueue(prev => prev.map(it => it.id === itemId ? {
        ...it,
        status: "ready" as const,
        title: autoTitle,
        category: result.category,
        incomeSource: result.incomeSource,
        profitKind: inferProfitKind(result.incomeSource, readyOriginal, readyActual),
        userPriceNote: "",
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
        savingsSteps: result.savingsSteps?.map((st) => ({ ...st, amount: Math.max(1, Math.round(st.amount / (result.myShare?.peopleCount || 1))) })),
        imageSig: imageSig ?? undefined,
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
      profitKind: "save", userPriceNote: "",
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

    playStartFx();
  }, [processFile, categoryNames]);

  const retryQueueItem = useCallback((item: QueueItem) => {
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "analyzing" as const } : it));
    processFile(item.file, item.id).catch(() => {
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
    });
  }, [processFile]);

  const forceQueueItem = useCallback((item: QueueItem) => {
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "analyzing" as const, dupInfo: undefined } : it));
    processFile(item.file, item.id, { ignoreDup: true }).catch(() => {
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: "error" as const } : it));
    });
  }, [processFile]);

  const handleQueueConfirm = async (item: QueueItem) => {
    const o = Number(item.originalAmount);
    const a = Number(item.actualAmount);
    const kind = item.profitKind ?? inferProfitKind(item.incomeSource, o, a);
    if (!item.originalAmount || (kind !== "earn" && item.actualAmount === "")) {
      toast.error(`${LEDGER_LABELS.original}과 ${LEDGER_LABELS.actual}을 입력해주세요`);
      return;
    }
    const normalized = amountsForProfitKind(kind, o, a);
    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, submitting: true } : it));
    try {
      await createEntry.mutateAsync({
        date: item.date,
        title: item.title || item.fileName,
        category: item.category,
        incomeSource: item.incomeSource ?? undefined,
        originalAmount: normalized.originalAmount,
        actualAmount: normalized.actualAmount,
        profitKind: kind,
        userPriceNote: item.userPriceNote.trim() || undefined,
        aiEstimated: "yes",
        aiOriginalAmount: item.aiOriginalAmount,
        aiActualAmount: item.aiActualAmount,
        savingsSteps: item.savingsSteps,
        aiReason: item.aiReason,
        aiPeopleCount: item.nSplit ? Number(item.nSplit) || undefined : undefined,
        aiGroupOriginalAmount: item.groupOriginal,
        aiGroupActualAmount: item.groupActual,
        imageUrl: item.imageUrl,
        imageSig: item.imageSig,
        memo: item.memo || undefined,
      });
      const saved = normalized.profit;
      const actualNum = normalized.actualAmount;
      const su = incomeSourceUsual(entries, item.incomeSource);
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const o = Number(manualForm.originalAmount);
    const a = Number(manualForm.actualAmount);
    if (!manualForm.title || !manualForm.originalAmount) return;
    if (manualProfitKind !== "earn" && manualForm.actualAmount === "") return;
    const normalized = amountsForProfitKind(manualProfitKind, o, a);
    try {
      await createEntry.mutateAsync({
        date: manualForm.date,
        title: manualForm.title,
        category: manualForm.category,
        incomeSource: manualSource ?? undefined,
        originalAmount: normalized.originalAmount,
        actualAmount: normalized.actualAmount,
        profitKind: manualProfitKind,
        description: manualForm.description || undefined,
        memo: manualForm.memo || undefined,
        aiEstimated: "no",
      });
      const manualSaved = normalized.profit;
      const manualActual = normalized.actualAmount;
      const manualSu = incomeSourceUsual(entries, manualSource);
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

  return {
    showAdd, setShowAdd,
    startFx, startFxLeaving,
    queue, cameraRef, galleryRef,
    showManual, setShowManual,
    manualTitleEdited, setManualTitleEdited,
    manualSplit, setManualSplit,
    manualSource, setManualSource,
    manualProfitKind, setManualProfitKind,
    manualForm, setManualForm,
    incomeSourceList,
    openCamera, handleFiles, retryQueueItem, forceQueueItem,
    handleQueueConfirm, removeQueueItem, updateQueueItem,
    handleManualSubmit, handleManualDateChange, handleManualCategoryChange,
    processFile, analyzingCount, readyCount,
  };
}
