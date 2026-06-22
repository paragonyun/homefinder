export const DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS = 15_000;

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  {
    fetcher = fetch,
    label = "External API",
    timeoutMs = DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS,
  }: {
    fetcher?: Fetcher;
    label?: string;
    timeoutMs?: number;
  } = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} request timed out after ${timeoutMs}ms`, {
        cause: error,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
