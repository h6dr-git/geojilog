// ============================================================
// QuickUpload — + 버튼 → 카메라/앨범/직접입력 옵션 팝업
// ============================================================

import { useRef, useCallback, useState } from "react";
import { Plus, Camera, ImageIcon, PenLine, X } from "lucide-react";
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

export default function QuickUpload({ categoryNames, onDone, onStart, onManualEntry }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showOptions, setShowOptions] = useState(false);

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
          toast.error("분석에 실패했습니다. 직접 입력해주세요.");
        });
    });
  }, [processFileInBackground, onStart]);

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

      {/* hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
    </>
  );
}
