import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.js";
import { defaultHealthRecords, defaultWorkbench } from "../../shared/defaultData.js";
import type { ExportPayload } from "../../shared/schema.js";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("App", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let serverState: ExportPayload;

  beforeEach(() => {
    serverState = structuredClone({
      workbench: defaultWorkbench,
      healthRecords: defaultHealthRecords
    });
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);

      if (path === "/api/state" || path === "/api/export") {
        return jsonResponse(serverState);
      }

      if (path === "/api/health/check-all") {
        return jsonResponse({ checked: 1, normal: 0, degraded: 0, down: 0, state: serverState });
      }

      if (path === "/api/import" && init?.body) {
        serverState = JSON.parse(String(init.body)) as ExportPayload;
        return jsonResponse(serverState);
      }

      return jsonResponse(serverState);
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

  it("keeps selected group aligned when selecting a right-panel action", async () => {
    const user = userEvent.setup();
    render(<App />);
    const actionRegion = await screen.findByRole("region", { name: "今日动作" });

    await user.click(within(actionRegion).getByText("客户工作台"));

    expect(screen.getByLabelText("链接工作区")).toHaveTextContent("客户管理");
    expect(screen.getByLabelText("链接工作区")).toHaveTextContent("客户工作台");
  });

  it("refreshes editor draft after importing updated data with the same link id", async () => {
    const user = userEvent.setup();
    const updatedState = structuredClone(serverState);
    updatedState.workbench.links[0].title = "导入后的客户工作台";
    render(<App />);

    await user.click(await screen.findByText("导入导出"));
    const textarea = await screen.findByLabelText("配置 JSON");
    await user.clear(textarea);
    await user.click(textarea);
    await user.paste(JSON.stringify(updatedState));
    await user.click(screen.getByText("导入配置"));

    expect(await screen.findByDisplayValue("导入后的客户工作台")).toBeInTheDocument();
  });
});
