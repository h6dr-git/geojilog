// 저장 축하(리빌) 이벤트 버스 — 어디서 저장하든(QuickRecord·장부 큐·수동입력) 같은 연출을 띄운다.
export type RevealDetail = { profit: number; title?: string; bonus?: number /* #37 — 평소보다 더 아낀 금액 */ };

const EVT = "geojilog:save-reveal";

export function celebrateSave(detail: RevealDetail) {
  window.dispatchEvent(new CustomEvent<RevealDetail>(EVT, { detail }));
}

export function onCelebrate(cb: (d: RevealDetail) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<RevealDetail>).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
