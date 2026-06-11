// #47 — 커스텀 수익원 라우터: 목록·추가·이름변경(기록 전파)·삭제(기록은 미분류로)
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import {
  listUserIncomeSources,
  createUserIncomeSource,
  renameUserIncomeSource,
  deleteUserIncomeSource,
} from "../db";
import { CUSTOM_SOURCE_NAME_MAX } from "@shared/incomeSources";

export const incomeSourcesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listUserIncomeSources(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(CUSTOM_SOURCE_NAME_MAX) }))
    .mutation(async ({ ctx, input }) => createUserIncomeSource(ctx.user.id, input.name)),

  rename: protectedProcedure
    .input(z.object({ id: z.number().int(), name: z.string().trim().min(1).max(CUSTOM_SOURCE_NAME_MAX) }))
    .mutation(async ({ ctx, input }) => renameUserIncomeSource(ctx.user.id, input.id, input.name)),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => deleteUserIncomeSource(ctx.user.id, input.id)),
});
