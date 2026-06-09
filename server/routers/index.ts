import { router } from "../trpc";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { savingsRouter } from "./savings";
import { categoriesRouter } from "./categories";
import { aiRouter } from "./ai";
import { adminRouter } from "./admin";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  savings: savingsRouter,
  categories: categoriesRouter,
  ai: aiRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
