// 푸시 라우터 — 설정 조회·구독 등록/해지.
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { savePushSubscription, deletePushSubscription } from "../db";
import { pushEnabled, vapidPublicKey } from "../push";

export const pushRouter = router({
  config: publicProcedure.query(() => ({ enabled: pushEnabled, publicKey: vapidPublicKey })),

  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await savePushSubscription(ctx.user.id, input.endpoint, input.p256dh, input.auth);
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ input }) => {
      await deletePushSubscription(input.endpoint);
      return { success: true };
    }),
});
