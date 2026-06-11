// #47 — 사용자 커스텀 수익원. 기본 9종(shared 상수) 위에 사용자가 얹는 추가 유형.
// 이름변경은 기존 기록의 incomeSource 문자열까지 함께 갱신한다 (유령 유형 방지).
import { and, eq } from "drizzle-orm";
import { userIncomeSources, savingsEntries } from "../../drizzle/schema";
import { getDb } from "./client";
import { isIncomeSource, CUSTOM_SOURCE_MAX, CUSTOM_SOURCE_NAME_MAX } from "@shared/incomeSources";

export async function listUserIncomeSources(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userIncomeSources)
    .where(eq(userIncomeSources.userId, userId))
    .orderBy(userIncomeSources.createdAt);
}

// 유효한 수익원인가 — 기본 9종이거나 이 사용자의 커스텀 유형 (savings create/update 검증용)
export async function isValidIncomeSourceFor(userId: number, name: string): Promise<boolean> {
  if (isIncomeSource(name)) return true;
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: userIncomeSources.id })
    .from(userIncomeSources)
    .where(and(eq(userIncomeSources.userId, userId), eq(userIncomeSources.name, name)))
    .limit(1);
  return rows.length > 0;
}

export async function createUserIncomeSource(userId: number, rawName: string) {
  const name = rawName.trim();
  if (!name) throw new Error("유형 이름을 입력해 주세요");
  if (name.length > CUSTOM_SOURCE_NAME_MAX) throw new Error(`유형 이름은 ${CUSTOM_SOURCE_NAME_MAX}자 이내로`);
  if (isIncomeSource(name) || name === "미분류") throw new Error("이미 있는 기본 유형이에요");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await listUserIncomeSources(userId);
  if (existing.length >= CUSTOM_SOURCE_MAX) throw new Error(`커스텀 유형은 ${CUSTOM_SOURCE_MAX}개까지예요`);
  if (existing.some((r) => r.name === name)) throw new Error("이미 추가한 유형이에요");
  const [row] = await db.insert(userIncomeSources).values({ userId, name }).returning({ id: userIncomeSources.id });
  return row;
}

export async function renameUserIncomeSource(userId: number, id: number, rawName: string) {
  const name = rawName.trim();
  if (!name) throw new Error("유형 이름을 입력해 주세요");
  if (name.length > CUSTOM_SOURCE_NAME_MAX) throw new Error(`유형 이름은 ${CUSTOM_SOURCE_NAME_MAX}자 이내로`);
  if (isIncomeSource(name) || name === "미분류") throw new Error("기본 유형과 같은 이름은 안 돼요");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(userIncomeSources)
    .where(and(eq(userIncomeSources.userId, userId), eq(userIncomeSources.id, id)))
    .limit(1);
  const old = rows[0];
  if (!old) throw new Error("유형을 찾을 수 없어요");
  await db.update(userIncomeSources).set({ name }).where(eq(userIncomeSources.id, old.id));
  // 기존 기록까지 새 이름으로 — 통계·필터 연속성 유지
  await db
    .update(savingsEntries)
    .set({ incomeSource: name })
    .where(and(eq(savingsEntries.userId, userId), eq(savingsEntries.incomeSource, old.name)));
  return { oldName: old.name, newName: name };
}

// 삭제 — 해당 유형이 달린 기록은 미분류(null)로 되돌린다 (유령 유형을 남기지 않음)
export async function deleteUserIncomeSource(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(userIncomeSources)
    .where(and(eq(userIncomeSources.userId, userId), eq(userIncomeSources.id, id)))
    .limit(1);
  const target = rows[0];
  if (!target) return { affected: 0 };
  await db.delete(userIncomeSources).where(eq(userIncomeSources.id, target.id));
  await db
    .update(savingsEntries)
    .set({ incomeSource: null })
    .where(and(eq(savingsEntries.userId, userId), eq(savingsEntries.incomeSource, target.name)));
  return { affected: 1 };
}
