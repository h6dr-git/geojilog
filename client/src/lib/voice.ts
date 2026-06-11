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
    `회장님, ${w} 버셨습니다. 월가가 술렁이고 있습니다.`,
    `탁월한 운용이십니다. ${w}, 장부에 기록해 두었습니다.`,
    `보고드립니다. ${w} — 오늘도 한 수 두셨습니다.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// 김집사 — 주간 결산 평 (Wrapped용)
export function butlerWeeklyComment(count: number, profit: number): string {
  if (count === 0) return "이번 주는 조용했습니다. 다음 주, 첫 수를 기다리겠습니다.";
  if (count >= 7) return `한 주 내내 ${count}끼를 기록하셨습니다. 이런 운용은 흔치 않습니다, 회장님.`;
  if (profit >= 30000) return `${count}끼로 굵직한 수익을 실현하셨습니다. 시장이 회장님을 주목하고 있습니다.`;
  if (count >= 4) return `${count}끼, 꾸준함이 곧 복리입니다. 다음 주도 모시겠습니다.`;
  return `${count}끼로 수익을 내셨습니다. 작은 수라도 장부는 기억합니다.`;
}

// 김집사의 집무 메모 — 앱 사용 팁 (오늘의 쪽지 로테이션용, 기능 발견율↑)
export const BUTLER_TIPS = [
  "사진 여러 장을 한 번에 올리실 수 있습니다. 장부의 '기록 추가'를 이용해 보시지요.",
  "지난 사진을 올리셔도 됩니다 — 날짜는 자르르가 알아서 읽습니다.",
  "결산 카드는 테마와 스티커로 취향껏 꾸미실 수 있습니다 — 서재에서.",
  "AI 추정 금액은 참고용입니다. 탭해서 언제든 고치실 수 있습니다.",
  "서재에서 주간·월간 보고를 넘겨보실 수 있습니다.",
  "기록마다 '내 썰 한 줄'을 남기면, 나만 보는 일기가 됩니다.",
];

// 자르르의 낙서 — 한 줄 (오늘의 쪽지 로테이션용)
export const JARUREU_NOTES = [
  "오늘도 채워줘!! 기다리고 있을게~",
  "어제 그 기록 맛있었어… 또 줘!",
  "단지는 비어도 다시 차오른다! 자르르~",
  "결제 알림음은 무서워… 사진 찍는 소리는 좋아!",
];

// 오늘의 쪽지 — 갱신 기준은 시간이 아니라 '기록 행동'(총 기록 수). 기록할 때마다 다음 쪽지로 넘어간다.
export type DeskNote = { speaker: "dosa" | "butler" | "jarureu"; text: string };
export function deskNote(recordCount: number): DeskNote {
  const r = recordCount % 3;
  const idx = Math.floor(recordCount / 3);
  if (r === 0) return { speaker: "dosa", text: DOSA_LINES[idx % DOSA_LINES.length] };
  if (r === 1) return { speaker: "butler", text: BUTLER_TIPS[idx % BUTLER_TIPS.length] };
  return { speaker: "jarureu", text: JARUREU_NOTES[idx % JARUREU_NOTES.length] };
}

// 자르르 — 집무실 상주 인사 (시간대별 · 당위/숫자 없음)
// 집무실 말풍선은 자르르 전용: 김집사 인사는 귀속 혼동 피드백으로 퇴장(김집사 채널 = 쪽지·푸시·결산)
export function jarureuIdleLine(): string {
  const h = new Date().getHours();
  if (h < 6) return "흐냐… 늦었네. 왔어…?";
  if (h < 11) return "좋은 아침!! 기지개 쭉—";
  if (h < 14) return "벌써 점심때다~ 오늘도 자르르!";
  if (h < 18) return "나른한 오후야아… 흐암.";
  if (h < 22) return "오늘 하루도 수고했어!!";
  return "하루 마감할 시간이야~ 같이 닫자!";
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
// 희귀 대사 — 낮은 확률(8%). 떴을 때 '희귀'임이 보이도록 UI에서 골드 처리 + 탭 잠금 + 타이머 바.
// 멘트 규칙: 세계관 사전지식 없이도 통하는 자기완결 유머만(피드백: 떡밥형은 모르는 사람에게 오그라듦).
export const JARUREU_RARE_LINES = [
  "내 뚜껑? …모자 아니야. 아니다, 모자 맞아.",
  "결제 알림음 들으면 나 진짜 기절해. 시험해 보진 마.",
  "네가 안 쓴 돈, 사실 내가 다 세고 있어.",
  "오늘따라 회장님 손이 따뜻하네…",
];

export type JarureuSay = { text: string; rare: boolean };
export function jarureuLine(fedToday: boolean, exclude?: string | null): JarureuSay {
  if (Math.random() < 0.08) {
    const pool = JARUREU_RARE_LINES.filter((l) => l !== exclude);
    return { text: pool[Math.floor(Math.random() * pool.length)], rare: true };
  }
  const pool = (fedToday ? JARUREU_FED_LINES : JARUREU_HUNGRY_LINES).filter((l) => l !== exclude);
  return { text: pool[Math.floor(Math.random() * pool.length)], rare: false };
}
