// @vitest-environment node

import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultHealthRecords, defaultWorkbench } from "../../shared/defaultData.js";
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

  it("backs up health records before overwriting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "strawberry-store-"));
    const store = new JsonStore(dir);
    await store.writeHealthRecords(defaultHealthRecords);
    const next = structuredClone(defaultHealthRecords);
    next[0].status = "down";
    next[0].failureCount = 3;
    await store.writeHealthRecords(next);
    const backupIndex = await readFile(join(dir, "backups", "latest-health-checks.json"), "utf8");
    expect(backupIndex).toContain('"status": "unchecked"');
    expect(backupIndex).toContain('"failureCount": 0');
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

  it("rolls back workbench changes when imported health records fail to write", async () => {
    const dir = await mkdtemp(join(tmpdir(), "strawberry-store-"));
    const store = new JsonStore(dir);
    await store.writeWorkbench(defaultWorkbench);
    await store.writeHealthRecords(defaultHealthRecords);
    await mkdir(join(dir, "backups", "latest-health-checks.json"), { recursive: true });

    const nextWorkbench = structuredClone(defaultWorkbench);
    nextWorkbench.links[0].title = "导入后的客户工作台";
    const nextHealthRecords = structuredClone(defaultHealthRecords);
    nextHealthRecords[0].status = "down";
    nextHealthRecords[0].failureCount = 9;

    await expect(
      store.importPayload({ workbench: nextWorkbench, healthRecords: nextHealthRecords })
    ).rejects.toThrow();

    const state = await store.readState();
    expect(state.workbench.links[0].title).toBe("客户工作台");
    expect(state.healthRecords[0].status).toBe("unchecked");
    expect(state.healthRecords[0].failureCount).toBe(0);
  });
});
