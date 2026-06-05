import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// ──────────────────────────────────────────────────────────────
// 개인/로컬용: 항상 단일 사용자로 로그인된 상태로 처리합니다.
// Manus 로그인(OAuth) 없이 바로 사용할 수 있게 하기 위함입니다.
// 공개 배포로 전환할 때, 이 부분을 실제 인증(예: Google 로그인)으로 교체하세요.
// ──────────────────────────────────────────────────────────────
const LOCAL_USER: User = {
  id: 1,
  openId: "local-user",
  name: "나",
  email: null,
  loginMethod: "local",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: LOCAL_USER,
  };
}
