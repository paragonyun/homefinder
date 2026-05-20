import { XMLParser } from "fast-xml-parser";

export const KAPT_APARTMENT_LIST_ENDPOINT =
  "http://apis.data.go.kr/1613000/AptListService2/getTotalAptList";

export type KaptApartmentListItem = {
  kaptCode: string;
  kaptName: string;
  bjdCode: string | null;
  sido: string | null;
  sigungu: string | null;
  eupmyeondong: string | null;
  ri: string | null;
};

export type KaptApartmentListParseResult = {
  totalCount: number;
  items: KaptApartmentListItem[];
};

export type FetchKaptApartmentListParams = {
  serviceKey: string;
  pageNo?: number;
  numOfRows?: number;
};

type KaptApartmentListRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export async function fetchKaptApartmentList({
  serviceKey,
  pageNo = 1,
  numOfRows = 20_000,
}: FetchKaptApartmentListParams) {
  const response = await fetch(
    buildKaptApartmentListUrl({ serviceKey, pageNo, numOfRows }),
  );
  const body = await response.text();

  if (!response.ok) {
    throwKaptApartmentListHttpError(response.status, body);
  }

  return parseKaptApartmentListResponse(body);
}

export function buildKaptApartmentListUrl({
  serviceKey,
  pageNo = 1,
  numOfRows = 20_000,
}: FetchKaptApartmentListParams) {
  const params = new URLSearchParams({
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
  });
  const trimmedServiceKey = serviceKey.trim();
  const serviceKeyParam = looksUrlEncoded(trimmedServiceKey)
    ? trimmedServiceKey
    : encodeURIComponent(trimmedServiceKey);

  return `${KAPT_APARTMENT_LIST_ENDPOINT}?serviceKey=${serviceKeyParam}&${params.toString()}`;
}

export function parseKaptApartmentListResponse(
  response: unknown,
): KaptApartmentListParseResult {
  const parsed = parseResponseBody(response) as {
    response?: {
      header?: {
        resultCode?: unknown;
        resultMsg?: unknown;
      };
      body?: {
        item?: KaptApartmentListRecord | KaptApartmentListRecord[];
        items?: { item?: KaptApartmentListRecord | KaptApartmentListRecord[] };
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
  assertSuccessfulKaptListResponse(parsed.response?.header);

  const itemNode =
    parsed.response?.body?.item ?? parsed.response?.body?.items?.item;
  const records = Array.isArray(itemNode) ? itemNode : itemNode ? [itemNode] : [];
  const items = records
    .map(normalizeKaptApartmentListRecord)
    .filter((item): item is KaptApartmentListItem => Boolean(item));

  return {
    totalCount: parseInteger(parsed.response?.body?.totalCount) ?? items.length,
    items,
  };
}

function normalizeKaptApartmentListRecord(
  record: KaptApartmentListRecord,
): KaptApartmentListItem | null {
  const kaptCode = cleanText(record.kaptCode);
  const kaptName = cleanText(record.kaptName);

  if (!kaptCode || !kaptName) {
    return null;
  }

  return {
    kaptCode,
    kaptName,
    bjdCode: cleanText(record.bjdCode),
    sido: cleanText(record.as1),
    sigungu: cleanText(record.as2),
    eupmyeondong: cleanText(record.as3),
    ri: cleanText(record.as4),
  };
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
    `K-apt apartment list API error ${resultCode}: ${
      cleanText(header?.returnAuthMsg) ?? cleanText(header?.errMsg) ?? "Unknown error"
    }`,
  );
}

function assertSuccessfulKaptListResponse(
  header: { resultCode?: unknown; resultMsg?: unknown } | undefined,
) {
  const resultCode = cleanText(header?.resultCode);

  if (!resultCode || resultCode === "00" || resultCode === "000") {
    return;
  }

  throw new Error(
    `K-apt apartment list API error ${resultCode}: ${
      cleanText(header?.resultMsg) ?? "Unknown error"
    }`,
  );
}

function throwKaptApartmentListHttpError(status: number, body: string): never {
  try {
    parseKaptApartmentListResponse(body);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("K-apt apartment list API error")
    ) {
      throw error;
    }
  }

  const preview = body.replace(/\s+/g, " ").trim().slice(0, 160);
  throw new Error(
    preview
      ? `K-apt apartment list API request failed with ${status}: ${preview}`
      : `K-apt apartment list API request failed with ${status}`,
  );
}

function looksUrlEncoded(value: string) {
  return /%[0-9a-f]{2}/i.test(value);
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
