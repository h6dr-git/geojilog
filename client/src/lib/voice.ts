// 캐릭터 보이스 — 도사(철학과 교수 지망생·고문) 어록 · 회시생(회계 담당) 보고체 · 쌀집이 숫자어
// 세계관: '예비의 세계' — 서로는 서로를 알아본다 (문서/세계관_바이블.md v1.1 = SSOT, 제4조 현실 법칙)
// 화자 원칙: 회시생=극존칭 데드팬 보고(사장님), 도사=옆방 백수(회시생 경유 전달), 쌀집이=무생물(인격은 회시생의 우기기 — 시스템 문구 주어는 회시생).

// ── 무일푼 도사 — 철학과 교수 지망생(박사수료·임용 대기), 무보수 비상임 고문. 당위·평가 금지 ──
export const DOSA_LINES = [
  "기록된 절약은 사라지지 않는다.",
  "오늘 장부에는, 쓰지 않은 돈이 남았다.",
  "아낀 돈은 조용해서, 장부가 대신 기억한다.",
  "천원의 아침에도 도(道)는 깃들어 있다.",
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

// ── 회시생 — 저장 직후 보고 (리빌) ──────────────────────────
// 결(v1.3): 숫자 먼저·사실 먼저. 빈말 금지(신빙성=캐릭터). 자격·시험·신세 언급 금지, 보고 1문장+촌평 1문장.
export function cpaSaveLine(profit: number): string {
  const w = won(profit);
  // v1.3(F1·F6): 빈말·근거 없는 칭찬 금지 — 숫자와 사실이 먼저, 신빙성이 캐릭터다.
  const lines = [
    `사장님, 금일 ${w} 수익 실현하셨습니다. 계상해 두었습니다.`,
    `${w}, 계상 완료했습니다. 증빙도 보관해 두었습니다.`,
    `금일 거래 1건, ${w}. 장부 이상 없습니다.`,
    `${w} 확인했습니다. 감사의견, 적정입니다.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ── 회시생 — 주간 결산 평 (Wrapped·보고서) ──────────────────
export function cpaWeeklyComment(count: number, profit: number): string {
  if (count === 0) return "이번 주는 거래내역이 없습니다. 큰 거래 전엔 늘 그렇습니다.";
  if (count >= 7) return `한 주 연속 계상입니다. 이런 성실성은 가르칠 수 없는 겁니다, 사장님.`;
  if (profit >= 30000) return `${count}건으로 굵직한 수익 실현입니다. 감사의견, 적정.`;
  if (count >= 4) return `${count}건. 꾸준함은 복리로 계상됩니다.`;
  return `${count}건, 전부 계상했습니다. 장부는 거짓말하지 않습니다.`;
}

// ── 회시생 — 0원 기록(공짜·얻어먹음) 특수 촌평 ──────────────
export const CPA_ZERO_LINE = "취득원가 0원. 회계적으로 가장 아름다운 자산입니다.";

// ── 말의 경제 (v1.2 상욱): 회시생은 거의 다 쌀집이(숫자)로 말한다 ──
// 육성(문장)은 '할 말이 있는 날'만: 0원·이스터에그·평소가 초과 등은 반드시, 평일은 ~30%.
// 침묵하는 날의 리빌은 쌀집이 코드가 대신한다 — "회계사는 말보다 숫자로 말한다."
export function cpaRevealLine(profit: number, special = false): string | null {
  if (profit === 0) return CPA_ZERO_LINE;
  if (special) return cpaSaveLine(profit);
  return Math.random() < 0.3 ? cpaSaveLine(profit) : null;
}
export function ssalRevealCode(): string {
  return Math.random() < 0.5 ? "100" : "1004";
}

// ── 회시생의 메모 — 앱 사용 팁 (오늘의 쪽지 로테이션) ────────
export const CPA_TIPS = [
  "사진 여러 장을 한 번에 올리실 수 있습니다. 장부의 '기록 추가'를 이용해 보시지요.",
  "지난 사진도 됩니다 — 날짜는 쌀집이이 읽어냅니다.",
  "결산 카드는 테마와 스티커로 꾸미실 수 있습니다. 서가에 소장됩니다.",
  "쌀집이가 두드린 금액은 추정치입니다. 탭해서 언제든 정정하십시오.",
  "서재에서 주간·월간 보고를 넘겨보실 수 있습니다.",
  "기록마다 '내 썰 한 줄'을 남기면, 나만 보는 일기가 됩니다.",
];

// ── 쌀집이 — 숫자어 (#41 v3: 말을 못 하는 계산기의 언어) ─────
// 코드를 탭하면 뜻이 잠깐 표시된다. 486은 희귀 전용(오그라듦 방지).
export type SsalCode = { code: string; meaning: string; rare?: boolean };
export const SSAL_CODES: SsalCode[] = [
  { code: "8282", meaning: "빨리빨리" },
  { code: "1004", meaning: "고마워, 천사" },
  { code: "045", meaning: "빵 사와" },
  { code: "100", meaning: "백점" },
  { code: "0", meaning: "텅" },
  { code: "486", meaning: "사랑해", rare: true },
];

// 집무실 탭 이스터에그 — 숫자어 코드만(금액 아님). LCD 수익은 별도 상시 표시.
export function ssalDisplay(fedToday: boolean, exclude?: string | null): SsalCode & { rare: boolean } {
  if (Math.random() < 0.08) {
    const rare = SSAL_CODES.find((c) => c.rare)!;
    if (rare.code !== exclude) return { ...rare, rare: true };
  }
  const pool = SSAL_CODES.filter((c) =>
    !c.rare && (fedToday ? ["1004", "100"] : ["8282", "045"]).includes(c.code) && c.code !== exclude
  );
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? SSAL_CODES[0];
  return { ...pick, rare: false };
}

// ── 금액 이스터에그 (#41 v3 상욱 지시) — 수익 금액 자체가 의미 있는 숫자일 때 ──
export function profitEasterEgg(profit: number): string | null {
  const map: Record<number, string> = {
    1004: "천사의 수익입니다.",
    8282: "스피드 수익 실현입니다.",
    486: "사랑이 계상되었습니다.",
    100: "백 점짜리 수익입니다.",
    10000: "만점입니다, 사장님.",
  };
  return map[profit] ?? null;
}

// ── 오늘의 쪽지 — 기록 행동(총 기록 수)으로 로테이션 ─────────
// 쌀집이의 쪽지는 숫자 코드만 적혀 있다 (뜻은 아는 사람만 — 발견 재미).
export type DeskNote = { speaker: "dosa" | "cpa" | "ssal"; text: string };
export function deskNote(recordCount: number): DeskNote {
  // v1.2 말의 경제: 쌀집이 2/4 — 회시생의 기본 채널은 숫자다.
  const r = recordCount % 4;
  const idx = Math.floor(recordCount / 4);
  if (r === 0) return { speaker: "dosa", text: DOSA_LINES[idx % DOSA_LINES.length] };
  if (r === 1) return { speaker: "cpa", text: CPA_TIPS[idx % CPA_TIPS.length] };
  const codes = SSAL_CODES.filter((c) => !c.rare);
  return { speaker: "ssal", text: codes[(idx * 2 + (r - 2)) % codes.length].code };
}
