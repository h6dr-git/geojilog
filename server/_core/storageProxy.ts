// 저장된 사진을 /manus-storage/* 경로로 서빙. 기본 uploads/, 배포 시 UPLOAD_DIR.
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { readUid } from "./context";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

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
      if (uid !== Number(owner[1])) {
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
      res.status(404).send("Not found");
      return;
    }

    res.setHeader("Content-Type", mimeFromPath(filePath));
    res.setHeader("Cache-Control", "private, max-age=31536000");
    fs.createReadStream(filePath).pipe(res);
  });
}
