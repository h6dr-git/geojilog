import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { updateUserName } from "../db";

export const userRouter = router({
    updateName: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserName(ctx.user.id, input.name);
        return { success: true };
      }),
});
