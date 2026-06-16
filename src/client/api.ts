import type { ExportPayload, HealthRecord, WorkbenchLink } from "../shared/schema.js";

export type LinkCreatePayload = {
  groupId: string;
  title: string;
  url: string;
  businessStatus?: WorkbenchLink["businessStatus"];
  note?: string;
  todayAction?: string;
  pinned?: boolean;
  checkIntervalMinutes?: number;
};

export type LinkUpdatePayload = Partial<Omit<WorkbenchLink, "id" | "domain">>;

export type LinkReorderPayload =
  | {
      groupId: string;
      linkIds: string[];
    }
  | {
      links: Array<{ id: string; groupId?: string }>;
    };

export type HealthSummary = {
  checked: number;
  normal: number;
  degraded: number;
  down: number;
  state: ExportPayload;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "请求失败。";
  } catch {
    return "请求失败。";
  }
}

export const api = {
  getState: () => request<ExportPayload>("/api/state"),
  createLink: (payload: LinkCreatePayload) =>
    request<{ link: WorkbenchLink; state: ExportPayload }>("/api/links", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateLink: (id: string, payload: LinkUpdatePayload) =>
    request<{ link: WorkbenchLink; state: ExportPayload }>(`/api/links/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteLink: (id: string) =>
    request<{ state: ExportPayload }>(`/api/links/${id}`, {
      method: "DELETE"
    }),
  reorderLinks: (payload: LinkReorderPayload) =>
    request<{ state: ExportPayload }>("/api/links/reorder", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  checkLink: (id: string) =>
    request<{ record: HealthRecord; state: ExportPayload }>(`/api/health/check/${id}`, {
      method: "POST"
    }),
  checkAll: () =>
    request<HealthSummary>("/api/health/check-all", {
      method: "POST"
    }),
  exportState: () => request<ExportPayload>("/api/export"),
  importState: (payload: ExportPayload) =>
    request<ExportPayload>("/api/import", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
