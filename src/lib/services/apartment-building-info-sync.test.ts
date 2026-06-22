import { describe, expect, it } from "vitest";
import type {
  BuildingRegisterFetchResult,
  BuildingRegisterInfo,
} from "../data-providers/building-register";
import type { BuildingRegisterQueryResolution } from "./building-register-resolver";
import {
  buildBuildingInfoRawApiResponsePayload,
  buildBuildingRegisterAddressHints,
  buildBuildingRegisterBjdCodeHints,
  toBuildingInfoPayload,
} from "./apartment-building-info-sync";

const buildingInfo: BuildingRegisterInfo = {
  buildingName: "Alpha Heights",
  legalAddress: "Sangdo-dong 414",
  roadAddress: "Sangdo-ro 100",
  landAreaM2: 10_000,
  buildingAreaM2: 2_000,
  grossFloorAreaM2: 35_000,
  floorAreaRatio: 249.35,
  buildingCoverageRatio: 18.42,
  mainUse: "Apartment",
  highestFloor: 25,
  lowestFloor: 2,
  structureType: "RC",
};

const resolution: Extract<BuildingRegisterQueryResolution, { ok: true }> = {
  ok: true,
  query: {
    sigunguCd: "11590",
    bjdongCd: "10200",
    platGbCd: "0",
    bun: "0414",
    ji: "0000",
  },
  matchedAddress: "Sangdo-dong 414",
  addressSource: "apartment_transactions.address_from_source",
  bjdCodeSource: "apartments.lawd_cd",
};

describe("buildBuildingRegisterBjdCodeHints", () => {
  it("uses K-apt directory bjd code as a resolver hint", () => {
    expect(buildBuildingRegisterBjdCodeHints({ bjd_code: "1159010200" })).toEqual([
      { value: "1159010200", source: "kapt_code_directory" },
    ]);
  });

  it("returns no hint when the directory has no bjd code", () => {
    expect(buildBuildingRegisterBjdCodeHints({ bjd_code: null })).toEqual([]);
  });
});

describe("buildBuildingRegisterAddressHints", () => {
  it("keeps the existing source priority and removes duplicate addresses", () => {
    expect(
      buildBuildingRegisterAddressHints({
        apartment: {
          address: "Sangdo-dong 414",
          road_address: "Sangdo-ro 100",
        },
        basicInfo: {
          legal_address_from_source: "Bongcheon-dong 1000",
          road_address_from_source: "Seonghyeon-ro 80",
        },
        directoryInfo: {
          legal_address: "Sangdo-dong 414",
          road_address: "Sangdo-ro 100",
        },
        transactionAddresses: [
          { address_from_source: "Sangdo-dong 414" },
          { address_from_source: "Sangdo-dong 500" },
        ],
      }),
    ).toEqual([
      {
        value: "Bongcheon-dong 1000",
        source: "apartment_basic_info.legal_address_from_source",
      },
      {
        value: "Sangdo-dong 414",
        source: "kapt_code_directory.legal_address",
      },
      {
        value: "Sangdo-dong 500",
        source: "apartment_transactions.address_from_source",
      },
      {
        value: "Seonghyeon-ro 80",
        source: "apartment_basic_info.road_address_from_source",
      },
      {
        value: "Sangdo-ro 100",
        source: "kapt_code_directory.road_address",
      },
    ]);
  });
});

describe("toBuildingInfoPayload", () => {
  it("maps selected building-register info to the existing upsert payload", () => {
    expect(
      toBuildingInfoPayload(buildingInfo, {
        apartmentId: "apt-id",
        fetchedAt: "2026-06-22T00:00:00.000Z",
        rawApiResponseId: "raw-id",
        sourceRef: "building-endpoint",
        userId: "user-id",
      }),
    ).toEqual({
      user_id: "user-id",
      apartment_id: "apt-id",
      raw_api_response_id: "raw-id",
      source_name: "molit-building-register",
      source_ref: "building-endpoint",
      legal_address_from_source: "Sangdo-dong 414",
      road_address_from_source: "Sangdo-ro 100",
      land_area_m2: 10_000,
      building_area_m2: 2_000,
      gross_floor_area_m2: 35_000,
      floor_area_ratio: 249.35,
      building_coverage_ratio: 18.42,
      main_use: "Apartment",
      highest_floor: 25,
      lowest_floor: 2,
      structure_type: "RC",
      confidence_level: "high",
      fetched_at: "2026-06-22T00:00:00.000Z",
    });
  });
});

describe("buildBuildingInfoRawApiResponsePayload", () => {
  it("preserves the raw response record shape used by the route", () => {
    const fetched: BuildingRegisterFetchResult = {
      endpoint: "building-endpoint",
      rawResponse: { raw: true },
      parsed: {
        totalCount: 1,
        items: [buildingInfo],
      },
      selected: buildingInfo,
    };

    const payload = buildBuildingInfoRawApiResponsePayload({
      apartmentId: "apt-id",
      fetched,
      resolution,
      userId: "user-id",
    });

    expect(payload).toMatchObject({
      provider: "molit",
      endpoint: "building-endpoint",
      request_params: {
        apartmentId: "apt-id",
        query: resolution.query,
        matchedAddress: "Sangdo-dong 414",
        addressSource: "apartment_transactions.address_from_source",
        bjdCodeSource: "apartments.lawd_cd",
      },
      response_body: {
        endpoint: "building-endpoint",
        totalCount: 1,
        selected: buildingInfo,
        items: [buildingInfo],
        rawResponse: { raw: true },
      },
      apartment_id: "apt-id",
      user_id: "user-id",
    });
    expect(payload.request_hash).toHaveLength(64);
  });
});
