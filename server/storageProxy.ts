// 저장된 사진을 /manus-storage/* 경로로 서빙. 기본 uploads/, 배포 시 UPLOAD_DIR.
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { readUid } from "./context";
import { activeUploadDir, isLocalMode } from "./localMode";

const UPLOAD_DIR = activeUploadDir();

function mimeFromPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 소유자 스코프 키(u{id}/...)는 로그인한 본인만 접근 허용.
    const owner = key.match(/^u(\d+)\//);
    if (owner) {
      const uid = await readUid(req.headers.cookie);
      // 복구 DB에는 게스트→Kakao 병합 전에 생성된 다른 u{id}/ 키가 남을 수 있다.
      // 격리 uploads에는 선택한 복구 사용자의 참조 파일만 복사되므로 로컬 모드에서만 허용.
      if (!isLocalMode() && uid !== Number(owner[1])) {
        res.status(403).send("Forbidden");
        return;
      }
    }

    const filePath = path.resolve(UPLOAD_DIR, key);
    if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
      res.status(403).send("Forbidden");
      return;
    }
    if (!fs.existsSync(filePath)) {
      if (isLocalMode()) {
        res.redirect(302, "/recovery-missing-photo.svg");
        return;
      }
      // 로컬 개발 폴백 (#34): 같은 DB(Turso)를 보지만 사진 파일은 배포 서버 디스크에만 있다.
      // ASSET_FALLBACK_BASE(배포 주소)가 설정된 개발 환경이면 배포에서 받아와 로컬에 캐시.
      const base = process.env.ASSET_FALLBACK_BASE;
      if (base && process.env.NODE_ENV === "development") {
        try {
          const r = await fetch(`${base.replace(/\/+$/, "")}/manus-storage/${key}`, {
            headers: req.headers.cookie ? { cookie: req.headers.cookie } : undefined, // 소유자 검사 통과용(JWT 시크릿 동일 전제)
          });
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            try {
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, buf); // 다음부턴 로컬에서 바로
            } catch { /* 캐시 실패해도 응답은 정상 */ }
            res.setHeader("Content-Type", r.headers.get("content-type") || mimeFromPath(filePath));
            res.setHeader("Cache-Control", "private, max-age=31536000");
            res.send(buf);
            return;
          }
        } catch { /* 폴백 실패 → 404 */ }
      }
      res.status(404).send("Not found");
      return;
    }

    res.setHeader("Content-Type", mimeFromPath(filePath));
    res.setHeader("Cache-Control", "private, max-age=31536000");
    fs.createReadStream(filePath).pipe(res);
  });
}
