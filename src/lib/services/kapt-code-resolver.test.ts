import { describe, expect, it } from "vitest";
import { resolveKaptCodeCandidate } from "./kapt-code-resolver";

describe("resolveKaptCodeCandidate", () => {
  it("auto-selects a unique K-apt candidate using MOLIT source names", () => {
    const result = resolveKaptCodeCandidate({
      apartment: {
        name: "염창동 동아 3차 아파트",
        display_name: null,
        address: "서울 강서구 염창동 292",
        road_address: null,
        lawd_cd: "1150010100",
      },
      aliases: [],
      transactions: [
        {
          apartment_name_from_source: "동아3차",
          address_from_source: "염창동 292",
        },
      ],
      candidates: [
        {
          kaptCode: "A11500101",
          kaptName: "동아3차",
          bjdCode: "1150010100",
          sido: "서울특별시",
          sigungu: "강서구",
          eupmyeondong: "염창동",
          ri: null,
        },
      ],
    });

    expect(result.status).toBe("auto");
    expect(result.selected?.kaptCode).toBe("A11500101");
  });

  it("returns candidates instead of auto-selecting when same-dong names are ambiguous", () => {
    const result = resolveKaptCodeCandidate({
      apartment: {
        name: "관악드림타운",
        display_name: null,
        address: "서울 관악구 봉천동",
        road_address: null,
        lawd_cd: "1162010100",
      },
      aliases: [],
      transactions: [],
      candidates: [
        {
          kaptCode: "A11620101",
          kaptName: "관악드림타운동아",
          bjdCode: "1162010100",
          sido: "서울특별시",
          sigungu: "관악구",
          eupmyeondong: "봉천동",
          ri: null,
        },
        {
          kaptCode: "A11620102",
          kaptName: "관악드림타운삼성",
          bjdCode: "1162010100",
          sido: "서울특별시",
          sigungu: "관악구",
          eupmyeondong: "봉천동",
          ri: null,
        },
      ],
    });

    expect(result.status).toBe("needs_selection");
    expect(result.candidates.map((candidate) => candidate.kaptCode)).toEqual([
      "A11620101",
      "A11620102",
    ]);
  });

  it("filters by five-digit lawd prefix but keeps weak matches for manual selection", () => {
    const result = resolveKaptCodeCandidate({
      apartment: {
        name: "우성",
        display_name: null,
        address: "서울 영등포구 신길동",
        road_address: null,
        lawd_cd: "11560",
      },
      aliases: [],
      transactions: [],
      candidates: [
        {
          kaptCode: "A11560101",
          kaptName: "신길우성2차",
          bjdCode: "1156013200",
          sido: "서울특별시",
          sigungu: "영등포구",
          eupmyeondong: "신길동",
          ri: null,
        },
        {
          kaptCode: "A11680101",
          kaptName: "대치우성",
          bjdCode: "1168010600",
          sido: "서울특별시",
          sigungu: "강남구",
          eupmyeondong: "대치동",
          ri: null,
        },
      ],
    });

    expect(result.status).toBe("needs_selection");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].kaptCode).toBe("A11560101");
  });

  it("keeps name-matched candidates for manual selection when lawd filtering has no matches", () => {
    const result = resolveKaptCodeCandidate({
      apartment: {
        name: "Boramae Honorsville",
        display_name: null,
        address: "Seoul Yeongdeungpo-gu",
        road_address: null,
        lawd_cd: "1156013200",
      },
      aliases: [],
      transactions: [
        {
          apartment_name_from_source: "Boramae Honorsville",
          address_from_source: null,
        },
      ],
      candidates: [
        {
          kaptCode: "A11560132",
          kaptName: "Boramae Honorsville",
          bjdCode: null,
          sido: "Seoul",
          sigungu: "Yeongdeungpo-gu",
          eupmyeondong: null,
          ri: null,
        },
      ],
    });

    expect(result.status).toBe("needs_selection");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].kaptCode).toBe("A11560132");
  });

  it("uses road-address evidence when K-apt directory rows include road addresses", () => {
    const result = resolveKaptCodeCandidate({
      apartment: {
        name: "Dong-A 3",
        display_name: null,
        address: "Seoul Yangcheon-ro 731",
        road_address: null,
        lawd_cd: "11500",
      },
      aliases: [],
      transactions: [],
      candidates: [
        {
          kaptCode: "A11500101",
          kaptName: "Dong-A 3",
          bjdCode: null,
          sido: "Seoul",
          sigungu: "Gangseo-gu",
          eupmyeondong: "Yeomchang-dong",
          ri: null,
          legalAddress: "Seoul Gangseo-gu Yeomchang-dong Dong-A 3",
          roadAddress: "Seoul Yangcheon-ro 731",
        },
      ],
    });

    expect(result.status).toBe("needs_selection");
    expect(result.candidates[0].kaptCode).toBe("A11500101");
    expect(result.candidates[0].reasons).toContain("주소 단서 일치");
  });
});
