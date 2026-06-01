import { describe, expect, it } from "vitest";
import {
  buildNeisSchoolInfoUrl,
  parseNeisSchoolInfoResponse,
} from "./neis-schools";

describe("parseNeisSchoolInfoResponse", () => {
  it("normalizes NEIS schoolInfo rows", () => {
    const result = parseNeisSchoolInfoResponse({
      schoolInfo: [
        { head: [{ list_total_count: 1 }, { RESULT: { CODE: "INFO-000" } }] },
        {
          row: [
            {
              ATPT_OFCDC_SC_CODE: "B10",
              ATPT_OFCDC_SC_NM: "서울특별시교육청",
              SD_SCHUL_CODE: "7010057",
              SCHUL_NM: "서울봉천초등학교",
              SCHUL_KND_SC_NM: "초등학교",
              LCTN_SC_NM: "서울특별시",
              JU_ORG_NM: "서울특별시동작관악교육지원청",
              ORG_RDNMA: "서울특별시 관악구 행운1라길 17",
              ORG_RDNDA: "(봉천동)",
              HMPG_ADRES: "https://example.sen.es.kr",
              ORG_TELNO: "02-000-0000",
              COEDU_SC_NM: "남여공학",
              FOND_YMD: "19671110",
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      totalCount: 1,
      schools: [
        {
          officeCode: "B10",
          officeName: "서울특별시교육청",
          schoolCode: "7010057",
          schoolName: "서울봉천초등학교",
          schoolType: "elementary",
          schoolKindName: "초등학교",
          regionName: "서울특별시",
          districtOfficeName: "서울특별시동작관악교육지원청",
          roadAddress: "서울특별시 관악구 행운1라길 17 (봉천동)",
          address: null,
          homepageUrl: "https://example.sen.es.kr",
          phone: "02-000-0000",
          coeducationType: "남여공학",
          foundedDate: "1967-11-10",
        },
      ],
    });
  });

  it("returns an empty list for NEIS empty-result responses", () => {
    expect(
      parseNeisSchoolInfoResponse({
        RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." },
      }),
    ).toEqual({ totalCount: 0, schools: [] });
  });

  it("throws explicit NEIS API errors", () => {
    expect(() =>
      parseNeisSchoolInfoResponse({
        RESULT: { CODE: "ERROR-300", MESSAGE: "인증키가 유효하지 않습니다." },
      }),
    ).toThrow("NEIS schoolInfo API error ERROR-300");
  });
});

describe("buildNeisSchoolInfoUrl", () => {
  it("builds a schoolInfo URL with filters", () => {
    const url = buildNeisSchoolInfoUrl({
      apiKey: "abc+/=",
      pageIndex: 2,
      pageSize: 100,
      regionName: "서울특별시",
      schoolKindName: "초등학교",
    });

    expect(url).toContain("https://open.neis.go.kr/hub/schoolInfo");
    expect(url).toContain("KEY=abc%2B%2F%3D");
    expect(url).toContain("Type=json");
    expect(url).toContain("pIndex=2");
    expect(url).toContain("pSize=100");
    expect(url).toContain("LCTN_SC_NM=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C");
    expect(url).toContain("SCHUL_KND_SC_NM=%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90");
  });
});
