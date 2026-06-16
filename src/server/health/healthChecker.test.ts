// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthRecord } from "../../shared/schema.js";
import { checkLinkHealth } from "./healthChecker.js";

const checkedAt = "2026-06-16T08:00:00.000Z";

function previousRecord(status: HealthRecord["status"], failureCount: number): HealthRecord {
  return {
    linkId: "link-1",
    status,
    checkedAt: "2026-06-16T07:00:00.000Z",
    responseMs: 120,
    error: "",
    failureCount
  };
}

function response(status: number): Response {
  return new Response(null, { status });
}

describe("checkLinkHealth", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns normal for a 200 HEAD response", async () => {
    fetchMock.mockResolvedValueOnce(response(200));

    const record = await checkLinkHealth("link-1", "https://example.com", {
      now: () => new Date(checkedAt),
      previousRecord: previousRecord("down", 3),
      timeoutMs: 1000
    });

    expect(record).toMatchObject({
      linkId: "link-1",
      status: "normal",
      checkedAt,
      error: "",
      failureCount: 0
    });
    expect(record.responseMs).toEqual(expect.any(Number));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        method: "HEAD",
        credentials: "omit",
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("returns down and increments failureCount when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("getaddrinfo ENOTFOUND example.com"));

    const record = await checkLinkHealth("link-1", "https://example.com", {
      now: () => new Date(checkedAt),
      previousRecord: previousRecord("down", 2),
      timeoutMs: 1000
    });

    expect(record).toMatchObject({
      status: "down",
      error: "getaddrinfo ENOTFOUND example.com",
      failureCount: 3
    });
    expect(record.responseMs).toEqual(expect.any(Number));
  });

  it("falls back to GET when HEAD is blocked by method restrictions", async () => {
    fetchMock.mockResolvedValueOnce(response(405));
    fetchMock.mockResolvedValueOnce(response(204));

    const record = await checkLinkHealth("link-1", "https://example.com", {
      now: () => new Date(checkedAt),
      previousRecord: previousRecord("degraded", 1),
      timeoutMs: 1000
    });

    expect(record.status).toBe("normal");
    expect(record.failureCount).toBe(0);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com",
      expect.objectContaining({ method: "HEAD", credentials: "omit" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com",
      expect.objectContaining({ method: "GET", credentials: "omit" })
    );
  });

  it.each([403, 501])("falls back to GET when HEAD returns HTTP %s", async (status) => {
    fetchMock.mockResolvedValueOnce(response(status));
    fetchMock.mockResolvedValueOnce(response(200));

    const record = await checkLinkHealth("link-1", "https://example.com", {
      now: () => new Date(checkedAt),
      timeoutMs: 1000
    });

    expect(record.status).toBe("normal");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com",
      expect.objectContaining({ method: "GET", credentials: "omit" })
    );
  });

  it("returns degraded for a 500 HTTP response", async () => {
    fetchMock.mockResolvedValueOnce(response(500));

    const record = await checkLinkHealth("link-1", "https://example.com", {
      now: () => new Date(checkedAt),
      previousRecord: previousRecord("normal", 0),
      timeoutMs: 1000
    });

    expect(record).toMatchObject({
      status: "degraded",
      error: "HTTP 500",
      failureCount: 1
    });
  });

  it("returns down when the check times out", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const pending = checkLinkHealth("link-1", "https://example.com", {
      now: () => new Date(checkedAt),
      previousRecord: previousRecord("degraded", 4),
      timeoutMs: 25
    });

    await vi.advanceTimersByTimeAsync(25);
    const record = await pending;

    expect(record).toMatchObject({
      status: "down",
      error: "检查超时。",
      failureCount: 5
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
