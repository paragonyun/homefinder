import { describe, expect, it } from "vitest";
import {
  parseBuildingRegisterLotAddress,
  resolveBuildingRegisterQuery,
} from "./building-register-resolver";

describe("parseBuildingRegisterLotAddress", () => {
  it("extracts normal lot bun and ji from legal-dong addresses", () => {
    expect(parseBuildingRegisterLotAddress("서울특별시 관악구 봉천동 1712")).toEqual({
      platGbCd: "0",
      bun: "1712",
      ji: "0000",
      matchedAddress: "서울특별시 관악구 봉천동 1712",
    });

    expect(parseBuildingRegisterLotAddress("서울 강서구 염창동 268-3")).toEqual({
      platGbCd: "0",
      bun: "0268",
      ji: "0003",
      matchedAddress: "서울 강서구 염창동 268-3",
    });
  });

  it("extracts mountain lot addresses and rejects road-name addresses", () => {
    expect(parseBuildingRegisterLotAddress("서울 관악구 봉천동 산 12-4")).toEqual({
      platGbCd: "1",
      bun: "0012",
      ji: "0004",
      matchedAddress: "서울 관악구 봉천동 산 12-4",
    });

    expect(parseBuildingRegisterLotAddress("서울특별시 관악구 성현로 80")).toBeNull();
  });
});

describe("resolveBuildingRegisterQuery", () => {
  it("uses a 10-digit apartment lawd code and K-apt legal address", () => {
    const result = resolveBuildingRegisterQuery({
      lawdCd: "1162010100",
      bjdCodes: [],
      addresses: [
        {
          value: "서울특별시 관악구 봉천동 1712",
          source: "kapt-basic-info",
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      query: {
        sigunguCd: "11620",
        bjdongCd: "10100",
        platGbCd: "0",
        bun: "1712",
        ji: "0000",
      },
      addressSource: "kapt-basic-info",
      matchedAddress: "서울특별시 관악구 봉천동 1712",
      bjdCodeSource: "apartments.lawd_cd",
    });
  });

  it("falls back to K-apt directory bjd code and transaction source address", () => {
    const result = resolveBuildingRegisterQuery({
      lawdCd: "11500",
      bjdCodes: [{ value: "1150010100", source: "kapt_code_directory" }],
      addresses: [
        { value: "서울특별시 강서구 양천로 731", source: "apartments.address" },
        { value: "염창동 268-3", source: "apartment_transactions" },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      query: {
        sigunguCd: "11500",
        bjdongCd: "10100",
        platGbCd: "0",
        bun: "0268",
        ji: "0003",
      },
      addressSource: "apartment_transactions",
      bjdCodeSource: "kapt_code_directory",
    });
  });

  it("returns a clear error when only a 5-digit lawd code is available", () => {
    expect(
      resolveBuildingRegisterQuery({
        lawdCd: "11500",
        bjdCodes: [],
        addresses: [{ value: "염창동 268", source: "apartment_transactions" }],
      }),
    ).toEqual({
      ok: false,
      error: "건축물대장 조회에는 10자리 법정동코드가 필요합니다.",
    });
  });
});
