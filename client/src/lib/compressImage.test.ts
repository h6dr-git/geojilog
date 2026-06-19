import { describe, it, expect } from "vitest";
import { scaleToMaxSide } from "./compressImage";

describe("scaleToMaxSide", () => {
  it("긴 변이 maxSide 이하면 원본 크기 유지", () => {
    expect(scaleToMaxSide(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("가로가 긴 사진은 maxSide 기준으로 축소", () => {
    expect(scaleToMaxSide(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
  });

  it("세로가 긴 사진도 비율 유지", () => {
    expect(scaleToMaxSide(1080, 2400, 1200)).toEqual({ width: 540, height: 1200 });
  });
});
