import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildKaptBasicInfoUrl,
  fetchKaptBasicInfoJson,
  parseKaptBasicInfoResponse,
} from "./kapt-basic-info";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseKaptBasicInfoResponse", () => {
  it("normalizes K-apt basic info rows into apartment basic info fields", () => {
    const response = {
      response: {
        header: {
          resultCode: "00",
          resultMsg: "NORMAL SERVICE.",
        },
        body: {
          item: {
            kaptCode: "A10027875",
            kaptName: "괴정 경성스마트W아파트",
            kaptAddr: "부산광역시 사하구 괴정동 258",
            doroJuso: "부산광역시 사하구 낙동대로 180",
            kaptdaCnt: "182",
            hoCnt: "182",
            kaptDongCnt: "3",
            kaptUsedate: "20150806",
            codeHeatNm: "개별난방",
            codeMgrNm: "자치관리",
            codeSaleNm: "분양",
            kaptTarea: "19324.6751",
          },
        },
      },
    };

    expect(parseKaptBasicInfoResponse(response)).toEqual({
      kaptCode: "A10027875",
      kaptName: "괴정 경성스마트W아파트",
      legalAddress: "부산광역시 사하구 괴정동 258",
      roadAddress: "부산광역시 사하구 낙동대로 180",
      householdCount: 182,
      buildingCount: 3,
      approvalDate: "2015-08-06",
      heatingType: "개별난방",
      managementType: "자치관리",
      saleType: "분양",
      parkingCount: null,
      elevatorCount: null,
      grossFloorAreaM2: 19324.6751,
    });
  });

  it("merges basis and detail K-apt responses into one basic info row", () => {
    const response = {
      basis: {
        response: {
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          body: {
            item: {
              kaptCode: "A15180705",
              kaptName: "Gwanak Dream Town",
              kaptAddr: "Seoul Gwanak-gu Bongcheon-dong 1712",
              doroJuso: "Seoul Gwanak-gu Seonghyeon-ro 80",
              kaptdaCnt: 3544,
              kaptDongCnt: "44",
              kaptUsedate: "20030906",
              codeHeatNm: "Individual heating",
              codeMgrNm: "Contracted management",
              codeSaleNm: "Sale",
              kaptTarea: 531140,
            },
          },
        },
      },
      detail: {
        response: {
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          body: {
            item: {
              kaptCode: "A15180705",
              kaptName: "Gwanak Dream Town",
              kaptdPcnt: "975",
              kaptdPcntu: "4429",
              kaptdEcnt: 92,
            },
          },
        },
      },
    };

    expect(parseKaptBasicInfoResponse(response)).toMatchObject({
      kaptCode: "A15180705",
      kaptName: "Gwanak Dream Town",
      legalAddress: "Seoul Gwanak-gu Bongcheon-dong 1712",
      roadAddress: "Seoul Gwanak-gu Seonghyeon-ro 80",
      householdCount: 3544,
      buildingCount: 44,
      approvalDate: "2003-09-06",
      heatingType: "Individual heating",
      managementType: "Contracted management",
      saleType: "Sale",
      parkingCount: 5404,
      elevatorCount: 92,
      grossFloorAreaM2: 531140,
    });
  });

  it("returns null when K-apt has no item for the code", () => {
    expect(
      parseKaptBasicInfoResponse({
        response: {
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          body: {},
        },
      }),
    ).toBeNull();
  });

  it("throws K-apt error messages from public data responses", () => {
    expect(() =>
      parseKaptBasicInfoResponse({
        response: {
          header: { resultCode: "99", resultMsg: "INVALID_KEY" },
        },
      }),
    ).toThrow("K-apt API error 99: INVALID_KEY");

    expect(() =>
      parseKaptBasicInfoResponse({
        OpenAPI_ServiceResponse: {
          cmmMsgHeader: {
            returnReasonCode: "30",
            returnAuthMsg: "SERVICE KEY IS NOT REGISTERED ERROR.",
          },
        },
      }),
    ).toThrow("K-apt API error 30: SERVICE KEY IS NOT REGISTERED ERROR.");
  });
});

describe("buildKaptBasicInfoUrl", () => {
  it("uses the current AptBasisInfoServiceV4 basis endpoint and encodes decoded keys once", () => {
    const url = buildKaptBasicInfoUrl({
      serviceKey: "abc+/=",
      kaptCode: "A10027875",
    });

    expect(url).toMatch(
      /^http:\/\/apis\.data\.go\.kr\/1613000\/AptBasisInfoServiceV4\/getAphusBassInfoV4/,
    );
    expect(url).toContain("ServiceKey=abc%2B%2F%3D");
    expect(url).toContain("kaptCode=A10027875");
    expect(url).toContain("_type=json");
  });

  it("does not double encode an already encoded key", () => {
    const url = buildKaptBasicInfoUrl({
      serviceKey: "abc%2B%2F%3D",
      kaptCode: "A10027875",
    });

    expect(url).toContain("ServiceKey=abc%2B%2F%3D");
    expect(url).not.toContain("%252B");
  });
});

describe("fetchKaptBasicInfoJson", () => {
  it("fetches basis and detail responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
              body: { item: { kaptCode: "A10027875", kaptName: "Basis" } },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
              body: { item: { kaptCode: "A10027875", kaptName: "Detail" } },
            },
          }),
          { status: 200 },
        ),
      );

    const result = await fetchKaptBasicInfoJson({
      serviceKey: "abc",
      kaptCode: "A10027875",
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      basis: {
        response: {
          body: { item: { kaptName: "Basis" } },
        },
      },
      detail: {
        response: {
          body: { item: { kaptName: "Detail" } },
        },
      },
    });
  });

  it("surfaces API error bodies from non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          OpenAPI_ServiceResponse: {
            cmmMsgHeader: {
              returnReasonCode: "20",
              returnAuthMsg: "SERVICE_ACCESS_DENIED_ERROR.",
            },
          },
        }),
        { status: 403 },
      ),
    );

    await expect(
      fetchKaptBasicInfoJson({
        serviceKey: "abc",
        kaptCode: "A10027875",
      }),
    ).rejects.toThrow("K-apt API error 20: SERVICE_ACCESS_DENIED_ERROR.");
  });

  it("surfaces XML API error bodies from non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode><returnAuthMsg>SERVICE KEY IS NOT REGISTERED ERROR.</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>",
        { status: 403 },
      ),
    );

    await expect(
      fetchKaptBasicInfoJson({
        serviceKey: "abc",
        kaptCode: "A10027875",
      }),
    ).rejects.toThrow("K-apt API error 30: SERVICE KEY IS NOT REGISTERED ERROR.");
  });
});
