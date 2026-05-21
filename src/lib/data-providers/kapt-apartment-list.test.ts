import { describe, expect, it } from "vitest";
import {
  buildKaptApartmentListUrl,
  buildKaptLegalDongApartmentListUrl,
  buildKaptSigunguApartmentListUrl,
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
              <kaptName>Dong-A 3</kaptName>
              <bjdCode>1150010100</bjdCode>
              <as1>Seoul</as1>
              <as2>Gangseo-gu</as2>
              <as3>Yeomchang-dong</as3>
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
          kaptName: "Dong-A 3",
          bjdCode: "1150010100",
          sido: "Seoul",
          sigungu: "Gangseo-gu",
          eupmyeondong: "Yeomchang-dong",
          ri: null,
          legalAddress: null,
          roadAddress: null,
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
              kaptName: "Techno Apartment",
              bjdCode: "2771026522",
              as1: "Daegu",
              as2: "Dalseong-gun",
              as3: "Yuga-eup",
              as4: "Jung-ri",
            },
          },
          totalCount: 1,
        },
      },
    });

    expect(result.items[0]).toMatchObject({
      kaptCode: "A10027868",
      kaptName: "Techno Apartment",
      bjdCode: "2771026522",
      ri: "Jung-ri",
    });
  });

  it("parses legacy list records with legal and road addresses", () => {
    const result = parseKaptApartmentListResponse(`
      <response>
        <header>
          <resultCode>00</resultCode>
          <resultMsg>NORMAL SERVICE.</resultMsg>
        </header>
        <body>
          <item>
            <kaptCode>A11560132</kaptCode>
            <kaptName>Boramae Honorsville</kaptName>
            <bjdCode>1156013200</bjdCode>
            <kaptAddr>Seoul Yeongdeungpo-gu Singil-dong Boramae Honorsville</kaptAddr>
            <doroJuso>Seoul Yeouidaebang-ro 25</doroJuso>
          </item>
        </body>
      </response>
    `);

    expect(result.items[0]).toMatchObject({
      kaptCode: "A11560132",
      kaptName: "Boramae Honorsville",
      legalAddress: "Seoul Yeongdeungpo-gu Singil-dong Boramae Honorsville",
      roadAddress: "Seoul Yeouidaebang-ro 25",
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

  it("builds a legal-dong list URL with bjdCode", () => {
    const url = buildKaptLegalDongApartmentListUrl({
      serviceKey: "decoded/key",
      bjdCode: "1156013200",
      pageNo: 1,
      numOfRows: 100,
    });

    expect(url).toContain(
      "http://apis.data.go.kr/1613000/AptListService3/getLegaldongAptList3",
    );
    expect(url).toContain("serviceKey=decoded%2Fkey");
    expect(url).toContain("bjdCode=1156013200");
    expect(url).toContain("pageNo=1");
    expect(url).toContain("numOfRows=100");
  });

  it("builds a sigungu list URL with sigunguCode", () => {
    const url = buildKaptSigunguApartmentListUrl({
      serviceKey: "decoded/key",
      sigunguCode: "11560",
      pageNo: 3,
      numOfRows: 500,
    });

    expect(url).toContain(
      "http://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3",
    );
    expect(url).toContain("serviceKey=decoded%2Fkey");
    expect(url).toContain("sigunguCode=11560");
    expect(url).toContain("pageNo=3");
    expect(url).toContain("numOfRows=500");
  });
});
