import { describe, expect, it } from "vitest";
import { formatCommuteRefreshMessage } from "./commute-refresh-result";

describe("formatCommuteRefreshMessage", () => {
  it("reports fresh cache reuse without claiming a new TMAP lookup", () => {
    const message = formatCommuteRefreshMessage({
      cached: true,
      reusedCount: 4,
      expiresAt: "2026-06-24T00:00:00.000Z",
    });

    expect(message).toContain("저장된 접근성 4건을 재사용했습니다.");
    expect(message).not.toContain("TMAP 기준으로 조회");
  });

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
