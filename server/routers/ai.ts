import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { countAiCallsToday, logUsageEvent, getLatestEntryByTitle, getItemByName, getIncomeSourceUsual, findEntryByImageSig } from "../db";
import { INCOME_SOURCES, isIncomeSource } from "@shared/incomeSources";
import { invokeLLM } from "../llm";
import { storagePut, storageGetSignedUrl } from "../storage";
import { IMAGE_ANALYSIS_SYSTEM_PROMPT, SMS_PARSE_SYSTEM_PROMPT } from "../prompts";

// AI 분석(사진·문자)은 유저당 하루 호출 상한 — 비용 폭탄·봇 방어.
// AI는 '입력 마찰 제거'용일 뿐(해자 아님) → 한도에 닿아도 수동 입력으로 똑같이 기록되게 안내한다.
const AI_DAILY_LIMIT = 30;
const AI_LIMIT_MESSAGE = `오늘 AI 분석 한도(${AI_DAILY_LIMIT}회)를 다 쓰셨습니다, CEO님. 남은 기록은 직접 입력으로 올리시면 똑같이 +수익으로 계상됩니다.`;

export const aiRouter = router({
    analyzeImage: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
        imageSig: z.string().regex(/^[0-9a-f]{64}$/).optional(), // #48 — 원본 sha256 (클라 계산)
        ignoreDuplicate: z.boolean().default(false), // 중복 경고 무시하고 진행
      }))
      .mutation(async ({ ctx, input }) => {
        // #48 — 분석 전 중복 대조: LLM 호출도, 한도 차감도, 스토리지 업로드도 하기 전.
        if (input.imageSig && !input.ignoreDuplicate) {
          const dup = await findEntryByImageSig(ctx.user.id, input.imageSig).catch(() => null);
          if (dup) {
            return {
              duplicate: { entryId: dup.id, date: dup.date, title: dup.title, profit: dup.profit },
            } as const;
          }
        }
        const used = await countAiCallsToday(ctx.user.id);
        if (used >= AI_DAILY_LIMIT) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: AI_LIMIT_MESSAGE,
          });
        }
        const buffer = Buffer.from(input.imageBase64, "base64");
        const { key } = await storagePut(
          `ai-analysis/${Date.now()}.jpg`,
          buffer,
          ctx.user.id,
          input.mimeType
        );
        const signedUrl = await storageGetSignedUrl(key);

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: IMAGE_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: signedUrl, detail: "high" },
                },
                {
                  type: "text",
                  text: "이 사진을 보고 음식/상품을 인식해서 시중 기준가를 추정해주세요.",
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "image_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  category: { type: "string", enum: ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"] },
                  incomeSource: { type: "string", enum: [...INCOME_SOURCES] }, // #37+#38 수익원 분류
                  estimatedOriginalAmount: { type: "integer" },
                  estimatedActualAmount: { type: "integer" },
                  estimatedPeopleCount: { type: "integer" }, // #33 — 보이는 음식이 약 몇 인분인지 (1인분=1)
                  reason: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  cropBox: {
                    type: "object",
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                    },
                    required: ["x", "y"],
                    additionalProperties: false,
                  },
                },
                required: ["title", "category", "incomeSource", "estimatedOriginalAmount", "estimatedActualAmount", "estimatedPeopleCount", "reason", "confidence", "cropBox"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") throw new Error("AI 분석 결과를 받지 못했습니다");
        const raw = JSON.parse(content) as Record<string, unknown>;

        // #33·#42 — 응답 검증: 폴백(lite) 모델이 JSON 계약을 어겨도 NaN/undefined가
        // 클라로 새어나가지 않게 서버에서 막는다. 금액이 불완전하면 명시적 실패(큐에서 '다시 시도').
        const toInt = (v: unknown): number | null => {
          const n = typeof v === "string" ? Number(v) : v;
          return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
        };
        const clamp01 = (v: unknown): number =>
          typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
        const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"];
        const origAmt = toInt(raw.estimatedOriginalAmount);
        const actAmt = toInt(raw.estimatedActualAmount);
        if (origAmt == null || origAmt <= 0 || actAmt == null || actAmt < 0) {
          throw new Error("AI 분석 결과가 불완전합니다 — 다시 시도해 주세요");
        }
        const people = toInt(raw.estimatedPeopleCount);
        const cropRaw = (raw.cropBox ?? {}) as { x?: unknown; y?: unknown };
        const parsed = {
          title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 30) : "이름 모를 한 끼",
          category: typeof raw.category === "string" && CATEGORIES.includes(raw.category) ? raw.category : "기타",
          incomeSource: isIncomeSource(raw.incomeSource) ? raw.incomeSource : ("기타" as const), // 검증 실패 시 기타
          estimatedOriginalAmount: origAmt,
          estimatedActualAmount: actAmt,
          estimatedPeopleCount: people != null && people >= 1 && people <= 50 ? people : 1,
          reason:
            (typeof raw.reason === "string" ? raw.reason : "") +
            (result.modelUsed.includes("lite") ? " (혼잡으로 간이 분석 — 금액을 한 번 확인해 주세요)" : ""),
          confidence: (["high", "medium", "low"].includes(String(raw.confidence)) ? String(raw.confidence) : "low") as "high" | "medium" | "low",
          cropBox: { x: clamp01(cropRaw.x), y: clamp01(cropRaw.y) },
        };
        await logUsageEvent(ctx.user.id, "ai_analyze_image");
        // P2(나만의 기준가) — ① 단골 사전 우선 ② 없으면 같은 제목 최근 3건 중간값.
        // usualActual(평소가)을 함께 줘서, 평소보다 더 아낀 날(#37)을 클라가 표시할 수 있게.
        // ⚠️ 단, 단체 사진(2인분 이상 추정)이면 사전을 적용하지 않는다 — 1인분 단가가 총액 추정을 덮어쓰던 버그(#33)
        let prior: { originalAmount: number; actualAmount: number; date: string; usualActual?: number; source: "dict" | "history" } | null = null;
        try {
          if ((parsed.estimatedPeopleCount ?? 1) < 2) {
          const dict = await getItemByName(ctx.user.id, parsed.title);
          if (dict) {
            prior = {
              originalAmount: dict.usualOriginal,
              actualAmount: dict.usualActual,
              date: dict.lastDate ?? "",
              usualActual: dict.usualActual,
              source: "dict",
            };
          } else {
            const prev = await getLatestEntryByTitle(ctx.user.id, parsed.title);
            if (prev) prior = { originalAmount: prev.originalAmount, actualAmount: prev.actualAmount, date: prev.date, usualActual: prev.actualAmount, source: "history" };
          }
          }
        } catch { /* 조회 실패해도 분석 결과는 정상 반환 */ }
        // #37+#38 — 평소가 = 이 수익원의 최근 실지출 중앙값 (제목과 무관하게 견고).
        // 표본 2건 미만이면 null — 클라는 보너스·"평소보다" 문구를 띄우지 않는다.
        let sourceUsual: { source: string; usualActual: number; sample: number } | null = null;
        try {
          sourceUsual = await getIncomeSourceUsual(ctx.user.id, parsed.incomeSource);
        } catch { /* 조회 실패해도 분석 결과는 정상 반환 */ }

        // #43 — 단체 사진이면 '내 몫'까지 서버가 계산해 내려준다 (균등 분배 가정, 클라 폼에 바로 꽂힘)
        const headcount = parsed.estimatedPeopleCount;
        const myShare =
          headcount >= 2
            ? {
                originalAmount: Math.round(parsed.estimatedOriginalAmount / headcount),
                actualAmount: Math.round(parsed.estimatedActualAmount / headcount),
                groupOriginalAmount: parsed.estimatedOriginalAmount,
                groupActualAmount: parsed.estimatedActualAmount,
                peopleCount: headcount,
              }
            : null;
        return { ...parsed, imageUrl: `/manus-storage/${key}`, prior, myShare, sourceUsual, duplicate: null };
      }),

    uploadImage: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const { key } = await storagePut(
          `ai-cropped/${Date.now()}.jpg`,
          buffer,
          ctx.user.id,
          input.mimeType
        );
        return { imageUrl: `/manus-storage/${key}` };
      }),

    parseSmsText: protectedProcedure
      .input(z.object({ text: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const used = await countAiCallsToday(ctx.user.id);
        if (used >= AI_DAILY_LIMIT) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: AI_LIMIT_MESSAGE,
          });
        }
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: SMS_PARSE_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `다음 문자를 파싱해주세요:\n\n${input.text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "sms_parse",
              strict: false,
              schema: {
                type: "object",
                properties: {
                  parsed: { type: "boolean" },
                  amount: { type: "integer" },
                  merchant: { type: "string" },
                  date: { type: "string" },
                  category: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["parsed"],
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") throw new Error("파싱 결과를 받지 못했습니다");
        await logUsageEvent(ctx.user.id, "ai_parse_sms");
        return JSON.parse(content) as
          | { parsed: true; amount: number; merchant: string; date: string; category: string }
          | { parsed: false; reason: string };
      }),
});
