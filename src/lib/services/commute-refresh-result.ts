import { formatDate } from "../../utils/date";

type CommuteRefreshError = {
  destinationKey: string;
  transportType: string;
  error: string;
};

export type CommuteRefreshResult = {
  cached?: boolean;
  error?: string;
  reusedCount?: number;
  savedCount?: number;
  errors?: CommuteRefreshError[];
  searchDttm?: string;
  expiresAt?: string;
};

export function formatCommuteRefreshMessage(result: CommuteRefreshResult) {
  if (result.cached) {
    const reusedCount = result.reusedCount ?? 0;
    const expireMessage = result.expiresAt
      ? `자동 조회값은 ${formatDate(result.expiresAt)}까지 표시됩니다.`
      : "자동 조회값은 24시간 동안 표시됩니다.";

    return `저장된 접근성 ${reusedCount}건을 재사용했습니다. ${expireMessage}`;
  }

  const savedCount = result.savedCount ?? 0;
  const failedCount = result.errors?.length ?? 0;
  const baseMessage = `접근성 ${savedCount}건을 TMAP 기준으로 조회했습니다.`;
  const expireMessage = result.expiresAt
    ? `자동 조회값은 ${formatDate(result.expiresAt)}까지 표시됩니다.`
    : "자동 조회값은 24시간 동안 표시됩니다.";

  if (failedCount === 0) {
    return `${baseMessage} ${expireMessage}`;
  }

  const failureSummary = formatCommuteFailureSummary(result.errors ?? []);

  return failureSummary
    ? `${baseMessage} 일부 실패 ${failedCount}건: ${failureSummary}. ${expireMessage}`
    : `${baseMessage} 일부 실패 ${failedCount}건이 있습니다. ${expireMessage}`;
}

function formatCommuteFailureSummary(errors: CommuteRefreshError[]) {
  return errors
    .slice(0, 4)
    .map(
      (error) =>
        `${formatDestinationKey(error.destinationKey)} ${formatTransportType(
          error.transportType,
        )} - ${formatCommuteError(error.error)}`,
    )
    .join(" / ");
}

function formatDestinationKey(value: string) {
  if (value === "yeouido_station") {
    return "여의도역";
  }

  if (value === "gangnam_station") {
    return "강남역";
  }

  return value;
}

function formatTransportType(value: string) {
  if (value === "transit") {
    return "대중교통";
  }

  if (value === "driving") {
    return "자동차";
  }

  return value;
}

function formatCommuteError(error: string) {
  if (
    /401|403|Forbidden|Unauthorized|INVALID_API_KEY|API[_ ]?KEY/i.test(error)
  ) {
    return "API 키 권한 확인 필요";
  }

  if (
    /API error (11|12|13|14)|검색 결과가 없음|경로를 찾지 못했습니다|탐색된.*없음/.test(
      error,
    )
  ) {
    return "경로 검색 결과 없음";
  }

  if (/429|quota|limit|exceed|한도|초과/i.test(error)) {
    return "호출 한도 초과 가능";
  }

  return error;
}
