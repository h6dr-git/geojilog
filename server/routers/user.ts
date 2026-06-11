import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { updateUserName, pingAppOpen, logUsageEvent } from "../db";

const TRACKABLE = ["capture_view"] as const; // 화이트리스트 — 클라가 임의 타입을 못 쌓게

export const userRouter = router({
    // 검증 계기판 — 앱 열람 핑 (하루 1건 서버 dedup). 실패해도 무해.
    ping: protectedProcedure.mutation(async ({ ctx }) => {
      await pingAppOpen(ctx.user.id);
      return { ok: true };
    }),

    // 행동 이벤트 (capture_view 등 화이트리스트만)
    track: protectedProcedure
      .input(z.object({ type: z.enum(TRACKABLE) }))
      .mutation(async ({ ctx, input }) => {
        await logUsageEvent(ctx.user.id, input.type);
        return { ok: true };
      }),

    updateName: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserName(ctx.user.id, input.name);
        return { success: true };
      }),
});
