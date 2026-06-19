/**
 * 업로드·AI 분석 전 클라이언트 이미지 리사이즈·JPEG 압축.
 * 큰 원본을 그대로 base64로 보내지 않도록 해 API 페이로드와 업로드 시간을 줄인다.
 */

export const DEFAULT_MAX_SIDE = 1920;
export const DEFAULT_QUALITY = 0.82;
/** 이보다 작으면 리사이즈·재압축 생략 */
export const SKIP_BELOW_BYTES = 280_000;

export function scaleToMaxSide(
  width: number,
  height: number,
  maxSide = DEFAULT_MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      mimeType,
      quality,
    );
  });
}

export interface CompressImageOptions {
  maxSide?: number;
  quality?: number;
  /** true면 작은 파일도 JPEG로 재인코딩 */
  force?: boolean;
}

/**
 * 이미지 File을 리사이즈·압축한 새 File을 반환. 실패 시 원본 그대로.
 */
export async function compressImageFile(
  file: File,
  opts: CompressImageOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxSide = opts.maxSide ?? DEFAULT_MAX_SIDE;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  if (!opts.force && file.size < SKIP_BELOW_BYTES && file.type === "image/jpeg") {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);
    const { width, height } = scaleToMaxSide(img.naturalWidth, img.naturalHeight, maxSide);

    const unchanged =
      width === img.naturalWidth &&
      height === img.naturalHeight &&
      file.type === "image/jpeg" &&
      file.size < SKIP_BELOW_BYTES;
    if (!opts.force && unchanged) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** 압축 후 base64(헤더 제외) + mimeType */
export async function fileToCompressedBase64(
  file: File,
  opts?: CompressImageOptions,
): Promise<{ base64: string; mimeType: string; file: File }> {
  const compressed = await compressImageFile(file, opts);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const r = String(e.target?.result ?? "").split(",")[1];
      if (r) resolve(r);
      else reject(new Error("읽기 실패"));
    };
    reader.onerror = () => reject(new Error("읽기 실패"));
    reader.readAsDataURL(compressed);
  });
  return { base64, mimeType: compressed.type || "image/jpeg", file: compressed };
}
