// 웹 푸시 구독 저장소 — 기기(endpoint) 단위 upsert/삭제.
import { eq } from "drizzle-orm";
import { pushSubscriptions } from "../../drizzle/schema";
import { getDb } from "./client";

export async function savePushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh, auth },
    });
}

export async function deletePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getAllPushSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions);
}
