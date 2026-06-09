import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { countAiCallsToday, logUsageEvent } from "../db";
import { invokeLLM } from "../llm";
import { storagePut, storageGetSignedUrl } from "../storage";

// AI 분석(사진·문자)은 유저당 하루 호출 상한 — 비용 폭탄·봇 방어.
// AI는 '입력 마찰 제거'용일 뿐(해자 아님) → 한도에 닿아도 수동 입력으로 똑같이 기록되게 안내한다.
const AI_DAILY_LIMIT = 30;
const AI_LIMIT_MESSAGE = `오늘 AI 분석 한도(${AI_DAILY_LIMIT}회)를 다 쓰셨어요, 회장님. 남은 기록은 직접 입력으로 올리시면 똑같이 +수익으로 잡힙니다.`;

export const aiRouter = router({
    analyzeImage: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
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
              content: `당신은 한국 대학생의 절약 가계부를 도와주는 AI입니다.
사진을 보고 음식이나 상품을 인식한 뒤, 아래 정보를 JSON으로 반환하세요.

반환 형식:
{
  "title": "음식/상품명 (간결하게, 최대 20자)",
  "category": "식비 | 카페 | 교통 | 쇼핑 | 문화/여가 | 기타",
  "estimatedOriginalAmount": 숫자 (원 단위, 일반 시중 가격 기준),
  "estimatedActualAmount": 숫자 (원 단위, 실제로 지불했을 것으로 추정되는 금액),
  "reason": "기준가 및 실제 지출 추정 근거 (2~3문장, 구체적으로)",
  "confidence": "high | medium | low",
  "cropBox": {
    "x": 0.0~1.0 (음식/주요 피사체 중심의 가로 비율),
    "y": 0.0~1.0 (음식/주요 피사체 중심의 세로 비율)
  }
}

cropBox 추정 원칙:
- x, y는 0.0~1.0 범위의 상대 좌표 (0,0=좌상단, 1,1=우하단)
- 음식이나 주요 피사체가 있는 중심점을 추정하세요
- 사진 전체에 골고루 퍼져 있다면 (0.5, 0.5)으로 설정하세요

기준가(estimatedOriginalAmount) 추정 원칙:
- 서울 기준 일반 식당/카페/마트의 평균 시중가를 기준으로 합니다
- 예: 학식/천원아침 → 일반 식당 기준 7000~9000원
- 예: 편의점 도시락 → 일반 식당 점심 기준 9000~12000원
- 예: 아메리카노 → 스타벅스 기준 4500~5500원

실제 지출(estimatedActualAmount) 추정 원칙:
- 사진에서 가격표, 영수증, 메뉴판이 보이면 그 금액을 사용하세요
- 보이지 않으면 한국 대학교 내 또는 주변의 일반적인 저렴한 가격을 추정하세요
- 예: 학식 → 3000~5000원, 천원 아침 → 1000원, 편의점 도시락 → 3500~5000원
- 예: 학교 카페 아메리카노 → 2000~3000원, 편의점 커피 → 1500~2000원
- 사진이 절약 상황(학식, 편의점, 공동구매 등)임을 감안해 낮은 가격대로 추정하세요`,
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
                  estimatedOriginalAmount: { type: "integer" },
                  estimatedActualAmount: { type: "integer" },
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
                required: ["title", "category", "estimatedOriginalAmount", "estimatedActualAmount", "reason", "confidence", "cropBox"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") throw new Error("AI 분석 결과를 받지 못했습니다");
        const parsed = JSON.parse(content) as {
          title: string; category: string;
          estimatedOriginalAmount: number;
          estimatedActualAmount: number;
          reason: string; confidence: "high" | "medium" | "low";
          cropBox: { x: number; y: number };
        };
        await logUsageEvent(ctx.user.id, "ai_analyze_image");
        return { ...parsed, imageUrl: `/manus-storage/${key}` };
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
              content: `카드 결제 알림 문자에서 정보를 추출해 JSON으로 반환하세요.

반환 형식 (파싱 성공 시):
{
  "parsed": true,
  "amount": 숫자 (원 단위, 실제 결제 금액),
  "merchant": "가맹점명",
  "date": "YYYY-MM-DD",
  "category": "식비 | 카페 | 교통 | 쇼핑 | 문화/여가 | 기타"
}

파싱 불가 시:
{ "parsed": false, "reason": "실패 이유" }

카테고리 분류 기준:
- 식비: 식당, 음식점, 배달, 마트, 편의점 식품
- 카페: 카페, 커피, 음료
- 교통: 버스, 지하철, 택시, 주유, 주차
- 쇼핑: 의류, 전자제품, 온라인쇼핑
- 문화/여가: 영화, 게임, 스포츠
- 기타: 분류 불가`,
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
