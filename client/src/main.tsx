import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// [작업1-b] 인증 에러 시 window.location.href 강제 이동 제거.
//  - 기존: 401 발생 -> 페이지를 통째로 새로고침 -> 업로드 큐(분석 중 사진들)가 전멸.
//  - 변경: 강제 이동을 없애고 로깅만. 인증 끊김은 useAuth/Home의 인라인 "다시 시도"
//    화면이 비파괴적으로 처리하므로, 분석 중이던 원본 File과 큐가 보존된다.
const logUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  // 강제 새로고침/리다이렉트 없음 - 큐 보존이 우선.
  console.warn("[Auth] 세션 인증 실패 — 페이지 새로고침 없이 인라인 복구에 위임합니다.");
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    logUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    logUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

import "@/lib/install"; // PWA 설치 프롬프트 조기 캡처 (#40)

// 웹 푸시용 서비스워커 — 지원 환경에서만 조용히 등록
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* 미지원/실패 시 무시 — 푸시 없이도 앱은 동일하게 동작 */
    });
  });
}
