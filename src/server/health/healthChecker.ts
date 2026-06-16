import type { HealthRecord, HealthStatus } from "../../shared/schema.js";

const DEFAULT_TIMEOUT_MS = 8000;
const METHOD_RESTRICTION_STATUS_CODES = new Set([403, 405, 501]);

export type CheckLinkHealthOptions = {
  timeoutMs?: number;
  previousRecord?: HealthRecord | null;
  now?: () => Date;
  fetchImpl?: typeof fetch;
};

type ProbeResult =
  | {
      kind: "response";
      statusCode: number;
    }
  | {
      kind: "network-error";
      error: string;
    };

export async function checkLinkHealth(
  linkId: string,
  url: string,
  options: CheckLinkHealthOptions = {}
): Promise<HealthRecord> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();

  const headResult = await probeUrl(fetchImpl, url, "HEAD", timeoutMs);
  const result = shouldRetryWithGet(headResult)
    ? await probeUrl(fetchImpl, url, "GET", timeoutMs)
    : headResult;
  const { status, error } = classifyProbeResult(result);

  return {
    linkId,
    status,
    checkedAt,
    responseMs: Math.max(0, Date.now() - startedAt),
    error,
    failureCount: nextFailureCount(status, options.previousRecord)
  };
}

async function probeUrl(
  fetchImpl: typeof fetch,
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number
): Promise<ProbeResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method,
      credentials: "omit",
      signal: controller.signal
    });

    return {
      kind: "response",
      statusCode: response.status
    };
  } catch (error) {
    return {
      kind: "network-error",
      error: timedOut || isAbortError(error) ? "检查超时。" : formatFetchError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryWithGet(result: ProbeResult): boolean {
  if (result.kind === "response") {
    return METHOD_RESTRICTION_STATUS_CODES.has(result.statusCode);
  }

  return /head|method|405|not allowed/i.test(result.error);
}

function classifyProbeResult(result: ProbeResult): Pick<HealthRecord, "status" | "error"> {
  if (result.kind === "network-error") {
    return {
      status: "down",
      error: result.error
    };
  }

  if (result.statusCode >= 200 && result.statusCode <= 399) {
    return {
      status: "normal",
      error: ""
    };
  }

  return {
    status: "degraded",
    error: `HTTP ${result.statusCode}`
  };
}

function nextFailureCount(status: HealthStatus, previousRecord: HealthRecord | null | undefined): number {
  if (status === "normal") {
    return 0;
  }

  return (previousRecord?.failureCount ?? 0) + 1;
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "无法连接到链接。";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
