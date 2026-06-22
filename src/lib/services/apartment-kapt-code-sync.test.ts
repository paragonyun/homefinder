import { describe, expect, it } from "vitest";
import type { KaptApartmentListItem } from "../data-providers/kapt-apartment-list";
import type {
  KaptCodeResolution,
  ScoredKaptCodeCandidate,
} from "./kapt-code-resolver";
import {
  buildKaptResolveRawResponsePayload,
  dedupeKaptItems,
  mergeKaptListResults,
  toPublicKaptCandidate,
  type KaptListResult,
} from "./apartment-kapt-code-sync";

const baseItem: KaptApartmentListItem = {
  kaptCode: "A10000001",
  kaptName: "Alpha Heights",
  bjdCode: "1159010200",
  sido: "Seoul",
  sigungu: "Dongjak",
  eupmyeondong: "Sangdo",
  ri: null,
  legalAddress: "Sangdo-dong 414",
  roadAddress: null,
};

const scoredCandidate: ScoredKaptCodeCandidate = {
  ...baseItem,
  score: 91,
  reasons: ["name match", "lawd match"],
};

describe("dedupeKaptItems", () => {
  it("merges duplicate K-apt items by kaptCode while preserving non-null fields", () => {
    expect(
      dedupeKaptItems([
        {
          ...baseItem,
          legalAddress: null,
          roadAddress: "Sangdo-ro 100",
        },
        {
          ...baseItem,
          kaptName: "Alpha Heights Updated",
          bjdCode: null,
          legalAddress: "Sangdo-dong 414",
          roadAddress: null,
        },
      ]),
    ).toEqual([
      {
        ...baseItem,
        kaptName: "Alpha Heights Updated",
        bjdCode: "1159010200",
        legalAddress: "Sangdo-dong 414",
        roadAddress: "Sangdo-ro 100",
      },
    ]);
  });
});

describe("mergeKaptListResults", () => {
  it("combines endpoints and sources and reports the deduped item count", () => {
    const directoryResult: KaptListResult = {
      endpoint: "supabase:kapt_code_directory",
      source: "kapt-code-directory",
      totalCount: 2,
      items: [baseItem],
    };
    const apiResult: KaptListResult = {
      endpoint: "api:legal-dong",
      source: "kapt-apartment-list-legal-dong",
      totalCount: 1,
      items: [
        {
          ...baseItem,
          roadAddress: "Sangdo-ro 100",
        },
      ],
    };

    expect(mergeKaptListResults([directoryResult, apiResult])).toEqual({
      endpoint: "supabase:kapt_code_directory,api:legal-dong",
      source: "kapt-code-directory,kapt-apartment-list-legal-dong",
      totalCount: 1,
      items: [{ ...baseItem, roadAddress: "Sangdo-ro 100" }],
    });
  });
});

describe("toPublicKaptCandidate", () => {
  it("keeps only the fields returned to the UI", () => {
    expect(toPublicKaptCandidate(scoredCandidate)).toEqual({
      kaptCode: "A10000001",
      kaptName: "Alpha Heights",
      bjdCode: "1159010200",
      sido: "Seoul",
      sigungu: "Dongjak",
      eupmyeondong: "Sangdo",
      ri: null,
      legalAddress: "Sangdo-dong 414",
      roadAddress: null,
      score: 91,
      reasons: ["name match", "lawd match"],
    });
  });
});

describe("buildKaptResolveRawResponsePayload", () => {
  it("preserves the route raw log shape with public candidate values", () => {
    const listResult: KaptListResult = {
      endpoint: "supabase:kapt_code_directory",
      source: "kapt-code-directory",
      totalCount: 1,
      items: [baseItem],
    };
    const resolution: KaptCodeResolution = {
      status: "needs_selection",
      selected: null,
      candidates: [scoredCandidate],
      reason: "manual selection required",
    };

    const payload = buildKaptResolveRawResponsePayload({
      apartmentId: "apt-id",
      userId: "user-id",
      lawdCd: "1159010200",
      listResult,
      resolution,
      externalErrorMessage: "api unavailable",
    });

    expect(payload).toMatchObject({
      provider: "kapt",
      endpoint: "supabase:kapt_code_directory",
      request_params: {
        apartmentId: "apt-id",
        lawdCd: "1159010200",
        source: "kapt-code-directory",
      },
      response_body: {
        totalCount: 1,
        status: "needs_selection",
        selected: null,
        candidates: [toPublicKaptCandidate(scoredCandidate)],
        reason: "manual selection required",
        externalErrorMessage: "api unavailable",
      },
      apartment_id: "apt-id",
      user_id: "user-id",
    });
    expect(payload.request_hash).toHaveLength(64);
  });
});
