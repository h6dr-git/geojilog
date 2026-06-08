// 사진 저장: 기본은 프로젝트 폴더 uploads/, 배포 시 UPLOAD_DIR 환경변수로 영구 디스크 경로 지정.
import fs from "node:fs";
import path from "node:path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

/** 파일을 uploads/ 아래에 저장하고, 앱에서 접근할 경로(url)를 돌려줍니다. */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.join(UPLOAD_DIR, key);
  ensureDir(path.dirname(filePath));

  const buf =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);
  fs.writeFileSync(filePath, buf);

  return { key, url: `/manus-storage/${key}` };
}

/** 저장된 파일의 앱 내 경로를 돌려줍니다. */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

/**
 * 저장된 파일을 base64 데이터 URL로 돌려줍니다.
 * (Gemini에 이미지를 인라인으로 넘기기 위함 — 로컬 파일은 외부에서 URL로 못 받으므로.)
 */
export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOAD_DIR, key);
  const buf = fs.readFileSync(filePath);
  return `data:${mimeFromKey(key)};base64,${buf.toString("base64")}`;
}
