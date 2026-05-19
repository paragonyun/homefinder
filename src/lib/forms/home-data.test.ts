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

  it("keeps manual matching fields separate from price data", () => {
    expect(
      validateApartmentInput({
        name: " 래미안에스티움 ",
        status: "candidate",
        lawdCd: " 11560 ",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "래미안에스티움",
        neighborhood_id: null,
        address: null,
        road_address: null,
        lawd_cd: "11560",
        status: "candidate",
        memo: null,
        kb_url: null,
        naver_land_url: null,
      },
    });
  });

  it("requires lawd_cd to be five or ten digits when present", () => {
    expect(
      validateApartmentInput({
        name: "래미안에스티움",
        status: "candidate",
        lawdCd: "115601",
      }),
    ).toEqual({
      ok: false,
      error: "법정동코드는 5자리 또는 10자리 숫자로 입력하세요.",
    });
  });

  it("accepts and stores a ten digit legal dong code", () => {
    expect(
      validateApartmentInput({
        name: "래미안에스티움",
        status: "candidate",
        lawdCd: "1156013200",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        lawd_cd: "1156013200",
      },
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
