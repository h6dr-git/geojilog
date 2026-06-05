import { TRPCError } from "@trpc/server";

// 원본 복구본: 코드 전체에서 ForbiddenError만 사용됩니다.
// (필요 시 다른 에러 헬퍼를 같은 방식으로 추가할 수 있습니다.)
export const ForbiddenError = (message: string) =>
  new TRPCError({ code: "FORBIDDEN", message });
