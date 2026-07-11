const LOGIN_NETWORK_ERROR_MESSAGE =
  "Supabase Auth 서버에 연결할 수 없습니다. NEXT_PUBLIC_SUPABASE_URL이 살아 있는 프로젝트 URL인지 확인하고 개발 서버를 다시 시작하세요.";

const DEFAULT_LOGIN_ERROR_MESSAGE = "로그인에 실패했습니다.";

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /load failed/i,
  /networkerror/i,
];

export function formatLoginErrorMessage(error: unknown) {
  const message = extractErrorMessage(error);

  if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return LOGIN_NETWORK_ERROR_MESSAGE;
  }

  return message || DEFAULT_LOGIN_ERROR_MESSAGE;
}

function extractErrorMessage(error: unknown) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };
    return typeof message === "string" ? message : "";
  }

  return "";
}
