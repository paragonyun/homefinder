import { describe, expect, it } from "vitest";
import {
  validateApartmentInput,
  validateFieldNoteInput,
  validateNeighborhoodInput,
} from "./home-data";

describe("validateNeighborhoodInput", () => {
  it("requires a neighborhood name", () => {
    expect(validateNeighborhoodInput({ name: "   " })).toEqual({
      ok: false,
      error: "동네명을 입력하세요.",
    });
  });

  it("trims optional text fields", () => {
    expect(
      validateNeighborhoodInput({
        name: " 신길동 ",
        description: " 여의도 접근성 확인 ",
        district: " 영등포구 ",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "신길동",
        description: "여의도 접근성 확인",
        city: null,
        district: "영등포구",
        dong: null,
      },
    });
  });
});

describe("validateApartmentInput", () => {
  it("requires an apartment name", () => {
    expect(validateApartmentInput({ name: "", status: "candidate" })).toEqual({
      ok: false,
      error: "단지명을 입력하세요.",
    });
  });

  it("rejects an unknown apartment status", () => {
    expect(
      validateApartmentInput({ name: "사당자이", status: "sold" }),
    ).toEqual({
      ok: false,
      error: "알 수 없는 단지 상태입니다.",
    });
  });
});

describe("validateFieldNoteInput", () => {
  it("requires a valid rating range when rating is present", () => {
    expect(
      validateFieldNoteInput({
        apartmentId: "apt-1",
        visitDate: "2026-05-18",
        overallRating: "6",
      }),
    ).toEqual({
      ok: false,
      error: "평점은 1에서 5 사이로 입력하세요.",
    });
  });

  it("keeps an empty optional visit date as null", () => {
    expect(
      validateFieldNoteInput({
        apartmentId: "apt-1",
        visitDate: "",
        overallMemo: " 다시 볼 의향 있음 ",
      }),
    ).toEqual({
      ok: true,
      value: {
        apartment_id: "apt-1",
        visit_date: null,
        visit_time: null,
        weather: null,
        overall_rating: null,
        good_points: null,
        bad_points: null,
        overall_memo: "다시 볼 의향 있음",
      },
    });
  });
});
