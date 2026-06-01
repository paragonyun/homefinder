import { describe, expect, it } from "vitest";
import { formatCommuteRefreshMessage } from "./commute-refresh-result";

describe("formatCommuteRefreshMessage", () => {
  it("includes per-destination transit failure details", () => {
    expect(
      formatCommuteRefreshMessage({
        savedCount: 2,
        errors: [
          {
            destinationKey: "yeouido_station",
            transportType: "transit",
            error: "TMAP 대중교통 API error 14: 검색 결과가 없음",
          },
          {
            destinationKey: "gangnam_station",
            transportType: "transit",
            error: "TMAP 대중교통 API request failed with 403: Forbidden",
          },
        ],
        expiresAt: "2026-06-02T11:00:00.000Z",
      }),
    ).toContain(
      "일부 실패 2건: 여의도역 대중교통 - 경로 검색 결과 없음 / 강남역 대중교통 - API 키 권한 확인 필요",
    );
  });
});
