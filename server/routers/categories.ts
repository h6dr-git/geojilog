import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getUserCategories, createUserCategory, deleteUserCategory, renameUserCategory } from "../db";

export const categoriesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserCategories(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(50), color: z.string().default("gray") }))
      .mutation(async ({ ctx, input }) => {
        return createUserCategory({ userId: ctx.user.id, name: input.name, color: input.color, isDefault: "no" });
      }),

    rename: protectedProcedure
      .input(z.object({ id: z.number().int(), name: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        await renameUserCategory(input.id, ctx.user.id, input.name);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteUserCategory(input.id, ctx.user.id);
        return { success: true };
      }),
});
