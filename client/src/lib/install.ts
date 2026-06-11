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

// 브라우저 식별 — 설치 경로가 브라우저마다 달라 안내를 차등화 (#40 2차)
export type BrowserKind = "ios-safari" | "ios-other" | "android-chrome" | "android-samsung" | "android-other" | "desktop";
export function browserKind(): BrowserKind {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    // iOS의 크롬/엣지/파폭은 설치 불가 — 사파리로 보내야 한다
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other" : "ios-safari";
  }
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Chrome\//.test(ua)) return "android-chrome";
    return "android-other";
  }
  return "desktop";
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
