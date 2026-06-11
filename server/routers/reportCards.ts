// #50 서가 라우터 — 소장 목록·소장(갱신)·빼기
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { listReportCards, upsertReportCard, deleteReportCard } from "../db";

export const reportCardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listReportCards(ctx.user.id)),

  save: protectedProcedure
    .input(z.object({
      periodType: z.enum(["week", "month"]),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      theme: z.string().min(1).max(20),
      stickers: z.array(z.string().max(20)).max(8),
    }))
    .mutation(async ({ ctx, input }) =>
      upsertReportCard(ctx.user.id, {
        periodType: input.periodType,
        startDate: input.startDate,
        theme: input.theme,
        stickers: JSON.stringify(input.stickers),
      })
    ),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await deleteReportCard(ctx.user.id, input.id);
      return { success: true };
    }),
});
