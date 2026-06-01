export const NEIS_SCHOOL_INFO_ENDPOINT =
  "https://open.neis.go.kr/hub/schoolInfo";

export type SchoolType = "elementary" | "middle" | "high" | "unknown";

export type NeisSchool = {
  officeCode: string | null;
  officeName: string | null;
  schoolCode: string;
  schoolName: string;
  schoolType: SchoolType;
  schoolKindName: string | null;
  regionName: string | null;
  districtOfficeName: string | null;
  address: string | null;
  roadAddress: string | null;
  homepageUrl: string | null;
  phone: string | null;
  coeducationType: string | null;
  foundedDate: string | null;
};

export type NeisSchoolInfoParseResult = {
  totalCount: number;
  schools: NeisSchool[];
};

export type FetchNeisSchoolInfoParams = {
  apiKey: string;
  regionName?: string | null;
  schoolKindName?: string | null;
  schoolName?: string | null;
  pageIndex?: number;
  pageSize?: number;
};

type NeisSchoolRecord = Record<string, unknown>;

export async function fetchNeisSchoolInfoPages({
  apiKey,
  regionName,
  schoolKindName,
  pageSize = 1000,
}: FetchNeisSchoolInfoParams) {
  const schools: NeisSchool[] = [];
  const pages: unknown[] = [];
  let pageIndex = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while ((pageIndex - 1) * pageSize < totalCount && pageIndex <= 10) {
    const response = await fetch(
      buildNeisSchoolInfoUrl({
        apiKey,
        regionName,
        schoolKindName,
        pageIndex,
        pageSize,
      }),
    );
    const body = await response.text();

    if (!response.ok) {
      throwNeisHttpError(response.status, body);
    }

    const rawPage = JSON.parse(body) as unknown;
    const parsed = parseNeisSchoolInfoResponse(rawPage);

    totalCount = parsed.totalCount;
    pages.push(rawPage);
    schools.push(...parsed.schools);
    pageIndex += 1;
  }

  return {
    totalCount: Number.isFinite(totalCount) ? totalCount : schools.length,
    pages,
    schools,
  };
}

export function buildNeisSchoolInfoUrl({
  apiKey,
  regionName,
  schoolKindName,
  schoolName,
  pageIndex = 1,
  pageSize = 1000,
}: FetchNeisSchoolInfoParams) {
  const params = new URLSearchParams({
    KEY: apiKey,
    Type: "json",
    pIndex: String(pageIndex),
    pSize: String(pageSize),
  });

  if (regionName) {
    params.set("LCTN_SC_NM", regionName);
  }

  if (schoolKindName) {
    params.set("SCHUL_KND_SC_NM", schoolKindName);
  }

  if (schoolName) {
    params.set("SCHUL_NM", schoolName);
  }

  return `${NEIS_SCHOOL_INFO_ENDPOINT}?${params.toString()}`;
}

export function parseNeisSchoolInfoResponse(
  response: unknown,
): NeisSchoolInfoParseResult {
  const parsed = response as {
    RESULT?: { CODE?: unknown; MESSAGE?: unknown };
    schoolInfo?: Array<{
      head?: Array<{ list_total_count?: unknown; RESULT?: { CODE?: unknown } }>;
      row?: NeisSchoolRecord[];
    }>;
  };

  assertSuccessfulNeisResponse(parsed.RESULT);

  if (!parsed.schoolInfo) {
    return { totalCount: 0, schools: [] };
  }

  const head = parsed.schoolInfo.find((entry) => Array.isArray(entry.head))?.head;
  const resultCode = head?.find((entry) => entry.RESULT)?.RESULT?.CODE;

  if (cleanText(resultCode) && cleanText(resultCode) !== "INFO-000") {
    assertSuccessfulNeisResponse({
      CODE: resultCode,
      MESSAGE: "NEIS schoolInfo request failed.",
    });
  }

  const rows = parsed.schoolInfo.flatMap((entry) => entry.row ?? []);

  return {
    totalCount: parseInteger(
      head?.find((entry) => entry.list_total_count !== undefined)
        ?.list_total_count,
    ) ?? rows.length,
    schools: rows.map(normalizeNeisSchoolRecord).filter(isValidSchool),
  };
}

function normalizeNeisSchoolRecord(record: NeisSchoolRecord): NeisSchool {
  return {
    officeCode: cleanText(record.ATPT_OFCDC_SC_CODE),
    officeName: cleanText(record.ATPT_OFCDC_SC_NM),
    schoolCode: cleanText(record.SD_SCHUL_CODE) ?? "",
    schoolName: cleanText(record.SCHUL_NM) ?? "",
    schoolType: normalizeSchoolType(record.SCHUL_KND_SC_NM),
    schoolKindName: cleanText(record.SCHUL_KND_SC_NM),
    regionName: cleanText(record.LCTN_SC_NM),
    districtOfficeName: cleanText(record.JU_ORG_NM),
    address: cleanText(record.ORG_ADDR),
    roadAddress: joinAddress(
      cleanText(record.ORG_RDNMA),
      cleanText(record.ORG_RDNDA),
    ),
    homepageUrl: cleanText(record.HMPG_ADRES),
    phone: cleanText(record.ORG_TELNO),
    coeducationType: cleanText(record.COEDU_SC_NM),
    foundedDate: parseCompactDate(record.FOND_YMD),
  };
}

function normalizeSchoolType(value: unknown): SchoolType {
  const text = cleanText(value) ?? "";

  if (text.includes("초등")) {
    return "elementary";
  }

  if (text.includes("중학교")) {
    return "middle";
  }

  if (text.includes("고등")) {
    return "high";
  }

  return "unknown";
}

function joinAddress(main: string | null, detail: string | null) {
  return [main, detail].filter(Boolean).join(" ") || null;
}

function assertSuccessfulNeisResponse(
  result: { CODE?: unknown; MESSAGE?: unknown } | undefined,
) {
  const code = cleanText(result?.CODE);

  if (!code || code === "INFO-000") {
    return;
  }

  if (code === "INFO-200") {
    return;
  }

  throw new Error(
    `NEIS schoolInfo API error ${code}: ${
      cleanText(result?.MESSAGE) ?? "Unknown error"
    }`,
  );
}

function throwNeisHttpError(status: number, body: string): never {
  const preview = body.replace(/\s+/g, " ").trim().slice(0, 160);
  throw new Error(
    preview
      ? `NEIS schoolInfo API request failed with ${status}: ${preview}`
      : `NEIS schoolInfo API request failed with ${status}`,
  );
}

function isValidSchool(school: NeisSchool) {
  return school.schoolCode.length > 0 && school.schoolName.length > 0;
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

function parseCompactDate(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  return null;
}
