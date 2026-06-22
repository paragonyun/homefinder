import { createHash } from "node:crypto";
import type {
  BuildingRegisterFetchResult,
  BuildingRegisterInfo,
} from "../data-providers/building-register";
import type {
  BuildingRegisterAddressHint,
  BuildingRegisterBjdCodeHint,
  BuildingRegisterQueryResolution,
} from "./building-register-resolver";

export const BUILDING_REGISTER_SOURCE_NAME = "molit-building-register";

export type ApartmentBuildingSyncAddress = {
  address: string | null;
  road_address: string | null;
};

export type BasicInfoAddressRow = {
  legal_address_from_source: string | null;
  road_address_from_source: string | null;
};

export type KaptDirectoryAddressRow = {
  bjd_code: string | null;
  legal_address?: string | null;
  road_address?: string | null;
};

export type TransactionAddressRow = {
  address_from_source: string | null;
};

type SuccessfulBuildingRegisterResolution = Extract<
  BuildingRegisterQueryResolution,
  { ok: true }
>;

export function buildBuildingRegisterBjdCodeHints(
  directoryInfo: Pick<KaptDirectoryAddressRow, "bjd_code"> | null,
) {
  const hints: BuildingRegisterBjdCodeHint[] = [];

  if (directoryInfo?.bjd_code) {
    hints.push({
      value: directoryInfo.bjd_code,
      source: "kapt_code_directory",
    });
  }

  return hints;
}

export function buildBuildingRegisterAddressHints({
  apartment,
  basicInfo,
  directoryInfo,
  transactionAddresses,
}: {
  apartment: ApartmentBuildingSyncAddress;
  basicInfo: BasicInfoAddressRow | null;
  directoryInfo: Omit<KaptDirectoryAddressRow, "bjd_code"> | null;
  transactionAddresses: TransactionAddressRow[];
}) {
  const hints: BuildingRegisterAddressHint[] = [
    {
      value: basicInfo?.legal_address_from_source,
      source: "apartment_basic_info.legal_address_from_source",
    },
    {
      value: directoryInfo?.legal_address,
      source: "kapt_code_directory.legal_address",
    },
    ...transactionAddresses.map((row) => ({
      value: row.address_from_source,
      source: "apartment_transactions.address_from_source",
    })),
    {
      value: apartment.address,
      source: "apartments.address",
    },
    {
      value: basicInfo?.road_address_from_source,
      source: "apartment_basic_info.road_address_from_source",
    },
    {
      value: directoryInfo?.road_address,
      source: "kapt_code_directory.road_address",
    },
    {
      value: apartment.road_address,
      source: "apartments.road_address",
    },
  ];
  const seen = new Set<string>();

  return hints.filter((hint) => {
    const key = hint.value?.trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildBuildingInfoRawApiResponsePayload({
  apartmentId,
  fetched,
  resolution,
  userId,
}: {
  apartmentId: string;
  fetched: BuildingRegisterFetchResult;
  resolution: SuccessfulBuildingRegisterResolution;
  userId: string;
}) {
  const requestFingerprint = {
    apartmentId,
    query: resolution.query,
    matchedAddress: resolution.matchedAddress,
    addressSource: resolution.addressSource,
    bjdCodeSource: resolution.bjdCodeSource,
  };

  return {
    provider: "molit",
    endpoint: fetched.endpoint,
    request_hash: hashText(JSON.stringify(requestFingerprint)),
    request_params: requestFingerprint,
    response_body: {
      endpoint: fetched.endpoint,
      totalCount: fetched.parsed.totalCount,
      selected: fetched.selected,
      items: fetched.parsed.items,
      rawResponse: fetched.rawResponse,
    },
    apartment_id: apartmentId,
    user_id: userId,
  };
}

export function toBuildingInfoPayload(
  info: BuildingRegisterInfo,
  context: {
    apartmentId: string;
    fetchedAt: string;
    rawApiResponseId: string;
    sourceRef: string;
    userId: string;
  },
) {
  return {
    user_id: context.userId,
    apartment_id: context.apartmentId,
    raw_api_response_id: context.rawApiResponseId,
    source_name: BUILDING_REGISTER_SOURCE_NAME,
    source_ref: context.sourceRef,
    legal_address_from_source: info.legalAddress,
    road_address_from_source: info.roadAddress,
    land_area_m2: info.landAreaM2,
    building_area_m2: info.buildingAreaM2,
    gross_floor_area_m2: info.grossFloorAreaM2,
    floor_area_ratio: info.floorAreaRatio,
    building_coverage_ratio: info.buildingCoverageRatio,
    main_use: info.mainUse,
    highest_floor: info.highestFloor,
    lowest_floor: info.lowestFloor,
    structure_type: info.structureType,
    confidence_level: "high",
    fetched_at: context.fetchedAt,
  };
}

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
