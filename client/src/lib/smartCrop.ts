// ============================================================
// 스마트 크롭 — AI 좌표 기반 정사각형 크롭
// cropBox: { x, y } = 0~1 범위의 피사체 중심 좌표
// ============================================================

export async function smartCropToSquare(
  file: File,
  cropCenter: { x: number; y: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth: w, naturalHeight: h } = img;
      const size = Math.min(w, h); // 정사각형 크기

      // 피사체 중심 좌표 → 픽셀 좌표
      const cx = Math.round(cropCenter.x * w);
      const cy = Math.round(cropCenter.y * h);

      // 크롭 시작점 계산 (중심에서 size/2 만큼 빼되, 경계 초과 방지)
      let sx = cx - Math.floor(size / 2);
      let sy = cy - Math.floor(size / 2);
      sx = Math.max(0, Math.min(sx, w - size));
      sy = Math.max(0, Math.min(sy, h - size));

      // Canvas에 크롭 그리기
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }

      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.92
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}
