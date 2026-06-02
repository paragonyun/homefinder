import { describe, expect, it } from "vitest";
import {
  formatBuildingDensityRatio,
  normalizeBuildingDensityRatio,
} from "./building-density";

describe("building-density", () => {
  it("keeps positive density ratios", () => {
    expect(normalizeBuildingDensityRatio(249.35)).toBe(249.35);
    expect(formatBuildingDensityRatio(249.35)).toBe("249.4%");
  });

  it("treats zero, negative, and missing density ratios as unavailable", () => {
    expect(normalizeBuildingDensityRatio(0)).toBeNull();
    expect(normalizeBuildingDensityRatio(-1)).toBeNull();
    expect(normalizeBuildingDensityRatio(null)).toBeNull();
    expect(normalizeBuildingDensityRatio(undefined)).toBeNull();
    expect(formatBuildingDensityRatio(0)).toBe("-");
  });
});
