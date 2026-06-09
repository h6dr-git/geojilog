// ============================================================
// QuickUpload — + 버튼 → 카메라/앨범/직접입력 옵션 팝업
// ============================================================

import { useRef, useCallback, useState } from "react";
import { Plus, Camera, ImageIcon, PenLine, X, RotateCw, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getExifDate } from "@/lib/exif";
import { smartCropToSquare } from "@/lib/smartCrop";

interface Props {
  categoryNames: string[];
  onDone: () => void;
  onStart?: () => void;
  onManualEntry?: () => void; // 직접 입력 탭으로 이동
}

const DEFAULT_CATEGORY = "식비";
const today = new Date().toISOString().split("T")[0];

// 분석 실패 항목 — 원본 File 보관 → 다시 업로드 없이 재분석(Home.tsx 패턴과 동일)
interface FailedItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  retrying: boolean;
}

export default function QuickUpload({ categoryNames, onDone, onStart, onManualEntry }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [failed, setFailed] = useState<FailedItem[]>([]);

  const analyzeImage = trpc.ai.analyzeImage.useMutation();
  const uploadCroppedImage = trpc.ai.uploadImage.useMutation();
  const createEntry = trpc.savings.create.useMutation({
    onSuccess: () => onDone(),
    onError: () => toast.error("등록에 실패했습니다"),
  });

  const defaultCategory = categoryNames[0] ?? DEFAULT_CATEGORY;

  const processFileInBackground = useCallback(async (file: File) => {
    const exifDate = await getExifDate(file);
    const date = exifDate ?? today;

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string).split(",")[1];
        if (result) resolve(result);
        else reject(new Error("파일 읽기 실패"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const result = await analyzeImage.mutateAsync({ imageBase64: base64, mimeType: file.type });

    // AI 좌표 기반 스마트 크롭 → base64 변환 → 크롭된 이미지로 등록
    let finalImageUrl = result.imageUrl;
    try {
      const croppedBlob = await smartCropToSquare(file, result.cropBox ?? { x: 0.5, y: 0.5 });
      // 크롭된 이미지를 base64로 변환 후 재분석 없이 직접 업로드
      const croppedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const r = (e.target?.result as string).split(",")[1];
          if (r) resolve(r); else reject(new Error("crop read failed"));
        };
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });
      // 크롭된 이미지 업로드 (analyzeImage의 S3 업로드 재사용)
      const cropResult = await uploadCroppedImage.mutateAsync({ imageBase64: croppedBase64, mimeType: "image/jpeg" });
      finalImageUrl = cropResult.imageUrl;
    } catch {
      // 크롭 실패 시 원본 URL 유지
    }

    await createEntry.mutateAsync({
      date,
      title: result.title,
      category: result.category || defaultCategory,
      originalAmount: result.estimatedOriginalAmount,
      actualAmount: result.estimatedActualAmount,
      aiEstimated: "yes",
      // 데이터 해자: AI 추정 원본 전달(이 경로는 사용자 수정 전 즉시 등록 → 보통 확정값과 동일)
      aiOriginalAmount: result.estimatedOriginalAmount,
      aiActualAmount: result.estimatedActualAmount,
      aiReason: result.reason,
      imageUrl: finalImageUrl,
    });

    toast.success(`✓ ${result.title} 등록됨`, {
      description: `+₩${(result.estimatedOriginalAmount - result.estimatedActualAmount).toLocaleString()} 절약`,
      duration: 3000,
    });
  }, [analyzeImage, createEntry, defaultCategory]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) return;

    onStart?.();
    setShowOptions(false);

    arr.forEach(file => {
      toast.loading(`AI 분석 중... (${file.name.slice(0, 10)})`, {
        id: `analyzing-${file.name}`,
        duration: 30000,
      });
      processFileInBackground(file)
        .then(() => toast.dismiss(`analyzing-${file.name}`))
        .catch(() => {
          toast.dismiss(`analyzing-${file.name}`);
          // 알림만 띄우고 끝내지 않는다 — 원본을 보관해 '다시 시도' 카드로 노출(다시 업로드 강요 X)
          setFailed(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            fileName: file.name,
            retrying: false,
          }]);
        });
    });
  }, [processFileInBackground, onStart]);

  // 실패 항목 재시도 — 보관한 원본 File로 다시 분석(다시 업로드 강요 X)
  const retryFailed = useCallback((item: FailedItem) => {
    setFailed(prev => prev.map(it => it.id === item.id ? { ...it, retrying: true } : it));
    toast.loading(`AI 분석 중... (${item.fileName.slice(0, 10)})`, {
      id: `retry-${item.id}`,
      duration: 30000,
    });
    processFileInBackground(item.file)
      .then(() => {
        toast.dismiss(`retry-${item.id}`);
        URL.revokeObjectURL(item.previewUrl);
        setFailed(prev => prev.filter(it => it.id !== item.id));
      })
      .catch(() => {
        toast.dismiss(`retry-${item.id}`);
        setFailed(prev => prev.map(it => it.id === item.id ? { ...it, retrying: false } : it));
      });
  }, [processFileInBackground]);

  const removeFailed = useCallback((id: string) => {
    setFailed(prev => {
      const it = prev.find(i => i.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  return (
    <>
      {/* 메인 FAB */}
      <button
        onClick={() => setShowOptions(v => !v)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          showOptions ? "bg-foreground rotate-45" : "bg-emerald-500 hover:bg-emerald-600"
        }`}
        aria-label="새 항목 추가"
      >
        <Plus size={28} className="text-white" />
      </button>

      {/* 옵션 팝업 */}
      {showOptions && (
        <>
          {/* 배경 오버레이 */}
          <div className="fixed inset-0 z-30" onClick={() => setShowOptions(false)} />

          {/* 옵션 버튼들 */}
          <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3">
            {/* 직접 입력 */}
            <div className="flex items-center gap-3">
              <span className="bg-card border border-border rounded-full px-3 py-1.5 text-sm font-medium shadow-md whitespace-nowrap">직접 입력</span>
              <button
                onClick={() => { setShowOptions(false); onManualEntry?.(); }}
                className="w-12 h-12 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
              >
                <PenLine size={20} className="text-foreground" />
              </button>
            </div>

            {/* 앨범 */}
            <div className="flex items-center gap-3">
              <span className="bg-card border border-border rounded-full px-3 py-1.5 text-sm font-medium shadow-md whitespace-nowrap">앨범에서 선택</span>
              <button
                onClick={() => galleryRef.current?.click()}
                className="w-12 h-12 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
              >
                <ImageIcon size={20} className="text-foreground" />
              </button>
            </div>

            {/* 카메라 */}
            <div className="flex items-center gap-3">
              <span className="bg-card border border-border rounded-full px-3 py-1.5 text-sm font-medium shadow-md whitespace-nowrap">카메라로 찍기</span>
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-12 h-12 rounded-full bg-emerald-500 shadow-md flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-all"
              >
                <Camera size={20} className="text-white" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* 분석 실패 — 다시 시도 / 직접 입력 폴백 (다시 업로드 강요 X) */}
      {failed.length > 0 && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-sm space-y-2">
          {failed.map(item => (
            <div key={item.id} className="bg-card border border-red-200 rounded-xl shadow-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-red-50 overflow-hidden flex-shrink-0">
                  <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-red-500">분석에 실패했어요</p>
                  <p className="text-[11px] text-gray-400 truncate">다시 시도하거나 직접 입력하세요</p>
                </div>
                <button onClick={() => removeFailed(item.id)} className="p-1 text-gray-300 hover:text-gray-500 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => retryFailed(item)}
                  disabled={item.retrying}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {item.retrying ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                  다시 시도
                </button>
                <button
                  onClick={() => { onManualEntry?.(); removeFailed(item.id); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 active:scale-95 transition-all"
                >
                  <PenLine size={12} />
                  직접 입력
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
    </>
  );
}
