import { describe, expect, it } from "vitest";
import { parseMolitApartmentTradeXml } from "./molit-transactions";

describe("parseMolitApartmentTradeXml", () => {
  it("normalizes apartment trade XML into typed transaction rows", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <response>
        <body>
          <items>
            <item>
              <거래금액>84,500</거래금액>
              <년>2024</년>
              <월>7</월>
              <일>3</일>
              <전용면적>84.93</전용면적>
              <층>12</층>
              <아파트>래미안에스티움</아파트>
              <법정동>신길동</법정동>
              <지번>2039</지번>
              <해제여부></해제여부>
              <해제사유발생일></해제사유발생일>
            </item>
          </items>
          <totalCount>1</totalCount>
        </body>
      </response>`;

    expect(parseMolitApartmentTradeXml(xml)).toEqual({
      totalCount: 1,
      transactions: [
        {
          dealYear: 2024,
          dealMonth: 7,
          dealDay: 3,
          dealDate: "2024-07-03",
          exclusiveAreaM2: 84.93,
          floor: 12,
          dealAmountManwon: 84500,
          dealAmountKrw: 845000000,
          apartmentNameFromSource: "래미안에스티움",
          addressFromSource: "신길동 2039",
          cancelYn: null,
          cancelDate: null,
        },
      ],
    });
  });

  it("handles cancelled rows and empty item lists", () => {
    const cancelled = `<?xml version="1.0" encoding="UTF-8"?>
      <response>
        <body>
          <items>
            <item>
              <dealAmount>100,000</dealAmount>
              <dealYear>2024</dealYear>
              <dealMonth>12</dealMonth>
              <dealDay>9</dealDay>
              <excluUseAr>59.97</excluUseAr>
              <floor>8</floor>
              <aptNm>테스트아파트</aptNm>
              <umdNm>테스트동</umdNm>
              <jibun>1</jibun>
              <cdealType>O</cdealType>
              <cdealDay>20250103</cdealDay>
            </item>
          </items>
        </body>
      </response>`;

    expect(parseMolitApartmentTradeXml(cancelled).transactions[0]).toMatchObject({
      cancelYn: "O",
      cancelDate: "2025-01-03",
    });

    expect(parseMolitApartmentTradeXml("<response><body><items /></body></response>"))
      .toEqual({ totalCount: 0, transactions: [] });
  });

  it("throws on MOLIT error responses", () => {
    expect(() =>
      parseMolitApartmentTradeXml(
        "<response><header><resultCode>99</resultCode><resultMsg>INVALID_KEY</resultMsg></header></response>",
      ),
    ).toThrow("MOLIT API error 99: INVALID_KEY");

    expect(() =>
      parseMolitApartmentTradeXml(
        "<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode><returnAuthMsg>SERVICE KEY IS NOT REGISTERED ERROR.</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>",
      ),
    ).toThrow("MOLIT API error 30: SERVICE KEY IS NOT REGISTERED ERROR.");
  });
});
