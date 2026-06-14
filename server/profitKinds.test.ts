import { describe, expect, it } from "vitest";
import { amountsForProfitKind, inferProfitKind } from "@shared/profitKinds";

describe("inferProfitKind", () => {
  it("maps income sources to kinds", () => {
    expect(inferProfitKind("얻어먹음", 8000, 0)).toBe("receive");
    expect(inferProfitKind("참음/대체", 5000, 0)).toBe("restrain");
    expect(inferProfitKind("알바", 50000, 0)).toBe("earn");
    expect(inferProfitKind("학식/구내", 8000, 4500)).toBe("save");
  });
});

describe("amountsForProfitKind", () => {
  it("earn uses original as profit with zero actual", () => {
    expect(amountsForProfitKind("earn", 120000, 999)).toEqual({
      originalAmount: 120000,
      actualAmount: 0,
      profit: 120000,
    });
  });

  it("save subtracts actual from original", () => {
    expect(amountsForProfitKind("save", 8000, 1000)).toEqual({
      originalAmount: 8000,
      actualAmount: 1000,
      profit: 7000,
    });
  });
});
