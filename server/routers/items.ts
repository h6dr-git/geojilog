// 단골 사전 라우터 — 목록(자동 백필 포함)·수정·고정·삭제.
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { listItems, updateItem, deleteItem } from "../db";

export const itemsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listItems(ctx.user.id)),

  update: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      usualOriginal: z.number().int().positive().optional(),
      usualActual: z.number().int().min(0).optional(),
      pinned: z.enum(["yes", "no"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateItem(ctx.user.id, id, data);
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await deleteItem(ctx.user.id, input.id);
      return { success: true };
    }),
});
