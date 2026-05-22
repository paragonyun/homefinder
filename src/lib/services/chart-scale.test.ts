import { describe, expect, it } from "vitest";
import { buildLinearTicks, getVisibleMonthLabels } from "./chart-scale";

describe("buildLinearTicks", () => {
  it("returns unique readable ticks for a normal price range", () => {
    const ticks = buildLinearTicks(1_140_000_000, 1_380_000_000, 5);

    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(Math.min(...ticks)).toBeLessThanOrEqual(1_140_000_000);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(1_380_000_000);
  });

  it("expands a single price into a non-duplicate renderable axis", () => {
    const ticks = buildLinearTicks(1_250_000_000, 1_250_000_000, 5);

    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks).toContain(1_250_000_000);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });
});

describe("getVisibleMonthLabels", () => {
  it("keeps first and last month while reducing dense labels", () => {
    expect(
      getVisibleMonthLabels(
        [
          "2025-01",
          "2025-02",
          "2025-03",
          "2025-04",
          "2025-05",
          "2025-06",
          "2025-07",
          "2025-08",
        ],
        4,
      ),
    ).toEqual(["2025-01", "2025-04", "2025-07", "2025-08"]);
  });
});
