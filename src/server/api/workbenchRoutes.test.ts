// @vitest-environment node

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHealthRecords, defaultWorkbench } from "../../shared/defaultData.js";
import { JsonStore } from "../storage/jsonStore.js";
import { apiJsonErrorHandler, apiNotFoundHandler, createWorkbenchRouter } from "./workbenchRoutes.js";

async function createTestApp() {
  const dir = await mkdtemp(join(tmpdir(), "strawberry-api-"));
  const store = new JsonStore(dir);
  const app = express();
  app.use(express.json());
  app.use(apiJsonErrorHandler);
  app.use("/api", createWorkbenchRouter(store));
  app.use("/api", apiNotFoundHandler);
  return { app, store };
}

function healthResponse(status: number): Response {
  return new Response(null, { status });
}

describe("workbench routes", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns Chinese default state", async () => {
    const { app } = await createTestApp();

    const response = await request(app).get("/api/state").expect(200);

    expect(response.body.workbench.productName).toBe("草莓工作台");
  });

  it("creates a link with manual fields", async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .post("/api/links")
      .send({
        groupId: "main-work",
        title: "GEO 作战台",
        url: "https://example.com",
        businessStatus: "待处理",
        note: "用于内容获客",
        todayAction: "检查最新项目"
      })
      .expect(201);

    expect(response.body.link.title).toBe("GEO 作战台");
    expect(response.body.link.domain).toBe("example.com");
  });

  it("returns the persisted normalized link after creating with a manual order", async () => {
    const { app, store } = await createTestApp();

    const response = await request(app)
      .post("/api/links")
      .send({
        groupId: "main-work",
        title: "排序检查",
        url: "https://order.example.com",
        order: 999
      })
      .expect(201);
    const state = await store.readState();
    const persistedLink = state.workbench.links.find((link) => link.id === response.body.link.id);

    expect(response.body.link.order).toBe(0);
    expect(response.body.link.order).toBe(persistedLink?.order);
  });

  it("returns a Chinese 400 error for invalid payloads", async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .post("/api/links")
      .send({
        groupId: "main-work",
        title: "",
        url: "不是链接"
      })
      .expect(400);

    expect(response.body.error).toMatch(/无效|错误|必填/);
  });

  it("returns a Chinese JSON error for malformed JSON", async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .post("/api/links")
      .set("Content-Type", "application/json")
      .send('{"groupId":')
      .expect(400);

    expect(response.type).toMatch(/json/);
    expect(response.body.error).toBe("请求 JSON 格式无效。");
  });

  it("returns a Chinese JSON 404 for unknown API routes", async () => {
    const { app } = await createTestApp();

    const response = await request(app).post("/api/unknown-route").expect(404);

    expect(response.type).toMatch(/json/);
    expect(response.body.error).toBe("没有找到这个接口。");
  });

  it("checks a single link and persists its health record", async () => {
    const { app, store } = await createTestApp();
    fetchMock.mockResolvedValueOnce(healthResponse(200));

    const response = await request(app).post("/api/health/check/customer-workbench").expect(200);
    const state = await store.readState();
    const persistedRecord = state.healthRecords.find((record) => record.linkId === "customer-workbench");

    expect(response.body.record).toMatchObject({
      linkId: "customer-workbench",
      status: "normal",
      error: "",
      failureCount: 0
    });
    expect(response.body.record.checkedAt).toEqual(expect.any(String));
    expect(response.body.record.responseMs).toEqual(expect.any(Number));
    expect(persistedRecord).toMatchObject(response.body.record);
    expect(response.body.state.healthRecords).toContainEqual(response.body.record);
  });

  it("returns a Chinese 404 when checking an unknown link", async () => {
    const { app } = await createTestApp();

    const response = await request(app).post("/api/health/check/missing-link").expect(404);

    expect(response.body.error).toMatch(/链接|没有找到|不存在/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks all links, summarizes statuses, and updates health records", async () => {
    const { app, store } = await createTestApp();
    const degraded = await request(app)
      .post("/api/links")
      .send({
        groupId: "main-work",
        title: "降级链接",
        url: "https://degraded.example.com"
      })
      .expect(201);
    const down = await request(app)
      .post("/api/links")
      .send({
        groupId: "main-work",
        title: "宕机链接",
        url: "https://down.example.com"
      })
      .expect(201);

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("degraded.example.com")) {
        return healthResponse(500);
      }

      if (url.includes("down.example.com")) {
        throw new TypeError("ENOTFOUND down.example.com");
      }

      return healthResponse(200);
    });

    const response = await request(app).post("/api/health/check-all").expect(200);
    const state = await store.readState();
    const recordsByLinkId = new Map(
      response.body.state.healthRecords.map((record: { linkId: string }) => [record.linkId, record])
    );

    expect(response.body).toMatchObject({
      checked: 3,
      normal: 1,
      degraded: 1,
      down: 1
    });
    expect(recordsByLinkId.get("customer-workbench")).toMatchObject({ status: "normal", failureCount: 0 });
    expect(recordsByLinkId.get(degraded.body.link.id)).toMatchObject({ status: "degraded", failureCount: 1 });
    expect(recordsByLinkId.get(down.body.link.id)).toMatchObject({ status: "down", failureCount: 1 });
    expect(state.healthRecords).toEqual(response.body.state.healthRecords);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("removes a deleted link's health record so exported data stays importable", async () => {
    const { app } = await createTestApp();

    const deleteResponse = await request(app).delete("/api/links/customer-workbench").expect(200);
    const exportResponse = await request(app).get("/api/export").expect(200);
    const importResponse = await request(app).post("/api/import").send(exportResponse.body).expect(200);

    expect(deleteResponse.body.state.workbench.links).toHaveLength(0);
    expect(deleteResponse.body.state.healthRecords).toHaveLength(0);
    expect(importResponse.body.healthRecords).toHaveLength(0);
  });

  it("rejects deleting a group that still contains links", async () => {
    const { app } = await createTestApp();

    const response = await request(app).delete("/api/groups/customers").expect(400);

    expect(response.body.error).toMatch(/不能删除|包含链接|先删除/);
  });

  it("exports workbench and health records", async () => {
    const { app } = await createTestApp();

    const response = await request(app).get("/api/export").expect(200);

    expect(response.body.workbench.productName).toBe("草莓工作台");
    expect(response.body.healthRecords).toEqual(expect.any(Array));
  });

  it("rejects importing links that reference a missing group", async () => {
    const { app, store } = await createTestApp();
    const payload = structuredClone({
      workbench: defaultWorkbench,
      healthRecords: defaultHealthRecords
    });
    payload.workbench.links[0].groupId = "missing-group";

    const response = await request(app).post("/api/import").send(payload).expect(400);
    const state = await store.readState();

    expect(response.body.error).toMatch(/分组|不存在|无效/);
    expect(state.workbench.links[0].groupId).toBe("customers");
  });

  it("rejects importing duplicate group ids", async () => {
    const { app } = await createTestApp();
    const payload = structuredClone({
      workbench: defaultWorkbench,
      healthRecords: defaultHealthRecords
    });
    payload.workbench.groups[1].id = payload.workbench.groups[0].id;

    const response = await request(app).post("/api/import").send(payload).expect(400);

    expect(response.body.error).toMatch(/重复|无效/);
  });

  it("rejects importing duplicate link ids", async () => {
    const { app } = await createTestApp();
    const payload = structuredClone({
      workbench: defaultWorkbench,
      healthRecords: defaultHealthRecords
    });
    payload.workbench.links.push({
      ...payload.workbench.links[0],
      title: "重复链接",
      url: "https://duplicate.example.com",
      order: 1
    });

    const response = await request(app).post("/api/import").send(payload).expect(400);

    expect(response.body.error).toMatch(/重复|无效/);
  });

  it("rejects importing duplicate health record link ids", async () => {
    const { app } = await createTestApp();
    const payload = structuredClone({
      workbench: defaultWorkbench,
      healthRecords: defaultHealthRecords
    });
    payload.healthRecords.push({ ...payload.healthRecords[0] });

    const response = await request(app).post("/api/import").send(payload).expect(400);

    expect(response.body.error).toMatch(/重复|无效/);
  });

  it("rejects importing health records that reference a missing link", async () => {
    const { app, store } = await createTestApp();
    const payload = structuredClone({
      workbench: defaultWorkbench,
      healthRecords: defaultHealthRecords
    });
    payload.healthRecords[0].linkId = "missing-link";

    const response = await request(app).post("/api/import").send(payload).expect(400);
    const state = await store.readState();

    expect(response.body.error).toMatch(/链接|不存在|无效/);
    expect(state.healthRecords[0].linkId).toBe("customer-workbench");
  });

  it("continues processing mutations after a failed mutation", async () => {
    const { app } = await createTestApp();

    await request(app)
      .post("/api/links")
      .send({
        groupId: "missing-group",
        title: "失败后恢复",
        url: "https://recovery.example.com"
      })
      .expect(400);

    const response = await request(app)
      .post("/api/links")
      .send({
        groupId: "main-work",
        title: "失败后恢复",
        url: "https://recovery.example.com"
      })
      .expect(201);

    expect(response.body.link.title).toBe("失败后恢复");
  });

  it("serializes concurrent link creates", async () => {
    const { app } = await createTestApp();
    const requests = Array.from({ length: 6 }, (_value, index) =>
      request(app)
        .post("/api/links")
        .send({
          groupId: "main-work",
          title: `并发链接 ${index}`,
          url: `https://concurrent-${index}.example.com`
        })
        .expect(201)
    );

    await Promise.all(requests);

    const response = await request(app).get("/api/state").expect(200);
    const createdLinks = response.body.workbench.links.filter((link: { title: string }) =>
      link.title.startsWith("并发链接")
    );
    const createdOrders = createdLinks.map((link: { order: number }) => link.order);

    expect(createdLinks).toHaveLength(6);
    expect(new Set(createdOrders).size).toBe(6);
  });
});
