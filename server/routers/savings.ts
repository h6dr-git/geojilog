import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getSavingsEntries, createSavingsEntry, deleteSavingsEntry, deleteMultipleSavingsEntries, deleteAllSavingsEntries, countSavingsEntriesByCategory, updateSavingsEntry, logUsageEvent, upsertItemFromEntry, backfillIncomeSources, isValidIncomeSourceFor } from "../db";
import { TRPCError } from "@trpc/server";
import { CUSTOM_SOURCE_NAME_MAX } from "@shared/incomeSources";

// #47 — 커스텀 유형 허용: 형태는 zod, 실존 여부(기본 9종 ∪ 내 커스텀)는 서버에서 확인
const incomeSourceInput = z.string().trim().min(1).max(CUSTOM_SOURCE_NAME_MAX);
async function assertIncomeSource(userId: number, v: string | null | undefined) {
  if (v == null) return;
  if (!(await isValidIncomeSourceFor(userId, v))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "알 수 없는 수익원이에요 — 수익원 시트에서 먼저 추가해 주세요" });
  }
}

function generateTicker(category: string, count: number): string {
  const prefixMap: Record<string, string> = {
    식비: "FOOD", 카페: "CAFE", 교통: "TRNSP", 쇼핑: "SHOP", "문화/여가": "LSRE", 기타: "ETC",
  };
  const prefix = prefixMap[category] ?? "SAVE";
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

export const savingsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getSavingsEntries(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        date: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string(),
        incomeSource: incomeSourceInput.optional(), // #37+#38 수익원 (미지정=미분류, 커스텀 허용 #47)
        originalAmount: z.number().int().positive(),
        actualAmount: z.number().int().min(0),
        // AI가 처음 추정했던 기준가(있으면). 최종 확정값과 다르면 보정 데이터로 기록 → '실가격 데이터 해자'.
        aiOriginalAmount: z.number().int().positive().optional(),
        aiActualAmount: z.number().int().min(0).optional(),
        aiEstimated: z.enum(["yes", "no"]).default("no"),
        aiReason: z.string().optional(),
        // #43 — AI 단체 추론값 (파인튜닝·데이터 해자용 보존)
        aiPeopleCount: z.number().int().min(1).max(50).optional(),
        aiGroupOriginalAmount: z.number().int().positive().optional(),
        aiGroupActualAmount: z.number().int().min(0).optional(),
        imageUrl: z.string().optional(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertIncomeSource(ctx.user.id, input.incomeSource);
        const count = await countSavingsEntriesByCategory(ctx.user.id, input.category);
        const ticker = generateTicker(input.category, count);
        const profit = input.originalAmount - input.actualAmount;
        const created = await createSavingsEntry({
          userId: ctx.user.id,
          date: input.date,
          title: input.title,
          description: input.description,
          category: input.category,
          incomeSource: input.incomeSource,
          ticker,
          originalAmount: input.originalAmount,
          actualAmount: input.actualAmount,
          profit,
          aiEstimated: input.aiEstimated,
          aiReason: input.aiReason,
          aiPeopleCount: input.aiPeopleCount,
          aiGroupOriginalAmount: input.aiGroupOriginalAmount,
          aiGroupActualAmount: input.aiGroupActualAmount,
          imageUrl: input.imageUrl,
          memo: input.memo,
        });
        await logUsageEvent(ctx.user.id, "entry_create");
        // 단골 사전 자동 축적 (P2 2차) — 실패해도 기록 저장엔 영향 없음
        try {
          await upsertItemFromEntry(ctx.user.id, {
            title: input.title,
            category: input.category,
            originalAmount: input.originalAmount,
            actualAmount: input.actualAmount,
            date: input.date,
          });
        } catch { /* 사전 축적 실패 무시 */ }
        // 데이터 해자: AI 추정 기준가 → 사용자 확정 실가격의 '보정'을 쌓는다(클라가 AI 추정 원본값을 보낼 때만 작동).
        const correctedOrig = input.aiOriginalAmount !== undefined && input.aiOriginalAmount !== input.originalAmount;
        const correctedActual = input.aiActualAmount !== undefined && input.aiActualAmount !== input.actualAmount;
        if (input.aiEstimated === "yes" && (correctedOrig || correctedActual)) {
          await logUsageEvent(ctx.user.id, "price_correction", JSON.stringify({
            category: input.category,
            aiOriginal: input.aiOriginalAmount ?? null,
            finalOriginal: input.originalAmount,
            aiActual: input.aiActualAmount ?? null,
            finalActual: input.actualAmount,
          }));
        }
        return created;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        date: z.string().optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        incomeSource: incomeSourceInput.nullable().optional(), // null = 미분류로 되돌림 (커스텀 허용 #47)
        originalAmount: z.number().int().positive().optional(),
        actualAmount: z.number().int().min(0).optional(),
        memo: z.string().nullable().optional(),
        imageUrl: z.string().optional(), // #24 — 사진 나중에 붙이기/교체
      }))
      .mutation(async ({ ctx, input }) => {
        await assertIncomeSource(ctx.user.id, input.incomeSource);
        await updateSavingsEntry(input.id, ctx.user.id, input);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteSavingsEntry(input.id, ctx.user.id);
        return { success: true };
      }),

    deleteBulk: protectedProcedure
      .input(z.object({ ids: z.array(z.number().int()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        await deleteMultipleSavingsEntries(input.ids, ctx.user.id);
        return { success: true };
      }),

    // #38 — 미분류 기록 1회 정리 (제목·메모 키워드 휴리스틱, LLM 비용 없음)
    reclassifySources: protectedProcedure
      .mutation(async ({ ctx }) => backfillIncomeSources(ctx.user.id)),

    deleteAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        await deleteAllSavingsEntries(ctx.user.id);
        return { success: true };
      }),
});
