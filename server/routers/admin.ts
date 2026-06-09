import { adminProcedure, router } from "../trpc";
import { getUsageStats } from "../db";

export const adminRouter = router({
    // 운영 지표 조회(소유자/관리자 전용). 화면(대시보드)에서 호출해 쓸 수 있다.
    usageStats: adminProcedure.query(async () => {
      return getUsageStats();
    }),
});
