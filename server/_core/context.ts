// 익명 자동 계정 — 로그인/비번/가입 없이, 링크를 연 사람마다 자기만의 거지로그을 갖게 한다.
// 동작: 쿠키에 기기별 세션이 없으면 새 사용자(익명)를 만들고 쿠키를 심는다.
//       다음부터는 그 쿠키로 같은 사람을 알아본다. → 친구도 0 마찰로 자기 데이터.
// (정식 로그인은 추후 추가 — 그때 기존 익명 계정을 '내 계정으로' 연결)
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { randomUUID } from "node:crypto";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const COOKIE_NAME = "gjr_session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "geojirok-dev-secret-please-set-JWT_SECRET"
);

async function readUid(cookieHeader: string | undefined): Promise<number | null> {
  if (!cookieHeader) return null;
  const token = parseCookie(cookieHeader)[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    const uid = Number((payload as Record<string, unknown>).uid);
    return Number.isInteger(uid) && uid > 0 ? uid : null;
  } catch {
    return null;
  }
}

async function signUid(uid: number): Promise<string> {
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(SECRET);
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // 1) 쿠키로 기존 사용자 찾기
  const uid = await readUid(opts.req.headers.cookie);
  let user: User | null = uid ? (await db.getUserById(uid)) ?? null : null;

  // 2) 없으면 새 익명 계정 생성 + 쿠키 심기
  if (!user) {
    const newId = await db.createUser({
      openId: "anon_" + randomUUID(),
      name: "회장님",
    });
    user = (await db.getUserById(newId)) ?? null;
    try {
      const token = await signUid(newId);
      opts.res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ONE_YEAR_MS,
        path: "/",
      });
    } catch (e) {
      console.error("[auth] 쿠키 설정 실패:", e);
    }
  }

  return { req: opts.req, res: opts.res, user };
}
