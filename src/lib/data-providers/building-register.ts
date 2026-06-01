import { XMLParser } from "fast-xml-parser";

export const BUILDING_REGISTER_RECAP_TITLE_ENDPOINT =
  "http://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo";
export const BUILDING_REGISTER_TITLE_ENDPOINT =
  "http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo";
export const BUILDING_REGISTER_SOURCE_REF = `${BUILDING_REGISTER_RECAP_TITLE_ENDPOINT},${BUILDING_REGISTER_TITLE_ENDPOINT}`;

export type BuildingRegisterQuery = {
  sigunguCd: string;
  bjdongCd: string;
  platGbCd: "0" | "1" | "2";
  bun: string;
  ji: string;
};

export type BuildingRegisterInfo = {
  buildingName: string | null;
  legalAddress: string | null;
  roadAddress: string | null;
  landAreaM2: number | null;
  buildingAreaM2: number | null;
  grossFloorAreaM2: number | null;
  floorAreaRatio: number | null;
  buildingCoverageRatio: number | null;
  mainUse: string | null;
  highestFloor: number | null;
  lowestFloor: number | null;
  structureType: string | null;
};

export type BuildingRegisterParseResult = {
  totalCount: number;
  items: BuildingRegisterInfo[];
};

export type BuildingRegisterFetchResult = {
  endpoint: string;
  rawResponse: unknown;
  parsed: BuildingRegisterParseResult;
  selected: BuildingRegisterInfo | null;
};

type BuildingRegisterRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export async function fetchBuildingRegisterInfo({
  serviceKey,
  query,
}: {
  serviceKey: string;
  query: BuildingRegisterQuery;
}): Promise<BuildingRegisterFetchResult> {
  const endpoints = [
    BUILDING_REGISTER_RECAP_TITLE_ENDPOINT,
    BUILDING_REGISTER_TITLE_ENDPOINT,
  ];
  let firstEmptyResult: BuildingRegisterFetchResult | null = null;
  let bestResult: BuildingRegisterFetchResult | null = null;
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const result = await fetchBuildingRegisterEndpoint({
        endpoint,
        serviceKey,
        query,
      });

      if (result.selected) {
        if (
          !bestResult?.selected ||
          scoreBuildingRegisterInfo(result.selected) >
            scoreBuildingRegisterInfo(bestResult.selected)
        ) {
          bestResult = result;
        }

        if (hasDensityMetrics(result.selected)) {
          return result;
        }
      }

      firstEmptyResult ??= result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (firstEmptyResult) {
    return bestResult ?? firstEmptyResult;
  }

  if (bestResult) {
    return bestResult;
  }

  throw lastError ?? new Error("Building register API request failed.");
}

async function fetchBuildingRegisterEndpoint({
  endpoint,
  serviceKey,
  query,
}: {
  endpoint: string;
  serviceKey: string;
  query: BuildingRegisterQuery;
}) {
  const response = await fetch(
    buildBuildingRegisterUrl({
      endpoint,
      serviceKey,
      ...query,
      pageNo: 1,
      numOfRows: 100,
    }),
  );
  const body = await response.text();
  const rawResponse = parseResponseBody(body);

  if (!response.ok) {
    throwBuildingRegisterHttpError(response.status, body, rawResponse);
  }

  const parsed = parseBuildingRegisterResponse(rawResponse);

  return {
    endpoint,
    rawResponse,
    parsed,
    selected: selectBestBuildingRegisterInfo(parsed.items),
  };
}

export function buildBuildingRegisterUrl({
  endpoint = BUILDING_REGISTER_RECAP_TITLE_ENDPOINT,
  serviceKey,
  sigunguCd,
  bjdongCd,
  platGbCd,
  bun,
  ji,
  pageNo = 1,
  numOfRows = 100,
}: BuildingRegisterQuery & {
  endpoint?: string;
  serviceKey: string;
  pageNo?: number;
  numOfRows?: number;
}) {
  const params = new URLSearchParams({
    sigunguCd,
    bjdongCd,
    platGbCd,
    bun,
    ji,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    _type: "json",
  });
  const trimmedServiceKey = serviceKey.trim();
  const serviceKeyParam = looksUrlEncoded(trimmedServiceKey)
    ? trimmedServiceKey
    : encodeURIComponent(trimmedServiceKey);

  return `${endpoint}?serviceKey=${serviceKeyParam}&${params.toString()}`;
}

export function parseBuildingRegisterResponse(
  response: unknown,
): BuildingRegisterParseResult {
  const parsed = parseResponseBody(response) as {
    response?: {
      header?: {
        resultCode?: unknown;
        resultMsg?: unknown;
      };
      body?: {
        item?: BuildingRegisterRecord | BuildingRegisterRecord[];
        items?:
          | { item?: BuildingRegisterRecord | BuildingRegisterRecord[] }
          | BuildingRegisterRecord
          | BuildingRegisterRecord[];
        totalCount?: unknown;
      };
    };
    OpenAPI_ServiceResponse?: {
      cmmMsgHeader?: {
        returnReasonCode?: unknown;
        returnAuthMsg?: unknown;
        errMsg?: unknown;
      };
    };
  };

  assertSuccessfulOpenApiResponse(parsed.OpenAPI_ServiceResponse?.cmmMsgHeader);
  assertSuccessfulBuildingRegisterResponse(parsed.response?.header);

  const itemNode =
    parsed.response?.body?.item ?? readItemsNode(parsed.response?.body?.items);
  const items = toRecords(itemNode).map(normalizeBuildingRegisterRecord);

  return {
    totalCount: parseInteger(parsed.response?.body?.totalCount) ?? items.length,
    items,
  };
}

export function selectBestBuildingRegisterInfo(items: BuildingRegisterInfo[]) {
  return [...items].sort(
    (left, right) =>
      scoreBuildingRegisterInfo(right) - scoreBuildingRegisterInfo(left),
  )[0] ?? null;
}

function normalizeBuildingRegisterRecord(
  record: BuildingRegisterRecord,
): BuildingRegisterInfo {
  return {
    buildingName: cleanText(readFirst(record, ["bldNm", "buildingName"])),
    legalAddress: cleanText(readFirst(record, ["platPlc", "legalAddress"])),
    roadAddress: cleanText(readFirst(record, ["newPlatPlc", "roadAddress"])),
    landAreaM2: parsePositiveNumber(readFirst(record, ["platArea", "landAreaM2"])),
    buildingAreaM2: parsePositiveNumber(
      readFirst(record, ["archArea", "buildingAreaM2"]),
    ),
    grossFloorAreaM2: parsePositiveNumber(
      readFirst(record, ["totArea", "grossFloorAreaM2"]),
    ),
    floorAreaRatio: parsePositiveNumber(readFirst(record, ["vlRat", "floorAreaRatio"])),
    buildingCoverageRatio: parsePositiveNumber(
      readFirst(record, ["bcRat", "buildingCoverageRatio"]),
    ),
    mainUse: cleanText(readFirst(record, ["mainPurpsCdNm", "mainUse"])),
    highestFloor: parseInteger(readFirst(record, ["grndFlrCnt", "highestFloor"])),
    lowestFloor: parseInteger(readFirst(record, ["ugrndFlrCnt", "lowestFloor"])),
    structureType: cleanText(readFirst(record, ["strctCdNm", "structureType"])),
  };
}

function scoreBuildingRegisterInfo(info: BuildingRegisterInfo): number {
  return (
    scorePositiveMetric(info.floorAreaRatio, 5) +
    scorePositiveMetric(info.buildingCoverageRatio, 5) +
    scorePositiveMetric(info.landAreaM2, 4) +
    scorePositiveMetric(info.buildingAreaM2, 3) +
    scorePositiveMetric(info.grossFloorAreaM2, 1) +
    scorePositiveMetric(info.highestFloor, 1) +
    (info.lowestFloor !== null ? 1 : 0)
  );
}

function hasDensityMetrics(info: BuildingRegisterInfo) {
  return (
    isPositiveNumber(info.floorAreaRatio) &&
    isPositiveNumber(info.buildingCoverageRatio) &&
    isPositiveNumber(info.landAreaM2)
  );
}

function scorePositiveMetric(value: number | null, weight: number) {
  return isPositiveNumber(value) ? weight : 0;
}

function isPositiveNumber(value: number | null) {
  return value !== null && value > 0;
}

function parseResponseBody(response: unknown) {
  if (typeof response !== "string") {
    return response;
  }

  const trimmed = response.trim();

  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("<")) {
    return parser.parse(trimmed) as unknown;
  }

  return JSON.parse(trimmed) as unknown;
}

function assertSuccessfulOpenApiResponse(
  header:
    | {
        returnReasonCode?: unknown;
        returnAuthMsg?: unknown;
        errMsg?: unknown;
      }
    | undefined,
) {
  const resultCode = cleanText(header?.returnReasonCode);

  if (!resultCode) {
    return;
  }

  throw new Error(
    `Building register API error ${resultCode}: ${
      cleanText(header?.returnAuthMsg) ?? cleanText(header?.errMsg) ?? "Unknown error"
    }`,
  );
}

function assertSuccessfulBuildingRegisterResponse(
  header: { resultCode?: unknown; resultMsg?: unknown } | undefined,
) {
  const resultCode = cleanText(header?.resultCode);

  if (!resultCode || resultCode === "00" || resultCode === "000") {
    return;
  }

  throw new Error(
    `Building register API error ${resultCode}: ${
      cleanText(header?.resultMsg) ?? "Unknown error"
    }`,
  );
}

function throwBuildingRegisterHttpError(
  status: number,
  body: string,
  rawResponse: unknown,
): never {
  try {
    parseBuildingRegisterResponse(rawResponse);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Building register API error")
    ) {
      throw error;
    }
  }

  const preview = body.replace(/\s+/g, " ").trim().slice(0, 160);
  throw new Error(
    preview
      ? `Building register API request failed with ${status}: ${preview}`
      : `Building register API request failed with ${status}`,
  );
}

function readFirst(record: BuildingRegisterRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined) {
      return record[key];
    }
  }

  return null;
}

function readItemsNode(itemsNode: unknown) {
  if (isRecord(itemsNode) && "item" in itemsNode) {
    return itemsNode.item;
  }

  return itemsNode;
}

function toRecords(itemNode: unknown): BuildingRegisterRecord[] {
  if (Array.isArray(itemNode)) {
    return itemNode.filter(isRecord);
  }

  return isRecord(itemNode) ? [itemNode] : [];
}

function isRecord(value: unknown): value is BuildingRegisterRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 && text.toLowerCase() !== "none" ? text : null;
}

function parseInteger(value: unknown) {
  const text = cleanText(value)?.replace(/,/g, "");

  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseNumber(value: unknown) {
  const text = cleanText(value)?.replace(/,/g, "");
  const parsed = text ? Number(text) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveNumber(value: unknown) {
  const parsed = parseNumber(value);

  return parsed !== null && parsed > 0 ? parsed : null;
}

function looksUrlEncoded(value: string) {
  return /%[0-9a-f]{2}/i.test(value);
}
