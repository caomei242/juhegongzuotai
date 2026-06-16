import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.js";
import { defaultHealthRecords, defaultWorkbench } from "../../shared/defaultData.js";
import type { ExportPayload } from "../../shared/schema.js";

const defaultState: ExportPayload = {
  workbench: defaultWorkbench,
  healthRecords: defaultHealthRecords
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("App", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);

      if (path === "/api/state" || path === "/api/export") {
        return jsonResponse(defaultState);
      }

      if (path === "/api/health/check-all") {
        return jsonResponse({ checked: 1, normal: 0, degraded: 0, down: 0, state: defaultState });
      }

      if (path === "/api/import" && init?.body) {
        return jsonResponse(JSON.parse(String(init.body)));
      }

      return jsonResponse(defaultState);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the Chinese product name and primary actions", async () => {
    render(<App />);

    expect(await screen.findByText("草莓工作台")).toBeInTheDocument();
    expect(await screen.findByText("添加链接")).toBeInTheDocument();
    expect(await screen.findByPlaceholderText("搜索系统、链接或备注")).toBeInTheDocument();
  });

  it("shows today actions and manual business status", async () => {
    render(<App />);

    expect(await screen.findAllByText("今日动作")).not.toHaveLength(0);
    expect(await screen.findAllByText("重点关注")).not.toHaveLength(0);
    expect(await screen.findAllByText(/检查高优先级客户/)).not.toHaveLength(0);
  });

  it("filters links by search text", async () => {
    const user = userEvent.setup();
    render(<App />);

    const search = await screen.findByPlaceholderText("搜索系统、链接或备注");
    await user.type(search, "客户");

    const board = screen.getByLabelText("链接工作区");
    expect(await within(board).findByText("客户工作台")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "不存在的入口");

    expect(within(board).queryByText("客户工作台")).not.toBeInTheDocument();
    expect(within(board).getByText("没有匹配的链接。")).toBeInTheDocument();
  });

  it("opens export dialog with Chinese JSON", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText("导入导出"));
    await waitFor(() =>
      expect((screen.getByLabelText("配置 JSON") as HTMLTextAreaElement).value).toContain("草莓工作台")
    );

    expect(screen.getByText("导入配置")).toBeInTheDocument();
  });
});
