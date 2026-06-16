// @vitest-environment node

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultWorkbench } from "../../shared/defaultData.js";
import { JsonStore } from "./jsonStore.js";

describe("JsonStore", () => {
  it("creates default data when files do not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "strawberry-store-"));
    const store = new JsonStore(dir);
    const state = await store.readState();
    expect(state.workbench.productName).toBe("草莓工作台");
    expect(state.workbench.groups.length).toBeGreaterThan(0);
  });

  it("backs up workbench data before overwriting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "strawberry-store-"));
    const store = new JsonStore(dir);
    await store.writeWorkbench(defaultWorkbench);
    const next = structuredClone(defaultWorkbench);
    next.links[0].title = "客户工作台新版";
    await store.writeWorkbench(next);
    const backupIndex = await readFile(join(dir, "backups", "latest-workbench.json"), "utf8");
    expect(backupIndex).toContain("客户工作台");
  });

  it("rejects invalid imports without overwriting existing state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "strawberry-store-"));
    const store = new JsonStore(dir);
    await store.writeWorkbench(defaultWorkbench);

    await expect(
      store.importPayload({
        workbench: { ...defaultWorkbench, productName: "坏数据" },
        healthRecords: []
      })
    ).rejects.toThrow();

    const state = await store.readState();
    expect(state.workbench.productName).toBe("草莓工作台");
    expect(state.workbench.links[0].title).toBe("客户工作台");
  });
});
