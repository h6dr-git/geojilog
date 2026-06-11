import { router } from "../trpc";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { savingsRouter } from "./savings";
import { categoriesRouter } from "./categories";
import { aiRouter } from "./ai";
import { adminRouter } from "./admin";
import { pushRouter } from "./push";
import { itemsRouter } from "./items";
import { incomeSourcesRouter } from "./incomeSources";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  savings: savingsRouter,
  categories: categoriesRouter,
  ai: aiRouter,
  admin: adminRouter,
  push: pushRouter,
  items: itemsRouter,
  incomeSources: incomeSourcesRouter,
});

export type AppRouter = typeof appRouter;
