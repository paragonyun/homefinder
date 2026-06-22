import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./http";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchWithTimeout", () => {
  it("delegates to fetch and returns the response", async () => {
    const response = new Response("ok", { status: 200 });
    const fetcher = vi.fn().mockResolvedValue(response);

    await expect(
      fetchWithTimeout(
        "https://example.com/api",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        },
        { fetcher },
      ),
    ).resolves.toBe(response);

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("aborts slow requests with a labeled timeout error", async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const promise = fetchWithTimeout("https://example.com/slow", undefined, {
      fetcher,
      label: "Slow API",
      timeoutMs: 1000,
    });
    const expectation = expect(promise).rejects.toThrow(
      "Slow API request timed out after 1000ms",
    );

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
  });
});
