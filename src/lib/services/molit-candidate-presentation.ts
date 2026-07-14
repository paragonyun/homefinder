import type { MolitMatchReason } from "./molit-transaction-matching";

export function formatMolitCandidateReasons(candidate: {
  matchReasons: MolitMatchReason[];
  nameSimilarity: number;
}): string[] {
  return candidate.matchReasons.map((reason) => {
    if (reason === "lot_exact") {
      return "지번 일치";
    }

    if (reason === "road_exact") {
      return "도로명 일치";
    }

    if (reason === "name_exact") {
      return "이름 일치";
    }

    return `이름 유사 ${Math.round(candidate.nameSimilarity * 100)}%`;
  });
}
