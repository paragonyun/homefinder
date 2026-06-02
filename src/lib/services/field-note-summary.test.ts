import { describe, expect, it } from "vitest";
import {
  buildLatestFieldNoteSummary,
  getLatestFieldNoteByApartmentId,
} from "./field-note-summary";

describe("field note summary helpers", () => {
  it("chooses the latest visited note for each apartment", () => {
    const latestByApartmentId = getLatestFieldNoteByApartmentId([
      {
        id: "old",
        apartment_id: "apt-1",
        visit_date: "2026-05-20",
        overall_rating: 3,
        revisit_intention: "보류",
        overall_memo: "저녁 소음 재확인",
        bad_points: null,
        parking_note: null,
        noise_note: null,
        slope_note: null,
        created_at: "2026-05-20T10:00:00Z",
        updated_at: "2026-05-20T10:00:00Z",
      },
      {
        id: "latest",
        apartment_id: "apt-1",
        visit_date: "2026-06-02",
        overall_rating: 4,
        revisit_intention: "관심 유지",
        overall_memo: "비 오는 날 언덕 체감만 다시 확인",
        bad_points: null,
        parking_note: null,
        noise_note: null,
        slope_note: null,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T10:00:00Z",
      },
      {
        id: "other",
        apartment_id: "apt-2",
        visit_date: null,
        overall_rating: 2,
        revisit_intention: "제외",
        overall_memo: null,
        bad_points: "주차와 소음 모두 재확인 필요",
        parking_note: null,
        noise_note: null,
        slope_note: null,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
      },
    ]);

    expect(latestByApartmentId.get("apt-1")?.id).toBe("latest");
    expect(latestByApartmentId.get("apt-2")?.id).toBe("other");
  });

  it("builds a compact summary for top-level cards and comparison rows", () => {
    expect(
      buildLatestFieldNoteSummary({
        apartment_id: "apt-1",
        visit_date: "2026-06-02",
        overall_rating: 4,
        revisit_intention: "관심 유지",
        overall_memo: "밤 시간대 상가 소음 재확인",
        bad_points: "언덕 체감 있음",
        parking_note: null,
        noise_note: null,
        slope_note: null,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T11:00:00Z",
      }),
    ).toEqual({
      apartmentId: "apt-1",
      conclusion: "관심 유지",
      overallRating: 4,
      recheckText: "밤 시간대 상가 소음 재확인",
      updatedAt: "2026-06-02T11:00:00Z",
      visitDate: "2026-06-02",
    });
  });
});
