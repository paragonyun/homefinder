import { createHash } from "node:crypto";
import type {
  KaptApartmentListFetchResult,
  KaptApartmentListItem,
} from "../data-providers/kapt-apartment-list";
import type {
  KaptCodeResolution,
  ScoredKaptCodeCandidate,
} from "./kapt-code-resolver";

export const KAPT_LIST_SOURCE_NAME = "kapt-apartment-list";
export const KAPT_DIRECTORY_SOURCE_NAME = "kapt-code-directory";
export const KAPT_DIRECTORY_ENDPOINT = "supabase:kapt_code_directory";

export type KaptListResult = KaptApartmentListFetchResult & {
  source: string;
};

export function mergeKaptListResults(results: KaptListResult[]): KaptListResult {
  const items = dedupeKaptItems(results.flatMap((result) => result.items));

  return {
    endpoint: results.map((result) => result.endpoint).join(","),
    source: results.map((result) => result.source).join(","),
    totalCount: items.length,
    items,
  };
}

export function dedupeKaptItems(items: KaptApartmentListItem[]) {
  const byCode = new Map<string, KaptApartmentListItem>();

  for (const item of items) {
    const existing = byCode.get(item.kaptCode);

    byCode.set(item.kaptCode, {
      ...existing,
      ...item,
      bjdCode: item.bjdCode ?? existing?.bjdCode ?? null,
      sido: item.sido ?? existing?.sido ?? null,
      sigungu: item.sigungu ?? existing?.sigungu ?? null,
      eupmyeondong: item.eupmyeondong ?? existing?.eupmyeondong ?? null,
      ri: item.ri ?? existing?.ri ?? null,
      legalAddress: item.legalAddress ?? existing?.legalAddress ?? null,
      roadAddress: item.roadAddress ?? existing?.roadAddress ?? null,
    });
  }

  return Array.from(byCode.values());
}

export function toPublicKaptCandidate(candidate: ScoredKaptCodeCandidate) {
  return {
    kaptCode: candidate.kaptCode,
    kaptName: candidate.kaptName,
    bjdCode: candidate.bjdCode,
    sido: candidate.sido,
    sigungu: candidate.sigungu,
    eupmyeondong: candidate.eupmyeondong,
    ri: candidate.ri,
    legalAddress: candidate.legalAddress ?? null,
    roadAddress: candidate.roadAddress ?? null,
    score: candidate.score,
    reasons: candidate.reasons,
  };
}

export function buildKaptResolveRawResponsePayload({
  apartmentId,
  externalErrorMessage,
  lawdCd,
  listResult,
  resolution,
  userId,
}: {
  apartmentId: string;
  userId: string;
  lawdCd: string;
  listResult: KaptListResult;
  resolution: KaptCodeResolution;
  externalErrorMessage: string | null;
}) {
  const requestFingerprint = {
    apartmentId,
    lawdCd,
    source: listResult.source,
  };

  return {
    provider: "kapt",
    endpoint: listResult.endpoint,
    request_hash: hashText(JSON.stringify(requestFingerprint)),
    request_params: requestFingerprint,
    response_body: {
      totalCount: listResult.totalCount,
      status: resolution.status,
      selected: resolution.selected
        ? toPublicKaptCandidate(resolution.selected)
        : null,
      candidates: resolution.candidates.map(toPublicKaptCandidate),
      reason: resolution.reason,
      externalErrorMessage,
    },
    apartment_id: apartmentId,
    user_id: userId,
  };
}

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
