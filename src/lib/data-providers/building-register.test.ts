import { describe, expect, it } from "vitest";
import {
  buildBuildingRegisterUrl,
  parseBuildingRegisterResponse,
} from "./building-register";

describe("parseBuildingRegisterResponse", () => {
  it("normalizes building register title rows into density fields", () => {
    const result = parseBuildingRegisterResponse({
      response: {
        header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
        body: {
          items: {
            item: {
              platPlc: "서울특별시 관악구 봉천동 1712",
              newPlatPlc: "서울특별시 관악구 성현로 80",
              bldNm: "관악드림타운",
              platArea: "69432.00",
              archArea: "20105.66",
              totArea: "169706.83",
              vlRat: "163.58",
              bcRat: "28.96",
              mainPurpsCdNm: "공동주택",
              grndFlrCnt: "25",
              ugrndFlrCnt: "3",
              strctCdNm: "철근콘크리트구조",
            },
          },
          totalCount: "1",
        },
      },
    });

    expect(result).toEqual({
      totalCount: 1,
      items: [
        {
          buildingName: "관악드림타운",
          legalAddress: "서울특별시 관악구 봉천동 1712",
          roadAddress: "서울특별시 관악구 성현로 80",
          landAreaM2: 69432,
          buildingAreaM2: 20105.66,
          grossFloorAreaM2: 169706.83,
          floorAreaRatio: 163.58,
          buildingCoverageRatio: 28.96,
          mainUse: "공동주택",
          highestFloor: 25,
          lowestFloor: 3,
          structureType: "철근콘크리트구조",
        },
      ],
    });
  });

  it("parses XML responses and ignores empty item containers", () => {
    const result = parseBuildingRegisterResponse(`
      <response>
        <header>
          <resultCode>00</resultCode>
          <resultMsg>NORMAL SERVICE.</resultMsg>
        </header>
        <body>
          <items>
            <item>
              <platPlc>서울특별시 강서구 염창동 268</platPlc>
              <newPlatPlc>서울특별시 강서구 양천로 731</newPlatPlc>
              <bldNm>염창동아3차아파트</bldNm>
              <vlRat>249.4</vlRat>
              <bcRat>18.4</bcRat>
            </item>
          </items>
          <totalCount>1</totalCount>
        </body>
      </response>
    `);

    expect(result.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      buildingName: "염창동아3차아파트",
      floorAreaRatio: 249.4,
      buildingCoverageRatio: 18.4,
    });
  });

  it("surfaces public data portal API errors", () => {
    expect(() =>
      parseBuildingRegisterResponse({
        OpenAPI_ServiceResponse: {
          cmmMsgHeader: {
            returnReasonCode: "30",
            returnAuthMsg: "SERVICE KEY IS NOT REGISTERED ERROR.",
          },
        },
      }),
    ).toThrow("Building register API error 30");
  });
});

describe("buildBuildingRegisterUrl", () => {
  it("builds a title endpoint URL with encoded service key and lot parameters", () => {
    const url = buildBuildingRegisterUrl({
      endpoint: "http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo",
      serviceKey: "abc+/=",
      sigunguCd: "11620",
      bjdongCd: "10100",
      platGbCd: "0",
      bun: "1712",
      ji: "0000",
      pageNo: 1,
      numOfRows: 100,
    });

    expect(url).toContain("serviceKey=abc%2B%2F%3D");
    expect(url).toContain("sigunguCd=11620");
    expect(url).toContain("bjdongCd=10100");
    expect(url).toContain("platGbCd=0");
    expect(url).toContain("bun=1712");
    expect(url).toContain("ji=0000");
    expect(url).toContain("_type=json");
  });
});
