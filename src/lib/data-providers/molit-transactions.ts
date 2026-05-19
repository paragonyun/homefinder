import { XMLParser } from "fast-xml-parser";

export const MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

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
  cancelYn: string | null;
  cancelDate: string | null;
  aptSeq?: string | null;
  aptDong?: string | null;
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

const DEFAULT_RECENT_MONTH_COUNT = 24;
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
  const url = new URL(MOLIT_APARTMENT_TRADE_DETAIL_ENDPOINT);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("LAWD_CD", lawdCd);
  url.searchParams.set("DEAL_YMD", dealYmd);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`MOLIT API request failed with ${response.status}`);
  }

  return response.text();
}

export function normalizeApartmentNameForMolit(value: string | null | undefined) {
  return cleanText(value)?.replace(/\s+/g, "").toLowerCase() ?? "";
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

  setOptional(trade, "aptSeq", cleanText(readFirst(record, ["aptSeq"])));
  setOptional(trade, "aptDong", cleanText(readFirst(record, ["aptDong"])));
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
