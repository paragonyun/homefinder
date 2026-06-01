import type { BuildingRegisterQuery } from "../data-providers/building-register";

export type BuildingRegisterAddressHint = {
  value: string | null | undefined;
  source: string;
};

export type BuildingRegisterBjdCodeHint = {
  value: string | null | undefined;
  source: string;
};

export type BuildingRegisterLotAddress = {
  platGbCd: "0" | "1";
  bun: string;
  ji: string;
  matchedAddress: string;
};

export type BuildingRegisterQueryResolution =
  | {
      ok: true;
      query: BuildingRegisterQuery;
      addressSource: string;
      matchedAddress: string;
      bjdCodeSource: string;
    }
  | {
      ok: false;
      error: string;
    };

export function resolveBuildingRegisterQuery({
  addresses,
  bjdCodes,
  lawdCd,
}: {
  addresses: BuildingRegisterAddressHint[];
  bjdCodes: BuildingRegisterBjdCodeHint[];
  lawdCd: string | null | undefined;
}): BuildingRegisterQueryResolution {
  const bjdCode = resolveBjdCode(lawdCd, bjdCodes);

  if (!bjdCode) {
    return {
      ok: false,
      error: "건축물대장 조회에는 10자리 법정동코드가 필요합니다.",
    };
  }

  for (const address of addresses) {
    const lot = parseBuildingRegisterLotAddress(address.value);

    if (!lot) {
      continue;
    }

    return {
      ok: true,
      query: {
        sigunguCd: bjdCode.value.slice(0, 5),
        bjdongCd: bjdCode.value.slice(5),
        platGbCd: lot.platGbCd,
        bun: lot.bun,
        ji: lot.ji,
      },
      addressSource: address.source,
      matchedAddress: lot.matchedAddress,
      bjdCodeSource: bjdCode.source,
    };
  }

  return {
    ok: false,
    error: "건축물대장 조회에 필요한 지번 주소를 찾지 못했습니다.",
  };
}

export function parseBuildingRegisterLotAddress(
  value: string | null | undefined,
): BuildingRegisterLotAddress | null {
  const address = cleanText(value);

  if (!address) {
    return null;
  }

  const match = address.match(
    /(?:^|\s|,)([가-힣0-9]+(?:동|읍|면|리))\s*(산\s*)?(\d{1,4})(?:-(\d{1,4}))?/,
  );

  if (!match) {
    return null;
  }

  return {
    platGbCd: match[2] ? "1" : "0",
    bun: match[3].padStart(4, "0"),
    ji: (match[4] ?? "0").padStart(4, "0"),
    matchedAddress: address,
  };
}

function resolveBjdCode(
  lawdCd: string | null | undefined,
  bjdCodes: BuildingRegisterBjdCodeHint[],
) {
  const cleanedLawdCd = cleanCode(lawdCd);

  if (cleanedLawdCd && /^\d{10}$/.test(cleanedLawdCd)) {
    return { value: cleanedLawdCd, source: "apartments.lawd_cd" };
  }

  const prefix =
    cleanedLawdCd && /^\d{5}$/.test(cleanedLawdCd) ? cleanedLawdCd : null;

  for (const hint of bjdCodes) {
    const value = cleanCode(hint.value);

    if (!value || !/^\d{10}$/.test(value)) {
      continue;
    }

    if (!prefix || value.startsWith(prefix)) {
      return { value, source: hint.source };
    }
  }

  return null;
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text && text.length > 0 ? text : null;
}

function cleanCode(value: string | null | undefined) {
  return cleanText(value)?.replace(/\D/g, "") ?? null;
}
