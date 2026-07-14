import { describe, expect, it } from "vitest";
import { formatMolitCandidateReasons } from "./molit-candidate-presentation";

describe("formatMolitCandidateReasons", () => {
  it("formats exact and fuzzy matching evidence for an operator", () => {
    expect(
      formatMolitCandidateReasons({
        matchReasons: ["lot_exact", "name_similar"],
        nameSimilarity: 0.86,
      }),
    ).toEqual(["지번 일치", "이름 유사 86%"]);

    expect(
      formatMolitCandidateReasons({
        matchReasons: ["road_exact", "name_exact"],
        nameSimilarity: 1,
      }),
    ).toEqual(["도로명 일치", "이름 일치"]);
  });
});
