import { XMLParser } from "fast-xml-parser";
import { fetchWithTimeout } from "./http";

export const KAPT_BASIC_INFO_ENDPOINT =
  "http://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4";
export const KAPT_BASIC_INFO_DETAIL_ENDPOINT =
  "http://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusDtlInfoV4";
export const KAPT_BASIC_INFO_SOURCE_REF = `${KAPT_BASIC_INFO_ENDPOINT},${KAPT_BASIC_INFO_DETAIL_ENDPOINT}`;

type KaptApiRecord = Record<string, unknown>;

export type KaptBasicInfo = {
  kaptCode: string | null;
  kaptName: string | null;
  legalAddress: string | null;
  roadAddress: string | null;
  householdCount: number | null;
  buildingCount: number | null;
  approvalDate: string | null;
  heatingType: string | null;
  managementType: string | null;
  saleType: string | null;
  parkingCount: number | null;
  elevatorCount: number | null;
  grossFloorAreaM2: number | null;
};

export type FetchKaptBasicInfoParams = {
  serviceKey: string;
  kaptCode: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export function parseKaptBasicInfoResponse(response: unknown) {
  if (isCombinedKaptBasicInfoResponse(response)) {
    const records = [response.detail, response.basis]
      .map(readFirstKaptBasicInfoRecord)
      .filter((record): record is KaptApiRecord => Boolean(record));

    if (records.length === 0) {
      return null;
    }

    return normalizeKaptBasicInfoRecord(Object.assign({}, ...records));
  }

  const record = readFirstKaptBasicInfoRecord(response);

  return record ? normalizeKaptBasicInfoRecord(record) : null;
}

function readFirstKaptBasicInfoRecord(response: unknown) {
  const parsed = response as {
    response?: {
      header?: {
        resultCode?: unknown;
        resultMsg?: unknown;
      };
      body?: {
        item?: KaptApiRecord | KaptApiRecord[];
        items?:
          | { item?: KaptApiRecord | KaptApiRecord[] }
          | KaptApiRecord
          | KaptApiRecord[];
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
  assertSuccessfulKaptResponse(parsed.response?.header);

  const itemNode =
    parsed.response?.body?.item ?? readItemsNode(parsed.response?.body?.items);
  return toRecords(itemNode)[0] ?? null;
}

export async function fetchKaptBasicInfoJson({
  serviceKey,
  kaptCode,
}: FetchKaptBasicInfoParams) {
  const [basis, detail] = await Promise.all([
    fetchKaptBasicInfoEndpoint({
      endpoint: KAPT_BASIC_INFO_ENDPOINT,
      serviceKey,
      kaptCode,
    }),
    fetchKaptBasicInfoEndpoint({
      endpoint: KAPT_BASIC_INFO_DETAIL_ENDPOINT,
      serviceKey,
      kaptCode,
    }),
  ]);

  return { basis, detail };
}

async function fetchKaptBasicInfoEndpoint({
  endpoint,
  serviceKey,
  kaptCode,
}: FetchKaptBasicInfoParams & { endpoint: string }) {
  const response = await fetchWithTimeout(
    buildKaptBasicInfoUrl({ endpoint, serviceKey, kaptCode }),
    undefined,
    { label: "K-apt basic info API" },
  );
  const body = await response.text();
  const parsed = parseResponseBody(body);

  if (!response.ok) {
    throwKaptHttpError(response.status, body, parsed);
  }

  return parsed;
}

export function buildKaptBasicInfoUrl({
  endpoint = KAPT_BASIC_INFO_ENDPOINT,
  serviceKey,
  kaptCode,
}: FetchKaptBasicInfoParams & { endpoint?: string }) {
  const params = new URLSearchParams({
    kaptCode,
    _type: "json",
  });
  const trimmedServiceKey = serviceKey.trim();
  const serviceKeyParam = looksUrlEncoded(trimmedServiceKey)
    ? trimmedServiceKey
    : encodeURIComponent(trimmedServiceKey);

  return `${endpoint}?ServiceKey=${serviceKeyParam}&${params.toString()}`;
}

function normalizeKaptBasicInfoRecord(record: KaptApiRecord): KaptBasicInfo {
  return {
    kaptCode: cleanText(record.kaptCode),
    kaptName: cleanText(record.kaptName),
    legalAddress: cleanText(record.kaptAddr),
    roadAddress: cleanText(record.doroJuso),
    householdCount: parseInteger(readFirst(record, ["kaptdaCnt", "hoCnt"])),
    buildingCount: parseInteger(record.kaptDongCnt),
    approvalDate: parseCompactDate(record.kaptUsedate),
    heatingType: cleanText(record.codeHeatNm),
    managementType: cleanText(readFirst(record, ["codeMgrNm", "codeMgr"])),
    saleType: cleanText(record.codeSaleNm),
    parkingCount: parseParkingCount(record),
    elevatorCount: parseInteger(
      readFirst(record, ["kaptdEcnt", "kaptdEcntp", "elevatorCnt"]),
    ),
    grossFloorAreaM2: parseNumber(record.kaptTarea),
  };
}

function parseParkingCount(record: KaptApiRecord) {
  const total = parseInteger(readFirst(record, ["parkingCnt", "kaptParkingCnt"]));

  if (total !== null) {
    return total;
  }

  const ground = parseInteger(readFirst(record, ["kaptdPcnt", "parkingGroundCnt"]));
  const underground = parseInteger(
    readFirst(record, ["kaptdPcntu", "parkingUndergroundCnt"]),
  );

  if (ground === null && underground === null) {
    return null;
  }

  return (ground ?? 0) + (underground ?? 0);
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
    `K-apt API error ${resultCode}: ${
      cleanText(header?.returnAuthMsg) ?? cleanText(header?.errMsg) ?? "Unknown error"
    }`,
  );
}

function assertSuccessfulKaptResponse(
  header: { resultCode?: unknown; resultMsg?: unknown } | undefined,
) {
  const resultCode = cleanText(header?.resultCode);

  if (!resultCode || resultCode === "00" || resultCode === "000") {
    return;
  }

  throw new Error(
    `K-apt API error ${resultCode}: ${cleanText(header?.resultMsg) ?? "Unknown error"}`,
  );
}

function parseResponseBody(body: string) {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    if (body.trim().startsWith("<")) {
      return parser.parse(body) as unknown;
    }

    throw new Error("K-apt API response is not valid JSON.");
  }
}

function throwKaptHttpError(status: number, body: string, parsed: unknown): never {
  try {
    parseKaptBasicInfoResponse(parsed);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("K-apt API error")) {
      throw error;
    }
  }

  const preview = getBodyPreview(body);
  throw new Error(
    preview
      ? `K-apt API request failed with ${status}: ${preview}`
      : `K-apt API request failed with ${status}`,
  );
}

function getBodyPreview(body: string) {
  const preview = body.replace(/\s+/g, " ").trim();
  return preview.length > 160 ? `${preview.slice(0, 160)}...` : preview;
}

function looksUrlEncoded(value: string) {
  return /%[0-9a-f]{2}/i.test(value);
}

function readFirst(record: KaptApiRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) {
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

function toRecords(itemNode: unknown): KaptApiRecord[] {
  if (Array.isArray(itemNode)) {
    return itemNode.filter(isRecord);
  }

  return isRecord(itemNode) ? [itemNode] : [];
}

function isCombinedKaptBasicInfoResponse(
  response: unknown,
): response is { basis?: unknown; detail?: unknown } {
  return isRecord(response) && ("basis" in response || "detail" in response);
}

function isRecord(value: unknown): value is KaptApiRecord {
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

function parseCompactDate(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return null;
}
