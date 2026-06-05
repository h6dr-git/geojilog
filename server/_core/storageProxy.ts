// 개인/로컬용: uploads/ 에 저장된 사진을 /manus-storage/* 경로로 서빙합니다.
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function mimeFromPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 경로 탈출(../) 방지
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
    res.setHeader("Cache-Control", "public, max-age=31536000");
    fs.createReadStream(filePath).pipe(res);
  });
}
