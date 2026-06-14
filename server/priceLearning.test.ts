import { describe, expect, it } from "vitest";
import { buildPriceLearningPrompt } from "./db/priceLearning";

describe("buildPriceLearningPrompt", () => {
  it("returns empty string when no hints", () => {
    expect(buildPriceLearningPrompt([])).toBe("");
  });

  it("formats hints as numbered list", () => {
    const out = buildPriceLearningPrompt([
      { kind: "comment", title: "학식", category: "식비", note: "학식은 4500원이에요" },
      { kind: "correction", category: "카페", note: "기준가 AI 5000→확정 4500" },
    ]);
    expect(out).toContain("과거 가격 피드백");
    expect(out).toContain("학식 · 식비");
    expect(out).toContain("4500원");
    expect(out).toContain("보정");
  });
});
