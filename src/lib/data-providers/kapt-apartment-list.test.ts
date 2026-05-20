import { describe, expect, it } from "vitest";
import {
  buildKaptApartmentListUrl,
  parseKaptApartmentListResponse,
} from "./kapt-apartment-list";

describe("parseKaptApartmentListResponse", () => {
  it("parses apartment list items from XML responses", () => {
    const result = parseKaptApartmentListResponse(`
      <response>
        <header>
          <resultCode>00</resultCode>
          <resultMsg>NORMAL SERVICE.</resultMsg>
        </header>
        <body>
          <items>
            <item>
              <kaptCode>A11500101</kaptCode>
              <kaptName>동아3차</kaptName>
              <bjdCode>1150010100</bjdCode>
              <as1>서울특별시</as1>
              <as2>강서구</as2>
              <as3>염창동</as3>
            </item>
          </items>
          <totalCount>1</totalCount>
        </body>
      </response>
    `);

    expect(result).toEqual({
      totalCount: 1,
      items: [
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
  });

  it("parses apartment list items from JSON responses", () => {
    const result = parseKaptApartmentListResponse({
      response: {
        header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
        body: {
          items: {
            item: {
              kaptCode: "A10027868",
              kaptName: "대구테크노폴리스 남해오네뜨1차 아파트",
              bjdCode: "2771026522",
              as1: "대구광역시",
              as2: "달성군",
              as3: "현풍읍",
              as4: "중리",
            },
          },
          totalCount: 1,
        },
      },
    });

    expect(result.items[0]).toMatchObject({
      kaptCode: "A10027868",
      kaptName: "대구테크노폴리스 남해오네뜨1차 아파트",
      bjdCode: "2771026522",
      ri: "중리",
    });
  });

  it("surfaces OpenAPI error responses", () => {
    expect(() =>
      parseKaptApartmentListResponse(`
        <OpenAPI_ServiceResponse>
          <cmmMsgHeader>
            <returnReasonCode>30</returnReasonCode>
            <returnAuthMsg>SERVICE KEY IS NOT REGISTERED ERROR.</returnAuthMsg>
          </cmmMsgHeader>
        </OpenAPI_ServiceResponse>
      `),
    ).toThrow("K-apt apartment list API error 30");
  });

  it("builds a city/province list URL with sidoCode", () => {
    const url = buildKaptApartmentListUrl({
      serviceKey: "decoded/key",
      sidoCode: "11",
      pageNo: 2,
      numOfRows: 1000,
    });

    expect(url).toContain(
      "http://apis.data.go.kr/1613000/AptListService3/getSidoAptList3",
    );
    expect(url).toContain("serviceKey=decoded%2Fkey");
    expect(url).toContain("sidoCode=11");
    expect(url).toContain("pageNo=2");
    expect(url).toContain("numOfRows=1000");
  });
});
