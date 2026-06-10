import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../cookies";
import { publicProcedure, router } from "../trpc";

export const authRouter = router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // 클라이언트가 카카오 버튼 노출 여부를 판단 — 키 없는 로컬에선 버튼을 숨긴다
    config: publicProcedure.query(() => ({ kakaoEnabled: !!process.env.KAKAO_REST_API_KEY })),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
});
