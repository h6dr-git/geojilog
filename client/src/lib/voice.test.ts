// 세계관 정본 린트 — 바이블 v1.3의 법칙을 코드에 강제한다.
// 이 테스트가 깨지면: 임의 수정이 아니라 세계관_바이블.md(§5 보이스 정본·§7 폐기 기록)부터 확인할 것.
import { describe, it, expect } from "vitest";
import {
  DOSA_LINES, dosaLineOfDay, cpaSaveLine, cpaWeeklyComment, CPA_ZERO_LINE, CPA_TIPS,
  cpaRevealLine, ssalRevealCode, SSAL_CODES, ssalDisplay, profitEasterEgg, deskNote,
} from "./voice";

const ALL_SPOKEN: string[] = [
  ...DOSA_LINES, CPA_ZERO_LINE, ...CPA_TIPS,
  ...Array.from({ length: 40 }, () => cpaSaveLine(6000)),
  cpaWeeklyComment(0, 0), cpaWeeklyComment(3, 5000), cpaWeeklyComment(5, 35000), cpaWeeklyComment(7, 9999),
];

describe("정본 린트 — 폐기 워딩·구캐릭터·구호칭 금지 (§7)", () => {
  const banned = ["지켜냄", "지켜내", "지켰", "지킨", "CEO", "회장님", "김집사", "자르르", "쌀집군", "화이팅", "거지록", "AI"];
  it("모든 육성 대사에 폐기 워딩이 없다", () => {
    for (const line of ALL_SPOKEN)
      for (const w of banned) expect(line, `"${line}" ← 금지어 "${w}"`).not.toContain(w);
  });
});

describe("도사 — 정본 어록 8 (§3, 당위·평가 금지)", () => {
  it("어록은 정확히 8개", () => expect(DOSA_LINES).toHaveLength(8));
  it("당위·평가형 어미 금지", () => {
    for (const l of DOSA_LINES) expect(l).not.toMatch(/해야 한다|진짜 부자/);
  });
  it("오늘의 어록은 정본 중 하나", () => expect(DOSA_LINES).toContain(dosaLineOfDay()));
});

describe("말의 경제 (§5) — 회시생은 거의 말하지 않는다", () => {
  it("0원 기록엔 반드시 말한다 (취득원가 0원)", () => {
    expect(cpaRevealLine(0)).toBe(CPA_ZERO_LINE);
  });
  it("특별한 날(평소가 초과 등)엔 반드시 말한다", () => {
    for (let i = 0; i < 20; i++) expect(cpaRevealLine(6000, true)).toBeTruthy();
  });
  it("평일엔 침묵이 기본 (말하기도 하지만, 수다스럽지 않다)", () => {
    const spoken = Array.from({ length: 300 }, () => cpaRevealLine(6000, false)).filter(Boolean).length;
    expect(spoken).toBeGreaterThan(0);        // 가끔은 말한다
    expect(spoken).toBeLessThan(300 * 0.6);   // ~30% 설계 — 60% 넘으면 회귀
  });
  it("침묵 리빌의 쌀집이 코드는 100/1004뿐", () => {
    for (let i = 0; i < 50; i++) expect(["100", "1004"]).toContain(ssalRevealCode());
  });
});

describe("쌀집이 — 숫자어·LCD (§3)", () => {
  it("486은 유일한 희귀 코드", () => {
    expect(SSAL_CODES.filter((c) => c.rare).map((c) => c.code)).toEqual(["486"]);
  });
  it("금액 이스터에그는 의미 있는 숫자에만", () => {
    expect(profitEasterEgg(1004)).toBeTruthy();
    expect(profitEasterEgg(8282)).toBeTruthy();
    expect(profitEasterEgg(6000)).toBeNull();
  });
  it("집무실 말풍선 코드는 금액을 노출하지 않는다", () => {
    for (let i = 0; i < 50; i++) expect(ssalDisplay(i % 2 === 0).code).not.toMatch(/₩|,/);
  });
});

describe("쪽지 로테이션 — 쌀집이 비중 2/4 (§5 '거의 다 쌀집이로 말한다')", () => {
  it("4슬롯 = 도사·회시생·쌀집이·쌀집이", () => {
    expect(deskNote(0).speaker).toBe("dosa");
    expect(deskNote(1).speaker).toBe("cpa");
    expect(deskNote(2).speaker).toBe("ssal");
    expect(deskNote(3).speaker).toBe("ssal");
  });
});

describe("호칭 — 사장님 (v1.3)", () => {
  it("회시생 보고에 사장님 호칭이 살아 있다", () => {
    const lines = Array.from({ length: 40 }, () => cpaSaveLine(6000));
    expect(lines.some((l) => l.includes("사장님"))).toBe(true);
  });
});
