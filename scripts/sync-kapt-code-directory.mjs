import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

const endpoints = {
  sido: [
    "http://apis.data.go.kr/1613000/AptListService3/getSidoAptList3",
    "http://apis.data.go.kr/1611000/AptListService/getSidoAptList",
  ],
  sigungu: [
    "http://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3",
    "http://apis.data.go.kr/1611000/AptListService/getSigunguAptList",
  ],
  bjd: [
    "http://apis.data.go.kr/1613000/AptListService3/getLegaldongAptList3",
    "http://apis.data.go.kr/1611000/AptListService/getLegaldongAptList",
  ],
};

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const args = parseArgs(process.argv.slice(2));
const scope = args.bjd ? "bjd" : args.sigungu ? "sigungu" : args.sido ? "sido" : null;
const code = args.bjd ?? args.sigungu ?? args.sido ?? null;

if (!scope || !code) {
  throw new Error("Usage: node scripts/sync-kapt-code-directory.mjs --bjd 1156013200 | --sigungu 11560 | --sido 11");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceKey = process.env.KAPT_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAPT_API_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const result = await fetchKaptList({
  scope,
  code,
  serviceKey,
  numOfRows: scope === "bjd" ? 100 : 1000,
});
const rows = dedupe(result.items).map((item) => ({
  kapt_code: item.kaptCode,
  kapt_name: item.kaptName,
  normalized_kapt_name: normalizeName(item.kaptName),
  bjd_code: item.bjdCode,
  sido: item.sido,
  sigungu: item.sigungu,
  eupmyeondong: item.eupmyeondong,
  ri: item.ri,
  legal_address: item.legalAddress,
  road_address: item.roadAddress,
  source: "script:kapt-code-directory",
  source_endpoint: result.endpoint,
}));

if (rows.length > 0) {
  const { error } = await supabase
    .from("kapt_code_directory")
    .upsert(rows, { onConflict: "kapt_code" });

  if (error) {
    throw error;
  }
}

console.log(
  `Synced ${rows.length} K-apt directory rows for ${scope}=${code} from ${result.endpoint}`,
);

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 2) {
    parsed[rawArgs[index].replace(/^--/, "")] = rawArgs[index + 1];
  }

  return parsed;
}

async function fetchKaptList({ scope, code, serviceKey, numOfRows }) {
  const paramName =
    scope === "bjd" ? "bjdCode" : scope === "sigungu" ? "sigunguCode" : "sidoCode";
  let lastError = null;

  for (const endpoint of endpoints[scope]) {
    try {
      const result = await fetchPaginated({
        endpoint,
        serviceKey,
        paramName,
        code,
        numOfRows,
      });

      if (result.items.length > 0) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { endpoint: endpoints[scope][0], totalCount: 0, items: [] };
}

async function fetchPaginated({ endpoint, serviceKey, paramName, code, numOfRows }) {
  const items = [];
  let pageNo = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while ((pageNo - 1) * numOfRows < totalCount && pageNo <= 20) {
    const params = new URLSearchParams({
      [paramName]: code,
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
    });
    const key = /%[0-9a-f]{2}/i.test(serviceKey)
      ? serviceKey.trim()
      : encodeURIComponent(serviceKey.trim());
    const response = await fetch(`${endpoint}?serviceKey=${key}&${params}`);
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`${endpoint} failed with ${response.status}: ${body.slice(0, 160)}`);
    }

    const page = parseResponse(body);
    totalCount = page.totalCount;
    items.push(...page.items);
    pageNo += 1;
  }

  return {
    endpoint,
    totalCount: Number.isFinite(totalCount) ? totalCount : items.length,
    items,
  };
}

function parseResponse(body) {
  const parsed = body.trim().startsWith("<") ? parser.parse(body) : JSON.parse(body);
  const header = parsed.response?.header;
  const resultCode = cleanText(header?.resultCode);

  if (resultCode && resultCode !== "00" && resultCode !== "000") {
    throw new Error(`K-apt API error ${resultCode}: ${header?.resultMsg ?? ""}`);
  }

  const itemNode =
    parsed.response?.body?.item ?? readItemsNode(parsed.response?.body?.items);
  const records = toRecords(itemNode);
  const items = records.flatMap((record) => {
    const kaptCode = cleanText(record.kaptCode);
    const kaptName = cleanText(record.kaptName);

    if (!kaptCode || !kaptName) {
      return [];
    }

    return {
      kaptCode,
      kaptName,
      bjdCode: cleanText(record.bjdCode),
      sido: cleanText(record.as1),
      sigungu: cleanText(record.as2),
      eupmyeondong: cleanText(record.as3),
      ri: cleanText(record.as4),
      legalAddress: cleanText(record.kaptAddr),
      roadAddress: cleanText(record.doroJuso ?? record.dorojuso),
    };
  });

  return {
    totalCount: Number.parseInt(parsed.response?.body?.totalCount ?? items.length, 10),
    items,
  };
}

function readItemsNode(itemsNode) {
  if (isRecord(itemsNode) && "item" in itemsNode) {
    return itemsNode.item;
  }

  return itemsNode;
}

function toRecords(itemNode) {
  if (Array.isArray(itemNode)) {
    return itemNode.filter(isRecord);
  }

  return isRecord(itemNode) ? [itemNode] : [];
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dedupe(items) {
  return Array.from(new Map(items.map((item) => [item.kaptCode, item])).values());
}

function normalizeName(value) {
  return cleanText(value)?.replace(/\s+/g, "").replace(/[()[\]{}._-]/g, "").toLowerCase() ?? "";
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 && text.toLowerCase() !== "none" ? text : null;
}
