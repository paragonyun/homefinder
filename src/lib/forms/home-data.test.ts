import { describe, expect, it } from "vitest";
import {
  validateCommuteTimeInput,
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
        kaptCode: " A15876402 ",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "래미안에스티움",
        neighborhood_id: null,
        address: null,
        road_address: null,
        lawd_cd: "11560",
        kapt_code: "A15876402",
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
        station_walk_rating: null,
        slope_rating: null,
        complex_condition_rating: null,
        parking_rating: null,
        noise_rating: null,
        night_mood_rating: null,
        commercial_area_rating: null,
        overall_rating: null,
        good_points: null,
        bad_points: null,
        parking_note: null,
        noise_note: null,
        slope_note: null,
        overall_memo: "다시 볼 의향 있음",
        revisit_intention: null,
      },
    });
  });

  it("builds a field note payload with checklist ratings and revisit intention", () => {
    expect(
      validateFieldNoteInput({
        apartmentId: "apt-1",
        visitDate: "2026-06-02",
        visitTime: " 평일 저녁 ",
        weather: " 맑음 ",
        overallRating: "4",
        stationWalkRating: "5",
        slopeRating: "2",
        complexConditionRating: "4",
        parkingRating: "3",
        noiseRating: "2",
        nightMoodRating: "4",
        commercialAreaRating: "5",
        goodPoints: " 역 접근이 좋음 ",
        badPoints: " 언덕 체감 있음 ",
        parkingNote: " 지상 주차 여유 확인 필요 ",
        noiseNote: " 대로변 소음 재확인 ",
        slopeNote: " 정문까지 경사 있음 ",
        overallMemo: " 다음에는 야간 분위기 확인 ",
        revisitIntention: " 보류 ",
      }),
    ).toEqual({
      ok: true,
      value: {
        apartment_id: "apt-1",
        visit_date: "2026-06-02",
        visit_time: "평일 저녁",
        weather: "맑음",
        station_walk_rating: 5,
        slope_rating: 2,
        complex_condition_rating: 4,
        parking_rating: 3,
        noise_rating: 2,
        night_mood_rating: 4,
        commercial_area_rating: 5,
        overall_rating: 4,
        good_points: "역 접근이 좋음",
        bad_points: "언덕 체감 있음",
        parking_note: "지상 주차 여유 확인 필요",
        noise_note: "대로변 소음 재확인",
        slope_note: "정문까지 경사 있음",
        overall_memo: "다음에는 야간 분위기 확인",
        revisit_intention: "보류",
      },
    });
  });

  it("rejects invalid field note checklist ratings", () => {
    expect(
      validateFieldNoteInput({
        apartmentId: "apt-1",
        parkingRating: "6",
      }),
    ).toEqual({
      ok: false,
      error: "주차 체감은 1에서 5 사이의 정수로 입력하세요.",
    });
  });
});

describe("validateCommuteTimeInput", () => {
  it("builds a manual Yeouido commute payload", () => {
    expect(
      validateCommuteTimeInput({
        apartmentId: "apt-1",
        destinationKey: "yeouido_station",
        durationMinutes: " 32 ",
        transferCount: "1",
      }),
    ).toEqual({
      ok: true,
      value: {
        apartment_id: "apt-1",
        destination_key: "yeouido_station",
        destination_name: "여의도역",
        destination_lat: 37.521624,
        destination_lng: 126.924191,
        transport_type: "transit",
        duration_minutes: 32,
        transfer_count: 1,
        source_name: "manual",
        source_ref: null,
        query_datetime: null,
        confidence_level: "manual",
      },
    });
  });

  it("treats an empty duration as no commute value to save", () => {
    expect(
      validateCommuteTimeInput({
        apartmentId: "apt-1",
        destinationKey: "gangnam_station",
        durationMinutes: "",
        transferCount: "",
      }),
    ).toEqual({
      ok: true,
      value: null,
    });
  });

  it("rejects invalid duration and transfer ranges", () => {
    expect(
      validateCommuteTimeInput({
        apartmentId: "apt-1",
        destinationKey: "gangnam_station",
        durationMinutes: "301",
      }),
    ).toEqual({
      ok: false,
      error: "소요시간은 1에서 300 사이의 정수로 입력하세요.",
    });

    expect(
      validateCommuteTimeInput({
        apartmentId: "apt-1",
        destinationKey: "gangnam_station",
        durationMinutes: "",
        transferCount: "1",
      }),
    ).toEqual({
      ok: false,
      error: "환승 수를 저장하려면 소요시간을 입력하세요.",
    });

    expect(
      validateCommuteTimeInput({
        apartmentId: "apt-1",
        destinationKey: "gangnam_station",
        durationMinutes: "45",
        transferCount: "11",
      }),
    ).toEqual({
      ok: false,
      error: "환승 수는 0에서 10 사이의 정수로 입력하세요.",
    });
  });
});
