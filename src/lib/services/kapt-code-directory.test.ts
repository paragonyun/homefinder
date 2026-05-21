import { describe, expect, it } from "vitest";
import {
  kaptDirectoryRowsToListItems,
  toKaptDirectoryUpsertRows,
} from "./kapt-code-directory";

describe("kapt-code-directory", () => {
  it("deduplicates fetched K-apt items for directory upsert", () => {
    const rows = toKaptDirectoryUpsertRows({
      source: "kapt-apartment-list-sigungu",
      endpoint: "endpoint",
      items: [
        {
          kaptCode: "A11560132",
          kaptName: "Boramae Honorsville",
          bjdCode: "1156013200",
          sido: "Seoul",
          sigungu: "Yeongdeungpo-gu",
          eupmyeondong: "Singil-dong",
          ri: null,
          legalAddress: "Seoul Yeongdeungpo-gu Singil-dong Boramae Honorsville",
          roadAddress: "Seoul Yeouidaebang-ro 25",
        },
        {
          kaptCode: "A11560132",
          kaptName: "Boramae Honorsville",
          bjdCode: "1156013200",
          sido: "Seoul",
          sigungu: "Yeongdeungpo-gu",
          eupmyeondong: "Singil-dong",
          ri: null,
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kapt_code: "A11560132",
      kapt_name: "Boramae Honorsville",
      normalized_kapt_name: "boramaehonorsville",
      bjd_code: "1156013200",
      road_address: "Seoul Yeouidaebang-ro 25",
    });
  });

  it("maps directory rows back to resolver candidate items", () => {
    const items = kaptDirectoryRowsToListItems([
      {
        kapt_code: "A11500101",
        kapt_name: "Dong-A 3",
        normalized_kapt_name: "donga3",
        bjd_code: "1150010100",
        sido: "Seoul",
        sigungu: "Gangseo-gu",
        eupmyeondong: "Yeomchang-dong",
        ri: null,
        legal_address: "Seoul Gangseo-gu Yeomchang-dong Dong-A 3",
        road_address: "Seoul Yangcheon-ro 731",
        source: "AptListService3",
        source_endpoint: "endpoint",
      },
    ]);

    expect(items[0]).toEqual({
      kaptCode: "A11500101",
      kaptName: "Dong-A 3",
      bjdCode: "1150010100",
      sido: "Seoul",
      sigungu: "Gangseo-gu",
      eupmyeondong: "Yeomchang-dong",
      ri: null,
      legalAddress: "Seoul Gangseo-gu Yeomchang-dong Dong-A 3",
      roadAddress: "Seoul Yangcheon-ro 731",
    });
  });
});
