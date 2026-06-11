import { eq } from "drizzle-orm";
import { InsertUser, users, savingsEntries, userCategories, userItems, userIncomeSources, reportCards, pushSubscriptions, usageEvents } from "../../drizzle/schema";
import { ENV } from "../env";
import { getDb } from "./client";

// ── Users ──────────────────────────────────────────

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 익명 자동 계정 등 새 사용자 생성, 새 id 반환 */
export async function createUser(data: { openId: string; name?: string | null; loginMethod?: string | null }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(users)
    .values({ openId: data.openId, name: data.name ?? null, loginMethod: data.loginMethod ?? null })
    .returning({ id: users.id });
  return row.id;
}

/** 기존(익명) 계정을 소셜 신원으로 연결하거나 프로필 갱신 */
export async function updateUserIdentity(
  id: number,
  data: { openId: string; name?: string | null; loginMethod?: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: Record<string, unknown> = { openId: data.openId };
  if (data.name !== undefined) set.name = data.name;
  if (data.loginMethod !== undefined) set.loginMethod = data.loginMethod;
  await db.update(users).set(set).where(eq(users.id, id));
}

/** 게스트 계정의 데이터(절약기록·커스텀 카테고리)를 다른 계정으로 합친다(로그인 시 데이터 보존). */
export async function mergeUserData(fromUserId: number, toUserId: number): Promise<void> {
  if (fromUserId === toUserId) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and, inArray } = await import("drizzle-orm");

  // 절약기록 이동: 같은 내용(date+title+category+originalAmount+actualAmount)이
  // 이미 to에 있으면 중복이므로 옮기지 않고(게스트 중복 사본은 정리), 없는 것만 옮긴다.
  const keyOf = (e: {
    date: string; title: string; category: string;
    originalAmount: number; actualAmount: number;
  }) => `${e.date} ${e.title} ${e.category} ${e.originalAmount} ${e.actualAmount}`;

  const [fromEntries, toEntries] = await Promise.all([
    db.select().from(savingsEntries).where(eq(savingsEntries.userId, fromUserId)),
    db.select().from(savingsEntries).where(eq(savingsEntries.userId, toUserId)),
  ]);

  const existingKeys = new Set(toEntries.map(keyOf));
  const moveIds: number[] = [];
  const dupIds: number[] = [];
  for (const e of fromEntries) {
    if (existingKeys.has(keyOf(e))) dupIds.push(e.id); // 이미 to에 있는 중복 → 옮기지 않음
    else moveIds.push(e.id);
  }

  if (moveIds.length > 0) {
    await db.update(savingsEntries).set({ userId: toUserId }).where(inArray(savingsEntries.id, moveIds));
  }
  if (dupIds.length > 0) {
    // 옮기지 않은 게스트 중복분은 남기면 고아 레코드가 되므로 삭제(데이터는 to에 보존됨).
    await db.delete(savingsEntries).where(inArray(savingsEntries.id, dupIds));
  }

  // 기본 카테고리는 양쪽에 다 있어 중복되니 직접 만든(커스텀) 카테고리만 이동
  await db
    .update(userCategories)
    .set({ userId: toUserId })
    .where(and(eq(userCategories.userId, fromUserId), eq(userCategories.isDefault, "no")));

  // ── B1 수선 (2026-06-11): "기록 그대로 따라와" 약속을 전 테이블로 ──
  // 유니크 제약이 있는 테이블은 to 쪽 기존 행 우선, 충돌하는 from 행은 삭제(고아 방지).

  // 서가 소장 카드 (#50) — UNIQUE(userId, periodType, startDate)
  const [fromCards, toCards] = await Promise.all([
    db.select().from(reportCards).where(eq(reportCards.userId, fromUserId)),
    db.select().from(reportCards).where(eq(reportCards.userId, toUserId)),
  ]);
  const cardKey = (c: { periodType: string; startDate: string }) => `${c.periodType}|${c.startDate}`;
  const toCardKeys = new Set(toCards.map(cardKey));
  const cardMove = fromCards.filter((c) => !toCardKeys.has(cardKey(c))).map((c) => c.id);
  const cardDrop = fromCards.filter((c) => toCardKeys.has(cardKey(c))).map((c) => c.id);
  if (cardMove.length) await db.update(reportCards).set({ userId: toUserId }).where(inArray(reportCards.id, cardMove));
  if (cardDrop.length) await db.delete(reportCards).where(inArray(reportCards.id, cardDrop));

  // 커스텀 수익원 (#47) — UNIQUE(userId, name)
  const [fromSrc, toSrc] = await Promise.all([
    db.select().from(userIncomeSources).where(eq(userIncomeSources.userId, fromUserId)),
    db.select().from(userIncomeSources).where(eq(userIncomeSources.userId, toUserId)),
  ]);
  const toSrcNames = new Set(toSrc.map((r) => r.name));
  const srcMove = fromSrc.filter((r) => !toSrcNames.has(r.name)).map((r) => r.id);
  const srcDrop = fromSrc.filter((r) => toSrcNames.has(r.name)).map((r) => r.id);
  if (srcMove.length) await db.update(userIncomeSources).set({ userId: toUserId }).where(inArray(userIncomeSources.id, srcMove));
  if (srcDrop.length) await db.delete(userIncomeSources).where(inArray(userIncomeSources.id, srcDrop));

  // 단골 사전 (UI는 동면, 서버 축적은 계속 — #47) — UNIQUE(userId, normName)
  const [fromItems, toItems] = await Promise.all([
    db.select().from(userItems).where(eq(userItems.userId, fromUserId)),
    db.select().from(userItems).where(eq(userItems.userId, toUserId)),
  ]);
  const toNorm = new Set(toItems.map((r) => r.normName));
  const itemMove = fromItems.filter((r) => !toNorm.has(r.normName)).map((r) => r.id);
  const itemDrop = fromItems.filter((r) => toNorm.has(r.normName)).map((r) => r.id);
  if (itemMove.length) await db.update(userItems).set({ userId: toUserId }).where(inArray(userItems.id, itemMove));
  if (itemDrop.length) await db.delete(userItems).where(inArray(userItems.id, itemDrop));

  // 푸시 구독 — endpoint가 전역 유니크라 userId만 바꾸면 됨 (같은 기기, 같은 사람)
  await db.update(pushSubscriptions).set({ userId: toUserId }).where(eq(pushSubscriptions.userId, fromUserId));

  // 사용 이벤트 — 계기판(D1/D7·활동일)의 연속성: 같은 사람의 행적을 한 줄로
  await db.update(usageEvents).set({ userId: toUserId }).where(eq(usageEvents.userId, fromUserId));
}

/** 사용자 표시 이름(닉네임) 변경 */
export async function updateUserName(id: number, name: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ name }).where(eq(users.id, id));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}
