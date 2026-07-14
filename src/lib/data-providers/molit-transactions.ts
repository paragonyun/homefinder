import { XMLParser } from "fast-xml-parser";
import { fetchWithTimeout } from "./http";

export const MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT =
  "http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

type MolitXmlRecord = Record<string, unknown>;

export type MolitApartmentTrade = {
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealDate: string;
  exclusiveAreaM2: number;
  floor: number | null;
  dealAmountManwon: number;
  dealAmountKrw: number;
  apartmentNameFromSource: string | null;
  addressFromSource: string | null;
  lotNumberFromSource?: string | null;
  roadAddressFromSource?: string | null;
  cancelYn: string | null;
  cancelDate: string | null;
  aptSeq?: string | null;
  aptDong?: string | null;
  sggCd?: string | null;
  umdCd?: string | null;
  buildYear?: number | null;
  dealingGbn?: string | null;
  rgstDate?: string | null;
};

export type MolitApartmentTradeParseResult = {
  totalCount: number;
  transactions: MolitApartmentTrade[];
};

export type FetchMolitApartmentTradesParams = {
  serviceKey: string;
  lawdCd: string;
  dealYmd: string;
  numOfRows?: number;
};

export type MolitApartmentTradePage = MolitApartmentTradeParseResult & {
  pageNo: number;
  rawXml: string;
};

export type ResolveMolitDealYmdsResult =
  | {
      ok: true;
      mode: "manual" | "recent";
      dealYmds: string[];
    }
  | {
      ok: false;
      error: string;
    };

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const DEFAULT_RECENT_MONTH_COUNT = 12;
const MAX_RECENT_MONTH_COUNT = 36;

export function resolveMolitDealYmds({
  dealYmd,
  months,
  now = new Date(),
}: {
  dealYmd?: unknown;
  months?: unknown;
  now?: Date;
}): ResolveMolitDealYmdsResult {
  if (typeof dealYmd === "string" && dealYmd.trim().length > 0) {
    const trimmed = dealYmd.trim();

    if (!/^\d{6}$/.test(trimmed)) {
      return { ok: false, error: "계약년월은 YYYYMM 형식으로 입력하세요." };
    }

    return { ok: true, mode: "manual", dealYmds: [trimmed] };
  }

  const monthCount =
    typeof months === "number" && Number.isInteger(months)
      ? Math.min(Math.max(months, 1), MAX_RECENT_MONTH_COUNT)
      : DEFAULT_RECENT_MONTH_COUNT;

  return {
    ok: true,
    mode: "recent",
    dealYmds: getRecentDealYmds({ from: now, months: monthCount }),
  };
}

export function getRecentDealYmds({
  from,
  months,
}: {
  from: Date;
  months: number;
}) {
  const result: string[] = [];
  const startYear = from.getUTCFullYear();
  const startMonthIndex = from.getUTCMonth();

  for (let index = 0; index < months; index += 1) {
    const date = new Date(Date.UTC(startYear, startMonthIndex - index, 1));
    result.push(
      `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  return result;
}

export function parseMolitApartmentTradeXml(
  xml: string,
): MolitApartmentTradeParseResult {
  const parsed = parser.parse(xml) as {
    response?: {
      header?: {
        resultCode?: unknown;
        resultMsg?: unknown;
      };
      body?: {
        items?: { item?: MolitXmlRecord | MolitXmlRecord[] } | string;
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
  assertSuccessfulMolitResponse(parsed.response?.header);

  const body = parsed.response?.body;
  const itemNode = typeof body?.items === "object" ? body.items.item : undefined;
  const records = Array.isArray(itemNode) ? itemNode : itemNode ? [itemNode] : [];

  return {
    totalCount: parseInteger(body?.totalCount) ?? records.length,
    transactions: records.map(normalizeMolitTradeRecord),
  };
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
    `MOLIT API error ${resultCode}: ${
      cleanText(header?.returnAuthMsg) ?? cleanText(header?.errMsg) ?? "Unknown error"
    }`,
  );
}

function assertSuccessfulMolitResponse(
  header: { resultCode?: unknown; resultMsg?: unknown } | undefined,
) {
  const resultCode = cleanText(header?.resultCode);

  if (!resultCode || resultCode === "000" || resultCode === "00") {
    return;
  }

  throw new Error(
    `MOLIT API error ${resultCode}: ${cleanText(header?.resultMsg) ?? "Unknown error"}`,
  );
}

export async function fetchMolitApartmentTradePages({
  serviceKey,
  lawdCd,
  dealYmd,
  numOfRows = 1000,
}: FetchMolitApartmentTradesParams): Promise<MolitApartmentTradePage[]> {
  const pages: MolitApartmentTradePage[] = [];
  let pageNo = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while ((pageNo - 1) * numOfRows < totalCount && pageNo <= 10) {
    const rawXml = await fetchMolitApartmentTradeXml({
      serviceKey,
      lawdCd,
      dealYmd,
      pageNo,
      numOfRows,
    });
    const parsed = parseMolitApartmentTradeXml(rawXml);

    totalCount = parsed.totalCount;
    pages.push({ ...parsed, pageNo, rawXml });
    pageNo += 1;
  }

  return pages;
}

export async function fetchMolitApartmentTradeXml({
  serviceKey,
  lawdCd,
  dealYmd,
  pageNo,
  numOfRows,
}: FetchMolitApartmentTradesParams & { pageNo: number; numOfRows: number }) {
  const response = await fetchWithTimeout(
    buildMolitApartmentTradeUrl({
      serviceKey,
      lawdCd,
      dealYmd,
      pageNo,
      numOfRows,
    }),
    undefined,
    { label: "MOLIT apartment trade API" },
  );

  if (!response.ok) {
    throwMolitHttpError(response.status, await response.text());
  }

  return response.text();
}

export function buildMolitApartmentTradeUrl({
  serviceKey,
  lawdCd,
  dealYmd,
  pageNo,
  numOfRows,
}: FetchMolitApartmentTradesParams & { pageNo: number; numOfRows: number }) {
  const params = new URLSearchParams({
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
  });
  const trimmedServiceKey = serviceKey.trim();
  const serviceKeyParam = looksUrlEncoded(trimmedServiceKey)
    ? trimmedServiceKey
    : encodeURIComponent(trimmedServiceKey);

  return `${MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT}?serviceKey=${serviceKeyParam}&${params.toString()}`;
}

function looksUrlEncoded(value: string) {
  return /%[0-9a-f]{2}/i.test(value);
}

function throwMolitHttpError(status: number, body: string): never {
  try {
    parseMolitApartmentTradeXml(body);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("MOLIT API error")) {
      throw error;
    }
  }

  const preview = getBodyPreview(body);
  throw new Error(
    preview
      ? `MOLIT API request failed with ${status}: ${preview}`
      : `MOLIT API request failed with ${status}`,
  );
}

function getBodyPreview(body: string) {
  const preview = body.replace(/\s+/g, " ").trim();
  return preview.length > 160 ? `${preview.slice(0, 160)}...` : preview;
}

export function normalizeApartmentNameForMolit(value: string | null | undefined) {
  return (
    cleanText(value)
      ?.replace(/\s+/g, "")
      .replace(/[()[\]{}._\-·ㆍ]/g, "")
      .toLowerCase() ?? ""
  );
}

export function getMolitApartmentNameVariants(
  value: string | null | undefined,
) {
  const rawText = cleanText(value);

  if (!rawText) {
    return [];
  }

  const variants = new Set<string>();
  const normalized = normalizeApartmentNameForMolit(rawText);

  addNameVariant(variants, normalized);

  const withoutParenthetical = rawText
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "");

  addNameVariant(variants, normalizeApartmentNameForMolit(withoutParenthetical));

  for (const variant of Array.from(variants)) {
    for (const suffix of ["아파트", "apt", "타운"]) {
      addNameVariant(variants, stripNameSuffix(variant, suffix));
    }
  }

  return Array.from(variants);
}

export function isMolitApartmentNameMatch(
  sourceName: string | null | undefined,
  targetNames: string[],
) {
  const source = normalizeApartmentNameForMolit(sourceName);

  if (!source) {
    return false;
  }

  return targetNames.some((targetName) => {
    const target = normalizeApartmentNameForMolit(targetName);

    return target ? isNameVariantMatch(source, target) : false;
  });
}

export function isMolitApartmentNameCandidate(
  sourceName: string | null | undefined,
  targetNames: string[],
) {
  const sourceVariants = getMolitApartmentNameVariants(sourceName);

  if (sourceVariants.length === 0) {
    return false;
  }

  return targetNames.some((targetName) => {
    const targetVariants = getMolitApartmentNameVariants(targetName);

    return sourceVariants.some((source) =>
      targetVariants.some((target) => isNameVariantMatch(source, target)),
    );
  });
}

function isNameVariantMatch(source: string, target: string) {
  if (source === target) {
    return true;
  }

  return (
    (isSpecificApartmentName(source) && target.includes(source)) ||
    (isSpecificApartmentName(target) && source.includes(target))
  );
}

function isSpecificApartmentName(value: string) {
  return value.length >= 4 || (value.length >= 3 && /\d/.test(value));
}

function addNameVariant(variants: Set<string>, value: string) {
  if (isSpecificApartmentName(value)) {
    variants.add(value);
  }
}

function stripNameSuffix(value: string, suffix: string) {
  if (!value.endsWith(suffix)) {
    return value;
  }

  return value.slice(0, -suffix.length);
}

function normalizeMolitTradeRecord(record: MolitXmlRecord): MolitApartmentTrade {
  const dealYear = requiredInteger(readFirst(record, ["dealYear", "년"]));
  const dealMonth = requiredInteger(readFirst(record, ["dealMonth", "월"]));
  const dealDay = requiredInteger(readFirst(record, ["dealDay", "일"]));
  const dealAmountManwon = requiredInteger(
    readFirst(record, ["dealAmount", "거래금액"]),
  );
  const umdName = cleanText(readFirst(record, ["umdNm", "법정동"]));
  const jibun = cleanText(readFirst(record, ["jibun", "지번"]));
  const roadName = cleanText(readFirst(record, ["roadNm", "도로명"]));
  const roadMain = parseInteger(
    readFirst(record, ["roadNmBonbun", "도로명건물본번호코드"]),
  );
  const roadSub = parseInteger(
    readFirst(record, ["roadNmBubun", "도로명건물부번호코드"]),
  );
  const roadBuildingNumber =
    roadMain === null
      ? null
      : roadSub && roadSub > 0
        ? `${roadMain}-${roadSub}`
        : String(roadMain);
  const trade: MolitApartmentTrade = {
    dealYear,
    dealMonth,
    dealDay,
    dealDate: toDateString(dealYear, dealMonth, dealDay),
    exclusiveAreaM2: requiredNumber(readFirst(record, ["excluUseAr", "전용면적"])),
    floor: parseInteger(readFirst(record, ["floor", "층"])),
    dealAmountManwon,
    dealAmountKrw: dealAmountManwon * 10_000,
    apartmentNameFromSource: cleanText(readFirst(record, ["aptNm", "아파트"])),
    addressFromSource: [umdName, jibun].filter(Boolean).join(" ") || null,
    cancelYn: cleanText(readFirst(record, ["cdealType", "해제여부"])),
    cancelDate: parseCompactDate(readFirst(record, ["cdealDay", "해제사유발생일"])),
  };

  setOptional(trade, "lotNumberFromSource", jibun);
  setOptional(
    trade,
    "roadAddressFromSource",
    [roadName, roadBuildingNumber].filter(Boolean).join(" ") || null,
  );
  setOptional(trade, "aptSeq", cleanText(readFirst(record, ["aptSeq"])));
  setOptional(trade, "aptDong", cleanText(readFirst(record, ["aptDong"])));
  setOptional(trade, "sggCd", cleanText(readFirst(record, ["sggCd"])));
  setOptional(trade, "umdCd", cleanText(readFirst(record, ["umdCd"])));
  setOptional(trade, "buildYear", parseInteger(readFirst(record, ["buildYear"])));
  setOptional(trade, "dealingGbn", cleanText(readFirst(record, ["dealingGbn"])));
  setOptional(trade, "rgstDate", parseCompactDate(readFirst(record, ["rgstDate"])));

  return trade;
}

function setOptional<K extends keyof MolitApartmentTrade>(
  trade: MolitApartmentTrade,
  key: K,
  value: MolitApartmentTrade[K] | null,
) {
  if (value !== null) {
    trade[key] = value;
  }
}

function readFirst(record: MolitXmlRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  return null;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseInteger(value: unknown) {
  const text = cleanText(value)?.replace(/,/g, "");

  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : null;
}

function requiredInteger(value: unknown) {
  const parsed = parseInteger(value);

  if (parsed === null) {
    throw new Error("MOLIT transaction integer field is missing or invalid.");
  }

  return parsed;
}

function requiredNumber(value: unknown) {
  const text = cleanText(value)?.replace(/,/g, "");
  const parsed = text ? Number(text) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new Error("MOLIT transaction numeric field is missing or invalid.");
  }

  return parsed;
}

function toDateString(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
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
