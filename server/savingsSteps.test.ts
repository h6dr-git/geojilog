import { describe, it, expect } from "vitest";
import {
  normalizeSavingsSteps,
  reconcileSavingsSteps,
  fallbackSavingsSteps,
  stepsSavedTotal,
  primarySource,
  MAX_SAVINGS_STEPS,
  type SavingsStep,
} from "@shared/incomeSources";

const sum = (s: SavingsStep[]) => s.reduce((t, x) => t + x.amount, 0);

describe("normalizeSavingsSteps", () => {
  it("유효 단계만 통과시키고 amount<=0·비객체는 버린다", () => {
    const r = normalizeSavingsSteps([
      { source: "학식/구내", label: "학생식당가", amount: 4000, reason: "x" },
      { source: "천원아침", label: "조식", amount: 0 }, // 버려짐
      { source: "x", label: "y", amount: -100 }, // 버려짐
      null,
      "nope",
    ]);
    expect(r).not.toBeNull();
    expect(r!).toHaveLength(1);
    expect(r![0].amount).toBe(4000);
  });
  it("배열이 아니거나 유효 단계가 없으면 null", () => {
    expect(normalizeSavingsSteps(null)).toBeNull();
    expect(normalizeSavingsSteps([{ amount: 0 }])).toBeNull();
  });
  it("문자열 숫자도 정수로 받아들이고 MAX 개수로 자른다", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ source: "s", label: "l", amount: String(100 + i) }));
    const r = normalizeSavingsSteps(many)!;
    expect(r.length).toBe(MAX_SAVINGS_STEPS);
    expect(r[0].amount).toBe(100);
  });
});

describe("reconcileSavingsSteps — 불변식 보장", () => {
  it("어떤 입력이든 Σamount === max(0, orig-act)", () => {
    const cases: Array<[number, number]> = [
      [8000, 1000], [8000, 8000], [5000, 0], [10000, 3000], [2000, 2500], [45000, 0],
    ];
    for (const [o, a] of cases) {
      const over = reconcileSavingsSteps([{ source: "x", label: "x", amount: 99999 }], o, a);
      const under = reconcileSavingsSteps([{ source: "x", label: "x", amount: 1 }], o, a);
      expect(sum(over)).toBe(Math.max(0, o - a));
      expect(sum(under)).toBe(Math.max(0, o - a));
    }
  });
  it("합>목표면 뒤 단계부터 깎고 0이 된 단계는 제거", () => {
    const r = reconcileSavingsSteps(
      [{ source: "a", label: "a", amount: 4000 }, { source: "b", label: "b", amount: 4000 }],
      8000, 5000 // target 3000
    );
    expect(sum(r)).toBe(3000);
    expect(r[0].amount).toBe(3000); // 첫 단계 유지
  });
  it("합<목표면 마지막 단계에 잔차 흡수", () => {
    const r = reconcileSavingsSteps([{ source: "a", label: "a", amount: 1000 }], 8000, 1000); // target 7000
    expect(sum(r)).toBe(7000);
    expect(r[r.length - 1].amount).toBe(7000);
  });
  it("steps 없고 절약>0이면 단일 '기타' 단계", () => {
    const r = reconcileSavingsSteps(null, 8000, 1000);
    expect(r).toHaveLength(1);
    expect(sum(r)).toBe(7000);
  });
  it("절약<=0이면 빈 배열", () => {
    expect(reconcileSavingsSteps([{ source: "a", label: "a", amount: 100 }], 5000, 5000)).toEqual([]);
    expect(reconcileSavingsSteps(null, 2000, 3000)).toEqual([]);
  });
});

describe("fallbackSavingsSteps / primarySource / stepsSavedTotal", () => {
  it("fallback은 수익원 라벨의 단일 단계, 절약 없으면 빈 배열", () => {
    expect(fallbackSavingsSteps("학식/구내", 8000, 4000)).toEqual([{ source: "학식/구내", label: "학식/구내", amount: 4000 }]);
    expect(fallbackSavingsSteps(null, 5000, 5000)).toEqual([]);
  });
  it("primarySource는 최대 절약 단계의 source", () => {
    expect(primarySource([{ source: "a", label: "a", amount: 1000 }, { source: "b", label: "b", amount: 4000 }])).toBe("b");
    expect(primarySource([])).toBeNull();
  });
  it("stepsSavedTotal은 음수/비유한 값을 0으로 처리해 합산", () => {
    expect(stepsSavedTotal([{ source: "a", label: "a", amount: 3000 }, { source: "b", label: "b", amount: 2000 }])).toBe(5000);
  });
});
