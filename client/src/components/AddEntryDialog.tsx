// ============================================================
// 절약 수익 리포트 — 수익 등록 다이얼로그
// UX: AI가 모든 필드 자동 추정 → 수정할 부분만 확인 → 원탭 등록
// ============================================================

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, PlusCircle, CheckCircle2, Camera, MessageSquare, PenLine,
  Loader2, Sparkles, Upload, X, ChevronRight, AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";

const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"] as const;
type Category = (typeof CATEGORIES)[number];
const DEFAULT_CATEGORIES: string[] = [...CATEGORIES];
type InputMode = "photo" | "sms" | "manual";

export interface AddEntryData {
  date: string;
  title: string;
  description?: string;
  originalAmount: number;
  actualAmount: number;
  category: string;
  aiEstimated: "yes" | "no";
  aiReason?: string;
  imageUrl?: string;
  // 데이터 해자: AI가 처음 추정했던 원본값(사용자 수정과 무관하게 보관). AI 경로에서만 채워짐.
  aiOriginalAmount?: number;
  aiActualAmount?: number;
}

interface Props {
  onAdd: (data: AddEntryData) => void;
  fullWidth?: boolean;
  categoryNames?: string[];
  fabStyle?: boolean; // 하단 탭바 FAB 스타일
}

interface AnalyzedItem {
  id: string;
  previewUrl: string;
  fileName: string;
  status: "pending" | "analyzing" | "done" | "error";
  title: string;
  category: Category;
  originalAmount: string;
  actualAmount: string;
  aiReason: string;
  confidence: "high" | "medium" | "low";
  date: string;
  description: string;
  selected: boolean;
  imageUrl?: string; // S3 저장 URL
  // 데이터 해자: AI 추정 원본값 보관(폼에서 사용자가 originalAmount/actualAmount를 고쳐도 유지)
  aiOriginalAmount?: number;
  aiActualAmount?: number;
}

const today = new Date().toISOString().split("T")[0];

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-emerald-600", medium: "text-amber-500", low: "text-red-500",
};
const CONFIDENCE_LABEL: Record<string, string> = {
  high: "HIGH", medium: "MED", low: "LOW",
};

interface ManualForm {
  date: string; title: string; description: string;
  originalAmount: string; actualAmount: string;
  category: Category; aiEstimated: "yes" | "no"; aiReason: string;
}

const defaultManual = (): ManualForm => ({
  date: today, title: "", description: "", originalAmount: "",
  actualAmount: "", category: "식비", aiEstimated: "no", aiReason: "",
});

export default function AddEntryDialog({ onAdd, fullWidth = false, categoryNames, fabStyle = false }: Props) {
  const availableCategories = categoryNames && categoryNames.length > 0 ? categoryNames : DEFAULT_CATEGORIES;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>("photo");
  const [confirmedCount, setConfirmedCount] = useState(0);

  const [items, setItems] = useState<AnalyzedItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [smsText, setSmsText] = useState("");
  const [manual, setManual] = useState<ManualForm>(defaultManual());

  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadCroppedImage = trpc.ai.uploadImage.useMutation();
  const parseSms = trpc.ai.parseSmsText.useMutation();

  // ── 이미지 분석 ──────────────────────────────────────────
  const analyzeFile = useCallback(async (file: File, itemId: string) => {
    // EXIF 날짜 먼저 추출 (비동기, 실패해도 무시)
    const exifDate = await getExifDate(file);
    if (exifDate) {
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, date: exifDate } : it));
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      if (!base64) return;
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: "analyzing" } : it));
      try {
        const result = await analyzeImage.mutateAsync({ imageBase64: base64, mimeType: file.type });
        // 스마트 크롭 적용
        let finalImageUrl = result.imageUrl;
        try {
          const { smartCropToSquare } = await import("@/lib/smartCrop");
          const croppedBlob = await smartCropToSquare(file, result.cropBox ?? { x: 0.5, y: 0.5 });
          const croppedBase64 = await new Promise<string>((res, rej) => {
            const r2 = new FileReader();
            r2.onload = (e2) => { const v = (e2.target?.result as string).split(",")[1]; if (v) res(v); else rej(); };
            r2.onerror = rej;
            r2.readAsDataURL(croppedBlob);
          });
          const cropResult = await uploadCroppedImage.mutateAsync({ imageBase64: croppedBase64, mimeType: "image/jpeg" });
          finalImageUrl = cropResult.imageUrl;
        } catch { /* 크롭 실패 시 원본 유지 */ }
        setItems(prev => prev.map(it => it.id === itemId ? {
          ...it, status: "done",
          title: result.title,
          category: result.category as Category,
          originalAmount: String(result.estimatedOriginalAmount),
          actualAmount: String(result.estimatedActualAmount),
          aiReason: result.reason,
          confidence: result.confidence,
          imageUrl: finalImageUrl,
          // 데이터 해자: 사용자 확정값과 비교할 AI 추정 원본 보관
          aiOriginalAmount: result.estimatedOriginalAmount,
          aiActualAmount: result.estimatedActualAmount,
        } : it));
      } catch {
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: "error" } : it));
      }
    };
    reader.readAsDataURL(file);
  }, [analyzeImage, uploadCroppedImage]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) { toast.error("이미지 파일만 업로드 가능합니다"); return; }
    const newItems: AnalyzedItem[] = arr.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      status: "pending" as const,
      title: "", category: "식비" as Category,
      originalAmount: "", actualAmount: "",
      aiReason: "", confidence: "medium" as const,
      date: today, description: "", selected: true,
    }));
    setItems(prev => [...prev, ...newItems]);
    newItems.forEach((item, idx) => analyzeFile(arr[idx], item.id));
  }, [analyzeFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeItem = (id: string) => setItems(prev => {
    const item = prev.find(it => it.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    return prev.filter(it => it.id !== id);
  });
  const updateItem = (id: string, patch: Partial<AnalyzedItem>) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  // ── 문자 파싱 ──────────────────────────────────────────────
  const handleParseSms = async () => {
    if (!smsText.trim()) return;
    try {
      const result = await parseSms.mutateAsync({ text: smsText });
      if (!result.parsed) { toast.error(`파싱 실패: ${result.reason}`); return; }
      setManual(f => ({
        ...f, title: result.merchant,
        category: result.category as Category,
        actualAmount: String(result.amount),
        date: result.date || today,
      }));
      setMode("manual");
      toast.success("결제 정보를 인식했습니다. 기준가를 확인해주세요.");
    } catch { toast.error("문자 파싱 실패. 다시 시도해주세요."); }
  };

  // ── 일괄 등록 ──────────────────────────────────────────────
  const handleBatchConfirm = () => {
    const selected = items.filter(it => it.selected && it.status === "done" && it.actualAmount && it.originalAmount);
    if (selected.length === 0) { toast.error("등록할 항목이 없습니다"); return; }
    selected.forEach(it => onAdd({
      date: it.date, title: it.title,
      description: it.description || undefined,
      originalAmount: Number(it.originalAmount),
      actualAmount: Number(it.actualAmount),
      category: it.category,
      aiEstimated: "yes", aiReason: it.aiReason,
      imageUrl: it.imageUrl,
      // 데이터 해자: 보관해둔 AI 추정 원본을 함께 전달(서버가 사용자 확정값과 비교해 보정 기록)
      aiOriginalAmount: it.aiOriginalAmount,
      aiActualAmount: it.aiActualAmount,
    }));
    setConfirmedCount(selected.length);
    setTimeout(() => {
      setConfirmedCount(0); setItems([]); setSmsText("");
      setManual(defaultManual()); setMode("photo"); setOpen(false);
    }, 1200);
  };

  // ── 수동 등록 ──────────────────────────────────────────────
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.title || !manual.originalAmount || !manual.actualAmount) return;
    onAdd({
      date: manual.date, title: manual.title,
      description: manual.description || undefined,
      originalAmount: Number(manual.originalAmount),
      actualAmount: Number(manual.actualAmount),
      category: manual.category,
      aiEstimated: manual.aiEstimated,
      aiReason: manual.aiReason || undefined,
    });
    setConfirmedCount(1);
    setTimeout(() => {
      setConfirmedCount(0); setManual(defaultManual()); setMode("photo"); setOpen(false);
    }, 900);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setItems(prev => { prev.forEach(it => URL.revokeObjectURL(it.previewUrl)); return []; });
      setSmsText(""); setManual(defaultManual()); setMode("photo"); setConfirmedCount(0);
    }
  };

  const readyItems = useMemo(() => items.filter(it => it.status === "done"), [items]);
  const selectedReady = useMemo(
    () => readyItems.filter(it => it.selected && it.actualAmount && it.originalAmount),
    [readyItems],
  );
  const manualProfit = useMemo(
    () => manual.originalAmount && manual.actualAmount
      ? Number(manual.originalAmount) - Number(manual.actualAmount) : null,
    [manual.originalAmount, manual.actualAmount],
  );
  const isAnalyzing = useMemo(
    () => items.some(it => it.status === "analyzing" || it.status === "pending"),
    [items],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {fabStyle ? (
          <button className="w-14 h-14 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-all">
            <PlusCircle size={28} className="text-white" />
          </button>
        ) : (
          <Button size="sm" className={`gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase rounded-md ${fullWidth ? "w-full text-sm h-12" : "h-8"}`}>
            <Plus size={fullWidth ? 16 : 12} /> {fullWidth ? "+ 절약 수익 등록하기" : "수익 등록"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className="font-mono rounded-sm max-h-[90vh] overflow-y-auto"
        style={{ fontFamily: "'JetBrains Mono', monospace", maxWidth: items.length > 0 ? "600px" : "440px" }}
      >
        <DialogHeader>
          <DialogTitle className="text-[11px] tracking-[0.2em] uppercase font-mono font-bold">
            NEW PROFIT ENTRY
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground tracking-wide">
            절약 수익을 포트폴리오에 등록합니다
          </p>
        </DialogHeader>

        {confirmedCount > 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-600">
              {confirmedCount > 1 ? `${confirmedCount} PROFITS CONFIRMED` : "PROFIT CONFIRMED"}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground">
              포트폴리오에 {confirmedCount}건의 수익이 반영되었습니다
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {/* ── 모드 탭 ── */}
            <div className="flex border border-border rounded-sm overflow-hidden">
              {([
                { id: "photo", icon: Camera, label: "사진 AI" },
                { id: "sms", icon: MessageSquare, label: "문자 파싱" },
                { id: "manual", icon: PenLine, label: "직접 입력" },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] tracking-widest uppercase transition-colors ${
                    mode === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                  }`}>
                  <Icon size={10} /> {label}
                </button>
              ))}
            </div>

            {/* ── 📷 사진 AI 탭 ── */}
            {mode === "photo" && (
              <div className="space-y-3">
                {/* 업로드 버튼 영역 */}
                <div
                  className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                    dragOver ? "border-emerald-400 bg-emerald-50" : "border-border"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles size={12} className="text-emerald-500" />
                    <p className="text-xs font-medium text-foreground">AI가 기준가 + 실제 지출 모두 추정해드려요</p>
                  </div>
                  {/* 카메라 / 갤러리 버튼 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all"
                    >
                      <Camera size={24} className="text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">카메라로 찍기</span>
                    </button>
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted border border-border hover:bg-muted/80 active:scale-95 transition-all"
                    >
                      <Upload size={24} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">갤러리에서 선택</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
                    여러 장 한꺼번에 가능 · JPG, PNG, WEBP
                  </p>
                </div>
                {/* 카메라 입력 (capture=environment) */}
                <input
                  ref={fileInputRef} type="file" accept="image/*"
                  multiple capture="environment" className="hidden"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                />
                {/* 갤러리 입력 (capture 없음) */}
                <input
                  ref={galleryInputRef} type="file" accept="image/*"
                  multiple className="hidden"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                />

                {/* 분석 결과 */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground flex items-center gap-1.5">
                        {isAnalyzing && <Loader2 size={9} className="animate-spin text-emerald-500" />}
                        ANALYSIS RESULTS ({items.length})
                      </p>
                      {readyItems.length > 0 && (
                        <span className="font-mono text-[9px] text-emerald-600">
                          {readyItems.length}/{items.length} 완료
                        </span>
                      )}
                    </div>

                    {items.map(item => (
                      <div key={item.id} className={`border rounded-sm overflow-hidden transition-colors ${
                        !item.selected ? "border-border opacity-50" :
                        item.status === "done" ? "border-emerald-200" : "border-border"
                      }`}>
                        {/* 카드 헤더 */}
                        <div className="flex items-center gap-2.5 p-2.5 bg-card">
                          <img src={item.previewUrl} alt={item.fileName}
                            className="w-10 h-10 object-cover rounded-sm border border-border flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            {item.status === "analyzing" || item.status === "pending" ? (
                              <div className="flex items-center gap-1.5">
                                <Loader2 size={11} className="text-emerald-500 animate-spin" />
                                <span className="font-mono text-[9px] text-emerald-600 tracking-widest uppercase">AI ANALYZING...</span>
                              </div>
                            ) : item.status === "error" ? (
                              <div className="flex items-center gap-1.5">
                                <AlertCircle size={11} className="text-red-500" />
                                <span className="font-mono text-[9px] text-red-500">분석 실패 — 직접 입력 탭을 이용해주세요</span>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-semibold text-foreground">{item.title}</span>
                                  <span className="font-mono text-[8px] px-1 py-0.5 rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-600">{item.category}</span>
                                  <span className={`font-mono text-[8px] font-bold ${CONFIDENCE_COLOR[item.confidence]}`}>
                                    {CONFIDENCE_LABEL[item.confidence]}
                                  </span>
                                </div>
                                <p className="font-mono text-[8px] text-muted-foreground/70 line-clamp-1">{item.aiReason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.status === "done" && (
                              <button
                                onClick={() => updateItem(item.id, { selected: !item.selected })}
                                className={`font-mono text-[8px] px-1.5 py-0.5 rounded-sm border transition-colors ${
                                  item.selected ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-border text-muted-foreground"
                                }`}
                              >
                                {item.selected ? "✓ 포함" : "제외"}
                              </button>
                            )}
                            <button onClick={() => removeItem(item.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                              <X size={11} />
                            </button>
                          </div>
                        </div>

                        {/* 편집 필드 — done + selected 상태만 */}
                        {item.status === "done" && item.selected && (
                          <div className="border-t border-border bg-muted/30 p-2.5 space-y-2">
                            {/* AI 추정 근거 배너 */}
                            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-sm bg-emerald-50 border border-emerald-100">
                              <Sparkles size={9} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              <p className="font-mono text-[8px] text-emerald-700 leading-relaxed">{item.aiReason}</p>
                            </div>

                            {/* 핵심 필드: 기준가 / 실제지출 / 날짜 */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-0.5">
                                <p className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                                  <Sparkles size={7} className="text-emerald-400" /> ORIGINAL
                                </p>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-mono">₩</span>
                                  <Input type="number" value={item.originalAmount}
                                    onChange={(e) => updateItem(item.id, { originalAmount: e.target.value })}
                                    className="font-mono text-[10px] pl-5 h-7 rounded-sm border-emerald-200 bg-white"
                                    min={0} />
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                                  <Sparkles size={7} className="text-emerald-400" /> ACTUAL
                                </p>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-mono">₩</span>
                                  <Input type="number" value={item.actualAmount}
                                    onChange={(e) => updateItem(item.id, { actualAmount: e.target.value })}
                                    className="font-mono text-[10px] pl-5 h-7 rounded-sm border-emerald-200 bg-white"
                                    min={0} />
                                </div>
                              </div>
              <div className="space-y-0.5">
                <p className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                  DATE
                  {item.date !== today && (
                    <span className="text-emerald-500 normal-case tracking-normal"> (EXIF)</span>
                  )}
                </p>
                <Input type="date" value={item.date}
                  onChange={(e) => updateItem(item.id, { date: e.target.value })}
                  className={`font-mono text-[10px] h-7 rounded-sm ${item.date !== today ? "border-emerald-200 bg-emerald-50/50" : ""}`} />
              </div>
                            </div>

                            {/* 수익 미리보기 */}
                            {item.originalAmount && item.actualAmount && (
                              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-emerald-50 border border-emerald-200">
                                <span className="font-mono text-[8px] text-emerald-600 uppercase tracking-wider">RECOGNIZED PROFIT</span>
                                <span className="font-mono text-sm font-bold text-emerald-700">
                                  ▲ +₩{Math.max(0, Number(item.originalAmount) - Number(item.actualAmount)).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 일괄 등록 버튼 */}
                    {readyItems.length > 0 && (
                      <Button
                        onClick={handleBatchConfirm}
                        disabled={selectedReady.length === 0}
                        className="w-full font-mono text-[10px] tracking-[0.15em] uppercase rounded-sm h-10 gap-2 mt-1"
                        size="lg"
                      >
                        <ChevronRight size={13} />
                        {selectedReady.length > 0
                          ? `CONFIRM ${selectedReady.length}건 TRADES`
                          : "항목을 선택해주세요"}
                      </Button>
                    )}
                  </div>
                )}

                {items.length === 0 && (
                  <p className="font-mono text-[9px] text-muted-foreground/60 text-center">
                    모바일에서는 카메라로 바로 찍을 수 있어요
                  </p>
                )}
              </div>
            )}

            {/* ── 📱 문자 파싱 탭 ── */}
            {mode === "sms" && (
              <div className="space-y-2">
                <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">
                  CARD NOTIFICATION TEXT
                </Label>
                <Textarea
                  placeholder={`카카오페이, 토스, 카드사 알림 문자를 붙여넣으세요\n\n예시:\n[카카오페이] 5,400원 결제\n스타벅스코리아\n2026-05-11 14:23`}
                  value={smsText} onChange={(e) => setSmsText(e.target.value)}
                  className="font-mono text-xs rounded-sm min-h-[120px] resize-none"
                />
                <Button
                  onClick={handleParseSms}
                  disabled={!smsText.trim() || parseSms.isPending}
                  className="w-full font-mono text-[10px] tracking-[0.15em] uppercase rounded-sm h-9"
                  variant="outline"
                >
                  {parseSms.isPending
                    ? <><Loader2 size={12} className="animate-spin mr-2" /> PARSING...</>
                    : <><Sparkles size={12} className="mr-2" /> AI PARSE TEXT</>}
                </Button>
                <p className="font-mono text-[9px] text-muted-foreground/60 text-center">
                  파싱 후 기준가 확인을 위해 직접 입력 탭으로 이동합니다
                </p>
              </div>
            )}

            {/* ── ✏️ 수동 입력 탭 ── */}
            {mode === "manual" && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">DATE</Label>
                    <Input type="date" value={manual.date}
                      onChange={(e) => setManual(f => ({ ...f, date: e.target.value }))}
                      className="font-mono text-xs rounded-sm h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">CATEGORY</Label>
                    <Select value={manual.category} onValueChange={(v) => setManual(f => ({ ...f, category: v as Category }))}>
                      <SelectTrigger className="font-mono text-xs rounded-sm h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">ASSET NAME</Label>
                  <Input placeholder="예: 천원 아침, 중간고사 간식 공동구매"
                    value={manual.title} onChange={(e) => setManual(f => ({ ...f, title: e.target.value }))}
                    className="font-mono text-xs rounded-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">
                    MEMO <span className="text-muted-foreground/50 normal-case tracking-normal">(선택)</span>
                  </Label>
                  <Input placeholder="예: 학식 대신 천원 아침 이용"
                    value={manual.description} onChange={(e) => setManual(f => ({ ...f, description: e.target.value }))}
                    className="font-mono text-xs rounded-sm h-8" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">ORIGINAL</Label>
                    <p className="text-[8px] text-muted-foreground/60 -mt-0.5">원래 지출 예정 금액</p>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">₩</span>
                      <Input type="number" placeholder="7000"
                        value={manual.originalAmount} onChange={(e) => setManual(f => ({ ...f, originalAmount: e.target.value }))}
                        className="font-mono text-xs pl-6 rounded-sm h-8" min={0} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-mono">ACTUAL</Label>
                    <p className="text-[8px] text-muted-foreground/60 -mt-0.5">실제 지출 금액</p>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">₩</span>
                      <Input type="number" placeholder="1000"
                        value={manual.actualAmount} onChange={(e) => setManual(f => ({ ...f, actualAmount: e.target.value }))}
                        className="font-mono text-xs pl-6 rounded-sm h-8" min={0} />
                    </div>
                  </div>
                </div>
                {manualProfit !== null && (
                  <div className={`rounded-sm border p-3 flex items-center justify-between ${
                    manualProfit > 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                  }`}>
                    <div>
                      <p className={`font-mono text-[9px] tracking-[0.15em] uppercase ${manualProfit > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        RECOGNIZED PROFIT
                      </p>
                      {manual.originalAmount && (
                        <p className={`font-mono text-[9px] mt-0.5 ${manualProfit > 0 ? "text-emerald-500" : "text-red-500"}`}>
                          return rate: {manualProfit > 0 ? "+" : ""}{((manualProfit / Number(manual.originalAmount)) * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <span className={`font-mono text-base font-bold ${manualProfit > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {manualProfit > 0 ? "▲" : "▼"} ₩{Math.abs(manualProfit).toLocaleString()}
                    </span>
                  </div>
                )}
                <Button type="submit"
                  className="w-full font-mono text-[10px] tracking-[0.15em] uppercase rounded-sm h-9"
                  disabled={!manual.title || !manual.originalAmount || !manual.actualAmount}>
                  CONFIRM TRADE
                </Button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
