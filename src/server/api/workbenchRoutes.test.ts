// @vitest-environment node

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { JsonStore } from "../storage/jsonStore.js";
import { createWorkbenchRouter } from "./workbenchRoutes.js";

async function createTestApp() {
  const dir = await mkdtemp(join(tmpdir(), "strawberry-api-"));
  const store = new JsonStore(dir);
  const app = express();
  app.use(express.json());
  app.use("/api", createWorkbenchRouter(store));
  return { app, store };
}

describe("workbench routes", () => {
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
});
