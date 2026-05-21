import type { KaptApartmentListItem } from "../data-providers/kapt-apartment-list";
import { normalizeApartmentNameForMolit } from "../data-providers/molit-transactions";

export type KaptCodeDirectoryRow = {
  kapt_code: string;
  kapt_name: string;
  normalized_kapt_name: string;
  bjd_code: string | null;
  sido: string | null;
  sigungu: string | null;
  eupmyeondong: string | null;
  ri: string | null;
  legal_address: string | null;
  road_address: string | null;
  source: string;
  source_endpoint: string | null;
  last_synced_at?: string;
};

export function normalizeKaptDirectoryName(value: string | null | undefined) {
  return normalizeApartmentNameForMolit(value);
}

export function toKaptDirectoryUpsertRows({
  items,
  source,
  endpoint,
}: {
  items: KaptApartmentListItem[];
  source: string;
  endpoint: string | null;
}): KaptCodeDirectoryRow[] {
  const seen = new Set<string>();

  return items.flatMap((item) => {
    if (seen.has(item.kaptCode)) {
      return [];
    }

    seen.add(item.kaptCode);

    return {
      kapt_code: item.kaptCode,
      kapt_name: item.kaptName,
      normalized_kapt_name: normalizeKaptDirectoryName(item.kaptName),
      bjd_code: item.bjdCode,
      sido: item.sido,
      sigungu: item.sigungu,
      eupmyeondong: item.eupmyeondong,
      ri: item.ri,
      legal_address: item.legalAddress ?? null,
      road_address: item.roadAddress ?? null,
      source,
      source_endpoint: endpoint,
    };
  });
}

export function kaptDirectoryRowsToListItems(
  rows: KaptCodeDirectoryRow[],
): KaptApartmentListItem[] {
  return rows.map((row) => ({
    kaptCode: row.kapt_code,
    kaptName: row.kapt_name,
    bjdCode: row.bjd_code,
    sido: row.sido,
    sigungu: row.sigungu,
    eupmyeondong: row.eupmyeondong,
    ri: row.ri,
    legalAddress: row.legal_address,
    roadAddress: row.road_address,
  }));
}
