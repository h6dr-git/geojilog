// 캐릭터 보이스 — 도사 어록 · 김집사 보고체 · 자르르 한 마디 (세계관 바이블 §3·§4)
// 모든 카피의 화자 원칙: 김집사=보고체, 도사=품격 한 줄, 자르르=짧은 반말+의성어.

// 톤 규칙(2026-06-10 확정): A(덤덤한 관찰)+B(능청 셀프디스) 혼합.
// 당위("~해야 한다")·평가("~가 진짜 부자다")형 문장 금지 — 가르치려 들지 않는다.
export const DOSA_LINES = [
  // A — 덤덤한 관찰 (사실만 진술)
  "기록된 절약은 사라지지 않는다.",
  "오늘 장부에는, 쓰지 않은 돈이 남았다.",
  "아낀 돈은 조용해서, 장부가 대신 기억한다.",
  "천원의 아침에도 도(道)는 깃들어 있다.",
  // B — 능청 셀프디스 (도사가 자기 얘기로 웃김, 훈계 0)
  "이 몸도 어제 붕어빵 앞에서 도를 잃을 뻔했다.",
  "절약의 도는 깊다. 나도 아직 배달앱 앞에선 흔들린다.",
  "산속 수행 이십 년보다 1+1 앞 평정심이 더 어렵더라.",
  "오늘의 수행은 여기까지. 이 몸은 낮잠의 도를 닦으러 간다.",
];

export function dosaLineOfDay(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return DOSA_LINES[day % DOSA_LINES.length];
}

const won = (n: number) => "+₩" + n.toLocaleString("ko-KR");

// 김집사 — 저장 직후 보고 한 줄 (리빌 연출용)
export function butlerSaveLine(profit: number): string {
  const w = won(profit);
  const lines = [
    `회장님, 금일 ${w} 수익 실현하셨습니다.`,
    `회장님, ${w} 지켜내셨습니다. 월가가 술렁이고 있습니다.`,
    `탁월한 운용이십니다. ${w}, 장부에 기록해 두었습니다.`,
    `보고드립니다. ${w} — 오늘도 한 수 두셨습니다.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// 김집사 — 주간 결산 평 (Wrapped용)
export function butlerWeeklyComment(count: number, profit: number): string {
  if (count === 0) return "이번 주는 조용했습니다. 다음 주, 첫 수를 기다리겠습니다.";
  if (count >= 7) return `한 주 내내 ${count}끼를 지켜내셨습니다. 이런 운용은 흔치 않습니다, 회장님.`;
  if (profit >= 30000) return `${count}끼로 굵직한 수익을 실현하셨습니다. 시장이 회장님을 주목하고 있습니다.`;
  if (count >= 4) return `${count}끼, 꾸준함이 곧 복리입니다. 다음 주도 모시겠습니다.`;
  return `${count}끼를 지켜내셨습니다. 작은 수라도 장부는 기억합니다.`;
}

// 자르르 — 집무실에서 탭했을 때 (안전 로비 — 숫자 노출 금지)
export const JARUREU_FED_LINES = [
  "오늘도 아꼈다!! 배부르다아~",
  "찼다!! 또 찼어!!",
  "자르르~ 윤기 나는 거 보여?",
  "더 줘도 돼!! 다 담을 수 있어!",
];
export const JARUREU_HUNGRY_LINES = [
  "오늘은 아직 한 입도 못 먹었어…",
  "배고프다아… 한 끼만 아껴줘…",
  "기록 한 번이면 힘날 것 같아!",
];
export function jarureuLine(fedToday: boolean, exclude?: string | null): string {
  const pool = (fedToday ? JARUREU_FED_LINES : JARUREU_HUNGRY_LINES).filter((l) => l !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
