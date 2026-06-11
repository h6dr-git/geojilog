// 전역 '분석 중' 신호 — 장부 큐·홈 캡처 어디서 분석하든 모든 탭에서 보이게. (피드백 #32)
let count = 0;
const EVT = "geojilog:analyzing-count";

function dispatch() {
  window.dispatchEvent(new CustomEvent<number>(EVT, { detail: count }));
}
export function analyzingStart() {
  count += 1;
  dispatch();
}
export function analyzingEnd() {
  count = Math.max(0, count - 1);
  dispatch();
}
export function onAnalyzingCount(cb: (n: number) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<number>).detail);
  window.addEventListener(EVT, h);
  cb(count); // 현재값 즉시 전달
  return () => window.removeEventListener(EVT, h);
}
