// #48 — 사진 원본 지문(sha256 hex). 같은 파일을 다른 날 또 올리면 서버가 기존 기록과 대조한다.
// 계산 실패(비보안 컨텍스트 등)는 null — 중복 감지만 꺼지고 업로드는 정상 진행.
export async function sha256File(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export type DupInfo = { entryId: number; date: string; title: string; profit: number };
