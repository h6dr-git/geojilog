// 캐릭터 보이스 — 도사 어록 · 김집사 보고체 · 자르르 한 마디 (세계관 바이블 §3·§4)
// 모든 카피의 화자 원칙: 김집사=보고체, 도사=품격 한 줄, 자르르=짧은 반말+의성어.

export const DOSA_LINES = [
  "남에게 보이려 쓰는 돈이, 너를 가난하게 한다.",
  "아낀 한 끼는 사라지지 않는다. 너의 내일로 갈 뿐.",
  "가벼운 지갑이 부끄러운 게 아니라, 빈 마음이 부끄러운 것이다.",
  "오늘 참은 작은 것이, 내일의 큰 자유가 된다.",
  "쓰지 않은 돈은, 가장 조용한 효도다.",
  "검소함은 궁상이 아니라, 제 삶의 주인이 되는 길이다.",
  "필요와 욕심을 가릴 줄 아는 자가, 진짜 부자다.",
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
export function jarureuLine(fedToday: boolean): string {
  const pool = fedToday ? JARUREU_FED_LINES : JARUREU_HUNGRY_LINES;
  return pool[Math.floor(Math.random() * pool.length)];
}
