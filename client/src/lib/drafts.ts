// 미완성 기록(사진만 찍고 금액은 나중에) — 기기 로컬 보관.
// 사진은 이미 서버에 저장돼 있고(imageUrl), 여기엔 메타데이터만 둔다.
// (기기 간 동기화가 필요해지면 DB로 승격)
import { useEffect, useState } from "react";

export type Draft = {
  id: string;
  imageUrl: string;
  title: string;
  category: string;
  originalAmount: number | null;
  actualAmount: number | null;
  aiReason?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
};

const KEY = "geojilog:drafts";
const EVENT = "geojilog:drafts-changed";

function read(): Draft[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

function write(list: Draft[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

export function getDrafts(): Draft[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function addDraft(d: Omit<Draft, "id" | "createdAt">): Draft {
  const draft: Draft = { ...d, id: crypto.randomUUID(), createdAt: Date.now() };
  write([draft, ...read()]);
  return draft;
}

export function removeDraft(id: string) {
  write(read().filter((d) => d.id !== id));
}

/** 미완성 목록을 구독하는 훅 — 추가/삭제 시 자동 갱신. */
export function useDrafts(): Draft[] {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    typeof window === "undefined" ? [] : getDrafts(),
  );
  useEffect(() => {
    const update = () => setDrafts(getDrafts());
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return drafts;
}
