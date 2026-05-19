import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMolitApartmentTradeUrl,
  fetchMolitApartmentTradeXml,
  getRecentDealYmds,
  parseMolitApartmentTradeXml,
  resolveMolitDealYmds,
} from "./molit-transactions";

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("getRecentDealYmds", () => {
  it("returns recent contract months in descending order", () => {
    expect(
      getRecentDealYmds({
        from: new Date("2026-05-19T00:00:00Z"),
        months: 4,
      }),
    ).toEqual(["202605", "202604", "202603", "202602"]);
  });

  it("handles year boundaries", () => {
    expect(
      getRecentDealYmds({
        from: new Date("2026-01-15T00:00:00Z"),
        months: 3,
      }),
    ).toEqual(["202601", "202512", "202511"]);
  });
});

describe("resolveMolitDealYmds", () => {
  it("uses a manual contract month when one is provided", () => {
    expect(
      resolveMolitDealYmds({
        dealYmd: " 202501 ",
        now: new Date("2026-05-19T00:00:00Z"),
      }),
    ).toEqual({
      ok: true,
      mode: "manual",
      dealYmds: ["202501"],
    });
  });

  it("defaults to recent months when no manual month is provided", () => {
    expect(
      resolveMolitDealYmds({
        now: new Date("2026-05-19T00:00:00Z"),
        months: 2,
      }),
    ).toEqual({
      ok: true,
      mode: "recent",
      dealYmds: ["202605", "202604"],
    });
  });

  it("rejects invalid manual contract months", () => {
    expect(resolveMolitDealYmds({ dealYmd: "2025-01" })).toEqual({
      ok: false,
      error: "계약년월은 YYYYMM 형식으로 입력하세요.",
    });
  });
});

describe("buildMolitApartmentTradeUrl", () => {
  it("encodes a decoded service key exactly once", () => {
    const url = buildMolitApartmentTradeUrl({
      serviceKey: "abc+/=",
      lawdCd: "11560",
      dealYmd: "202501",
      pageNo: 1,
      numOfRows: 1000,
    });

    expect(url).toContain("serviceKey=abc%2B%2F%3D");
    expect(url).toContain("LAWD_CD=11560");
    expect(url).toContain("DEAL_YMD=202501");
  });

  it("does not double encode an already encoded service key", () => {
    const url = buildMolitApartmentTradeUrl({
      serviceKey: "abc%2B%2F%3D",
      lawdCd: "11560",
      dealYmd: "202501",
      pageNo: 1,
      numOfRows: 1000,
    });

    expect(url).toContain("serviceKey=abc%2B%2F%3D");
    expect(url).not.toContain("%252B");
  });
});

describe("fetchMolitApartmentTradeXml", () => {
  it("surfaces MOLIT error bodies from non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>20</returnReasonCode><returnAuthMsg>SERVICE_ACCESS_DENIED_ERROR.</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>",
        { status: 403 },
      ),
    );

    await expect(
      fetchMolitApartmentTradeXml({
        serviceKey: "abc",
        lawdCd: "11560",
        dealYmd: "202501",
        pageNo: 1,
        numOfRows: 1000,
      }),
    ).rejects.toThrow("MOLIT API error 20: SERVICE_ACCESS_DENIED_ERROR.");
  });

  it("includes a short body preview when non-2xx response is not a MOLIT XML error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized service key", { status: 401 }),
    );

    await expect(
      fetchMolitApartmentTradeXml({
        serviceKey: "abc",
        lawdCd: "11560",
        dealYmd: "202501",
        pageNo: 1,
        numOfRows: 1000,
      }),
    ).rejects.toThrow(
      "MOLIT API request failed with 401: Unauthorized service key",
    );
  });
});
