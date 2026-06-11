// PWA 설치 (#40) — 깔려 있어야 자주 쓴다. 기종별로 가능한 가장 매끄러운 경로 제공:
//  Android Chrome: beforeinstallprompt를 잡아 네이티브 설치 프롬프트를 우리 버튼으로 트리거
//  iOS Safari: 설치 API가 없음 → 안내 시트(공유 → 홈 화면에 추가)
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferredPrompt: BIPEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    standalone: isStandalone(),
    ios: isIOS(),
    canPrompt: deferredPrompt != null,
    promptInstall: async () => {
      if (!deferredPrompt) return false;
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") deferredPrompt = null;
      return choice.outcome === "accepted";
    },
  };
}
