// EXIF 메타데이터에서 촬영 날짜 추출
// exifr 라이브러리 사용 (브라우저 네이티브 지원)

export async function getExifDate(file: File): Promise<string | null> {
  try {
    // exifr를 동적 임포트 (코드 스플리팅)
    const exifr = await import("exifr");
    const data = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "DateTimeDigitized", "DateTime", "CreateDate"],
    });

    if (!data) return null;

    // 우선순위: DateTimeOriginal > DateTimeDigitized > DateTime > CreateDate
    const raw =
      data.DateTimeOriginal ??
      data.DateTimeDigitized ??
      data.DateTime ??
      data.CreateDate;

    if (!raw) return null;

    // Date 객체면 바로 변환
    if (raw instanceof Date) {
      return toYYYYMMDD(raw);
    }

    // 문자열이면 파싱: "2026:05:11 14:23:00" 형식
    if (typeof raw === "string") {
      // EXIF 날짜 형식: "YYYY:MM:DD HH:MM:SS"
      const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }

    return null;
  } catch {
    // EXIF 없는 파일이거나 파싱 실패 → 조용히 null 반환
    return null;
  }
}

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
