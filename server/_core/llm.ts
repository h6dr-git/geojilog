// 개인/로컬용: Google Gemini를 직접 호출합니다 (OpenAI 호환 엔드포인트).
// 키는 .env 의 GEMINI_API_KEY 를 사용합니다.
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type MessageContent = string | TextContent | ImageContent;
export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
};

// 호환용 타입 (routers.ts 가 response_format 등을 넘겨도 무시하고 받습니다)
export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  max_tokens?: number;
  // 아래는 받기만 하고 Gemini 호출엔 쓰지 않습니다 (프롬프트로 JSON을 유도)
  [key: string]: unknown;
};

export type InvokeResult = {
  choices: Array<{
    message: { role: Role; content: string };
    finish_reason: string | null;
  }>;
};

// ── 설정 ──────────────────────────────────────────────
// 감도/정확도를 바꾸고 싶으면 routers.ts 의 프롬프트(가격 추정 규칙)를 고치세요.
// 더 똑똑하게(느리지만) 하려면 MODEL 을 "gemini-2.5-pro" 로 바꿀 수 있습니다.
const MODEL = "gemini-2.5-flash";
const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// 일시적 오류(과부하/혼잡/속도제한)일 때 자동 재시도
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [700, 1500, 3000]; // 최대 3회 재시도

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeContent(content: MessageContent | MessageContent[]) {
  const arr = Array.isArray(content) ? content : [content];
  const parts = arr.map((p) =>
    typeof p === "string" ? { type: "text", text: p } : p
  );
  // 텍스트 한 덩어리면 문자열로 축약 (호환성)
  if (parts.length === 1 && parts[0].type === "text") {
    return (parts[0] as TextContent).text;
  }
  return parts;
}

// 모델이 ```json ... ``` 코드블록으로 감싸 줄 때를 대비해 순수 JSON만 남깁니다.
function stripJsonFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY가 없습니다. 프로젝트 루트의 .env 파일에 GEMINI_API_KEY=... 를 넣고 서버를 다시 켜주세요."
    );
  }

  const messages = params.messages.map((m) => ({
    role: m.role,
    content: normalizeContent(m.content),
  }));
  const maxTokens =
    (typeof params.maxTokens === "number" && params.maxTokens) ||
    (typeof params.max_tokens === "number" && params.max_tokens) ||
    8192;

  const payload = {
    model: MODEL,
    messages,
    max_tokens: maxTokens,
  };

  let lastErrorText = "";
  let lastStatus = 0;

  // 첫 시도 + 재시도(RETRY_DELAYS_MS 횟수만큼)
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.geminiApiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      // 네트워크 자체 실패도 재시도
      lastErrorText = String(networkErr);
      lastStatus = 0;
      if (attempt < RETRY_DELAYS_MS.length) {
        console.warn(`[Gemini] 네트워크 오류, ${RETRY_DELAYS_MS[attempt]}ms 후 재시도 (${attempt + 1})`);
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(`Gemini 호출 실패(네트워크): ${lastErrorText}`);
    }

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | Array<{ text?: string }> };
          finish_reason?: string | null;
        }>;
      };
      const choices = (data.choices ?? []).map((c) => {
        let content: unknown = c?.message?.content;
        if (Array.isArray(content)) {
          content = content.map((p) => p?.text ?? "").join("");
        }
        if (typeof content !== "string") content = "";
        return {
          message: {
            role: "assistant" as Role,
            content: stripJsonFences(content as string),
          },
          finish_reason: c?.finish_reason ?? null,
        };
      });
      return { choices };
    }

    // 실패 — 재시도 가능한 상태면 잠깐 기다렸다 다시
    lastStatus = response.status;
    lastErrorText = await response.text().catch(() => "");
    if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
      console.warn(
        `[Gemini] ${response.status}(일시적), ${RETRY_DELAYS_MS[attempt]}ms 후 재시도 (${attempt + 1}/${RETRY_DELAYS_MS.length})`
      );
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    break; // 재시도 불가 또는 횟수 소진
  }

  throw new Error(
    `Gemini 호출 실패: ${lastStatus} – ${lastErrorText}`
  );
}
