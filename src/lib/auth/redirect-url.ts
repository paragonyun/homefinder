const DEFAULT_AUTH_REDIRECT_PATH = "/settings";

export function getAuthCallbackUrl(origin: string, next = DEFAULT_AUTH_REDIRECT_PATH) {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", getSafeAuthRedirectPath(next));
  return callbackUrl.toString();
}

export function getSafeAuthRedirectPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return next;
}
