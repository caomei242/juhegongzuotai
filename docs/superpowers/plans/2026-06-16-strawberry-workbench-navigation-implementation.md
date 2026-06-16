# 草莓工作台导航指挥台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of 「草莓工作台」 as a local, migratable Chinese web app for configurable web navigation, manual work status, today actions, and automatic link health checks.

**Architecture:** Use one TypeScript workspace with a React/Vite client and an Express server. Shared Zod schemas define the JSON data contract, the server owns persistence and health checks, and the client renders the draggable workbench from API state. Runtime data lives under a configurable `data/` directory so the app can move from the current machine to another Mac, NAS, Docker host, or cloud server later.

**Tech Stack:** TypeScript, React, Vite, Express, Zod, dnd-kit, lucide-react, dotenv, Vitest, Testing Library, Supertest, tsx.

---

## Scope Check

The approved spec covers one coherent V1 product: a local navigation workbench with persistence, link health, and a Chinese desktop UI. The plan keeps auth, cloud sync, browser extension, screenshots, and business automation out of V1.

## File Structure

Create these files:

```text
package.json
tsconfig.json
tsconfig.node.json
vite.config.ts
vitest.config.ts
index.html
.env.example
.gitignore
README.md
src/shared/schema.ts
src/shared/defaultData.ts
src/shared/schema.test.ts
src/server/config.ts
src/server/storage/jsonStore.ts
src/server/storage/jsonStore.test.ts
src/server/health/healthChecker.ts
src/server/health/healthChecker.test.ts
src/server/api/workbenchRoutes.ts
src/server/api/workbenchRoutes.test.ts
src/server/index.ts
src/client/main.tsx
src/client/App.tsx
src/client/api.ts
src/client/styles.css
src/client/components/Layout.tsx
src/client/components/TopToolbar.tsx
src/client/components/GroupRail.tsx
src/client/components/WorkbenchBoard.tsx
src/client/components/LinkCard.tsx
src/client/components/RightPanel.tsx
src/client/components/LinkEditor.tsx
src/client/components/ImportExportDialog.tsx
src/client/components/App.test.tsx
data/.gitkeep
```

Responsibilities:

- `src/shared/schema.ts`: single source of truth for groups, links, health records, settings, import/export payloads.
- `src/shared/defaultData.ts`: Chinese default groups, statuses, settings, and sample starter links.
- `src/server/config.ts`: loads `.env`, validates port, data directory, scan interval, timeout, local network setting, and optional access token.
- `src/server/storage/jsonStore.ts`: reads/writes `workbench.json` and `health-checks.json`, creates backups before writes, validates imports.
- `src/server/health/healthChecker.ts`: performs timeout-bounded health checks without logging in to target websites.
- `src/server/api/workbenchRoutes.ts`: Express API for state, groups, links, drag ordering, health checks, import, export.
- `src/client/api.ts`: typed client API wrapper.
- `src/client/components/*`: focused UI components for the Chinese workbench.
- `src/client/styles.css`: full visual system and responsive desktop layout.

## Task 1: Bootstrap The TypeScript App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json` with:

```json
{
  "name": "juhegongzuotai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:client": "vite --host 127.0.0.1",
    "dev:server": "tsx watch src/server/index.ts",
    "build": "tsc -p tsconfig.json && vite build && tsc -p tsconfig.node.json --outDir dist/server",
    "start": "node dist/server/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "lucide-react": "^0.468.0",
    "nanoid": "^5.0.9",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.3.4",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.17",
    "@types/react-dom": "^18.3.5",
    "concurrently": "^9.1.0",
    "jsdom": "^25.0.1",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config**

Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, and `vitest.config.ts` so client and server tests run in one repo.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/server/**/*.ts", "src/shared/**/*.ts"]
}
```

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
```

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
```

- [ ] **Step 3: Create app shell and environment example**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>草莓工作台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

Create `.env.example`:

```bash
STRAWBERRY_PORT=8787
STRAWBERRY_DATA_DIR=./data
STRAWBERRY_CHECK_INTERVAL_MINUTES=30
STRAWBERRY_CHECK_TIMEOUT_MS=8000
STRAWBERRY_ACCESS_TOKEN=
STRAWBERRY_ALLOW_LAN=false
```

Create `.gitignore`:

```gitignore
.DS_Store
node_modules/
dist/
.env
.codex_py_logs/
.superpowers/
outputs/
tmp/
tmp-link
_icloud_日报
data/*.json
data/backups/
!data/.gitkeep
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules/` is created and `package-lock.json` is generated.

- [ ] **Step 5: Commit bootstrap**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts index.html .env.example .gitignore data/.gitkeep
git commit -m "chore: bootstrap strawberry workbench"
```

## Task 2: Define The Shared Data Contract

**Files:**
- Create: `src/shared/schema.ts`
- Create: `src/shared/defaultData.ts`
- Create: `src/shared/schema.test.ts`

- [ ] **Step 1: Write schema tests first**

Create `src/shared/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultWorkbench } from "./defaultData";
import { WorkbenchSchema } from "./schema";

describe("WorkbenchSchema", () => {
  it("accepts the Chinese default workbench", () => {
    const parsed = WorkbenchSchema.parse(defaultWorkbench);
    expect(parsed.productName).toBe("草莓工作台");
    expect(parsed.groups.map((group) => group.name)).toContain("主业系统");
  });

  it("rejects links without a valid URL", () => {
    const invalid = structuredClone(defaultWorkbench);
    invalid.links[0].url = "不是链接";
    expect(() => WorkbenchSchema.parse(invalid)).toThrow();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/shared/schema.test.ts
```

Expected: FAIL because `schema.ts` and `defaultData.ts` do not exist.

- [ ] **Step 3: Implement schemas and defaults**

Create `src/shared/schema.ts` with exported Zod schemas and TypeScript types:

```ts
import { z } from "zod";

export const HealthStatusSchema = z.enum(["normal", "degraded", "down", "unchecked"]);
export const BusinessStatusSchema = z.enum(["正常使用", "待处理", "重点关注", "暂停使用", "待迁移", "已废弃"]);

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  accent: z.string().min(1)
});

export const LinkSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  businessStatus: BusinessStatusSchema,
  note: z.string(),
  todayAction: z.string(),
  order: z.number().int().nonnegative(),
  pinned: z.boolean(),
  checkIntervalMinutes: z.number().int().positive()
});

export const HealthRecordSchema = z.object({
  linkId: z.string().min(1),
  status: HealthStatusSchema,
  checkedAt: z.string(),
  responseMs: z.number().nonnegative().nullable(),
  error: z.string(),
  failureCount: z.number().int().nonnegative()
});

export const SettingsSchema = z.object({
  productName: z.literal("草莓工作台"),
  statuses: z.array(BusinessStatusSchema).min(1),
  checkIntervalMinutes: z.number().int().positive(),
  checkTimeoutMs: z.number().int().positive()
});

export const WorkbenchSchema = z.object({
  productName: z.literal("草莓工作台"),
  groups: z.array(GroupSchema),
  links: z.array(LinkSchema),
  settings: SettingsSchema
});

export const ExportPayloadSchema = z.object({
  workbench: WorkbenchSchema,
  healthRecords: z.array(HealthRecordSchema)
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type BusinessStatus = z.infer<typeof BusinessStatusSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type WorkbenchLink = z.infer<typeof LinkSchema>;
export type HealthRecord = z.infer<typeof HealthRecordSchema>;
export type Workbench = z.infer<typeof WorkbenchSchema>;
export type ExportPayload = z.infer<typeof ExportPayloadSchema>;
```

Create `src/shared/defaultData.ts`:

```ts
import type { HealthRecord, Workbench } from "./schema";

export const defaultWorkbench: Workbench = {
  productName: "草莓工作台",
  groups: [
    { id: "main-work", name: "主业系统", order: 0, accent: "blue" },
    { id: "customers", name: "客户管理", order: 1, accent: "teal" },
    { id: "content", name: "内容工具", order: 2, accent: "coral" },
    { id: "finance", name: "财务账本", order: 3, accent: "green" },
    { id: "experiments", name: "实验项目", order: 4, accent: "amber" },
    { id: "personal", name: "个人常用", order: 5, accent: "gray" }
  ],
  links: [
    {
      id: "customer-workbench",
      groupId: "customers",
      title: "客户工作台",
      url: "http://localhost:8787",
      domain: "localhost",
      businessStatus: "重点关注",
      note: "每日先看客户跟进入口",
      todayAction: "检查高优先级客户",
      order: 0,
      pinned: true,
      checkIntervalMinutes: 30
    }
  ],
  settings: {
    productName: "草莓工作台",
    statuses: ["正常使用", "待处理", "重点关注", "暂停使用", "待迁移", "已废弃"],
    checkIntervalMinutes: 30,
    checkTimeoutMs: 8000
  }
};

export const defaultHealthRecords: HealthRecord[] = [
  {
    linkId: "customer-workbench",
    status: "unchecked",
    checkedAt: "",
    responseMs: null,
    error: "",
    failureCount: 0
  }
];
```

- [ ] **Step 4: Verify schemas pass**

Run:

```bash
npm test -- src/shared/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit schema**

```bash
git add src/shared/schema.ts src/shared/defaultData.ts src/shared/schema.test.ts
git commit -m "feat: define workbench data contract"
```

## Task 3: Implement JSON Storage And Backups

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/storage/jsonStore.ts`
- Create: `src/server/storage/jsonStore.test.ts`

- [ ] **Step 1: Write storage tests**

Create `src/server/storage/jsonStore.test.ts`:

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultWorkbench } from "../../shared/defaultData";
import { JsonStore } from "./jsonStore";

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
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/server/storage/jsonStore.test.ts
```

Expected: FAIL because `jsonStore.ts` does not exist.

- [ ] **Step 3: Implement config and storage**

Create `src/server/config.ts`:

```ts
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv();

export type AppConfig = {
  port: number;
  dataDir: string;
  checkIntervalMinutes: number;
  checkTimeoutMs: number;
  accessToken: string;
  allowLan: boolean;
};

export function readConfig(): AppConfig {
  return {
    port: Number(process.env.STRAWBERRY_PORT ?? 8787),
    dataDir: resolve(process.env.STRAWBERRY_DATA_DIR ?? "./data"),
    checkIntervalMinutes: Number(process.env.STRAWBERRY_CHECK_INTERVAL_MINUTES ?? 30),
    checkTimeoutMs: Number(process.env.STRAWBERRY_CHECK_TIMEOUT_MS ?? 8000),
    accessToken: process.env.STRAWBERRY_ACCESS_TOKEN ?? "",
    allowLan: process.env.STRAWBERRY_ALLOW_LAN === "true"
  };
}
```

Create `src/server/storage/jsonStore.ts` with `JsonStore.readState()`, `JsonStore.writeWorkbench()`, `JsonStore.writeHealthRecords()`, and `JsonStore.importPayload()`. Use `WorkbenchSchema`, `HealthRecordSchema`, and `ExportPayloadSchema` before writes. Write temp files first, then rename them into place. Before overwriting, copy existing files to `data/backups/latest-workbench.json` and `data/backups/latest-health-checks.json`.

- [ ] **Step 4: Verify storage tests pass**

Run:

```bash
npm test -- src/server/storage/jsonStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit storage**

```bash
git add src/server/config.ts src/server/storage/jsonStore.ts src/server/storage/jsonStore.test.ts
git commit -m "feat: persist workbench json data"
```

## Task 4: Build The Express API

**Files:**
- Create: `src/server/api/workbenchRoutes.ts`
- Create: `src/server/api/workbenchRoutes.test.ts`
- Create: `src/server/index.ts`

- [ ] **Step 1: Write route tests**

Create `src/server/api/workbenchRoutes.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createWorkbenchRouter } from "./workbenchRoutes";

describe("workbench routes", () => {
  it("returns Chinese default state", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", createWorkbenchRouter());
    const response = await request(app).get("/api/state").expect(200);
    expect(response.body.workbench.productName).toBe("草莓工作台");
  });

  it("creates a link with manual fields", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", createWorkbenchRouter());
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
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```bash
npm test -- src/server/api/workbenchRoutes.test.ts
```

Expected: FAIL because route factory does not exist.

- [ ] **Step 3: Implement API routes**

Create route handlers for:

```text
GET    /api/state
POST   /api/groups
PATCH  /api/groups/:id
DELETE /api/groups/:id
POST   /api/groups/reorder
POST   /api/links
PATCH  /api/links/:id
DELETE /api/links/:id
POST   /api/links/reorder
GET    /api/export
POST   /api/import
```

For V1, `createWorkbenchRouter()` can use one `JsonStore` instance and default to `./data` when no store is passed. Reject invalid payloads with status `400` and a Chinese error message.

Create `src/server/index.ts` to read config, attach JSON middleware, optional token middleware, routes, serve the built Vite `dist/` directory when it exists, and listen on `127.0.0.1` unless `STRAWBERRY_ALLOW_LAN=true`.

- [ ] **Step 4: Verify API tests pass**

Run:

```bash
npm test -- src/server/api/workbenchRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API**

```bash
git add src/server/api/workbenchRoutes.ts src/server/api/workbenchRoutes.test.ts src/server/index.ts
git commit -m "feat: add workbench api"
```

## Task 5: Add Link Health Checking

**Files:**
- Create: `src/server/health/healthChecker.ts`
- Create: `src/server/health/healthChecker.test.ts`
- Modify: `src/server/api/workbenchRoutes.ts`

- [ ] **Step 1: Write health checker tests**

Create `src/server/health/healthChecker.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { checkLinkHealth } from "./healthChecker";

describe("checkLinkHealth", () => {
  it("marks a fast 200 response as normal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await checkLinkHealth("link-1", "https://example.com", {
      timeoutMs: 1000,
      fetchImpl: fetchMock
    });
    expect(result.status).toBe("normal");
    expect(result.error).toBe("");
  });

  it("marks fetch failure as down", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    const result = await checkLinkHealth("link-1", "https://bad.example", {
      timeoutMs: 1000,
      fetchImpl: fetchMock
    });
    expect(result.status).toBe("down");
    expect(result.error).toContain("ENOTFOUND");
  });
});
```

- [ ] **Step 2: Run health tests to verify failure**

Run:

```bash
npm test -- src/server/health/healthChecker.test.ts
```

Expected: FAIL because `healthChecker.ts` does not exist.

- [ ] **Step 3: Implement health checking**

Create `checkLinkHealth(linkId, url, options)` that:

- Uses `HEAD` first.
- Falls back to `GET` if `HEAD` fails with method-related errors.
- Uses `AbortController` for timeout.
- Returns `normal` for 200-399.
- Returns `degraded` for 400-599 or slow response above timeout threshold before abort.
- Returns `down` for DNS, connection, and timeout failures.
- Does not send credentials.

- [ ] **Step 4: Add health API endpoints**

Modify `workbenchRoutes.ts` to add:

```text
POST /api/health/check/:linkId
POST /api/health/check-all
```

The single-link endpoint checks one link and writes its health record. The all-links endpoint checks every link sequentially for V1 and returns `{ checked, normal, degraded, down }`.

- [ ] **Step 5: Verify health tests and route tests**

Run:

```bash
npm test -- src/server/health/healthChecker.test.ts src/server/api/workbenchRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit health**

```bash
git add src/server/health/healthChecker.ts src/server/health/healthChecker.test.ts src/server/api/workbenchRoutes.ts src/server/api/workbenchRoutes.test.ts
git commit -m "feat: add link health checks"
```

## Task 6: Build The Chinese Workbench Shell

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/api.ts`
- Create: `src/client/styles.css`
- Create: `src/client/components/Layout.tsx`
- Create: `src/client/components/TopToolbar.tsx`
- Create: `src/client/components/GroupRail.tsx`
- Create: `src/client/components/App.test.tsx`

- [ ] **Step 1: Write first UI test**

Create `src/client/components/App.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App", () => {
  it("renders the Chinese product name and primary actions", async () => {
    render(<App />);
    expect(await screen.findByText("草莓工作台")).toBeInTheDocument();
    expect(await screen.findByText("添加链接")).toBeInTheDocument();
    expect(await screen.findByPlaceholderText("搜索系统、链接或备注")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run:

```bash
npm test -- src/client/components/App.test.tsx
```

Expected: FAIL because client components do not exist.

- [ ] **Step 3: Implement API wrapper and shell**

Create `src/client/api.ts` with typed functions:

```ts
import type { ExportPayload, Workbench } from "../shared/schema";

export type StateResponse = ExportPayload;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  getState: () => request<StateResponse>("/api/state"),
  saveWorkbench: (workbench: Workbench) =>
    request<StateResponse>("/api/import", {
      method: "POST",
      body: JSON.stringify({ workbench, healthRecords: [] })
    })
};
```

Create the first render path with a loading state, an error state, and fallback to `defaultWorkbench` if `/api/state` is unreachable during tests.

- [ ] **Step 4: Implement layout CSS**

Create `src/client/styles.css` with:

- Light neutral page.
- Fixed three-column app layout.
- Left rail width near 220px.
- Right panel width near 340px.
- 8px or smaller radii.
- Chinese body font stack: `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`.
- Health colors for normal, degraded, down, unchecked.

- [ ] **Step 5: Verify UI shell test**

Run:

```bash
npm test -- src/client/components/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit shell**

```bash
git add src/client/main.tsx src/client/App.tsx src/client/api.ts src/client/styles.css src/client/components/Layout.tsx src/client/components/TopToolbar.tsx src/client/components/GroupRail.tsx src/client/components/App.test.tsx
git commit -m "feat: add chinese workbench shell"
```

## Task 7: Implement Link Cards, Right Panel, And Manual Editing

**Files:**
- Create: `src/client/components/WorkbenchBoard.tsx`
- Create: `src/client/components/LinkCard.tsx`
- Create: `src/client/components/RightPanel.tsx`
- Create: `src/client/components/LinkEditor.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/components/App.test.tsx`

- [ ] **Step 1: Add manual-field UI tests**

Extend `App.test.tsx` with:

```tsx
it("shows today actions and manual business status", async () => {
  render(<App />);
  expect(await screen.findByText("今日动作")).toBeInTheDocument();
  expect(await screen.findByText("重点关注")).toBeInTheDocument();
  expect(await screen.findByText("检查高优先级客户")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/client/components/App.test.tsx
```

Expected: FAIL until board and right panel are implemented.

- [ ] **Step 3: Implement board and card components**

`WorkbenchBoard.tsx` groups links by selected group and renders `LinkCard` rows or compact tiles. `LinkCard.tsx` displays:

- Drag handle.
- Title.
- Domain.
- Health dot.
- Last checked text.
- Business status pill.
- Note.
- Today action.
- Open button.
- Edit button.

All visible text is Simplified Chinese.

- [ ] **Step 4: Implement right panel and editor**

`RightPanel.tsx` renders:

- 今日动作 list from links with `todayAction`.
- 异常链接 list from health records with `degraded` or `down`.
- 当前链接 editor when a card is selected.

`LinkEditor.tsx` edits group, URL, status, note, today action, pinned, and check interval. On save it calls `PATCH /api/links/:id`.

- [ ] **Step 5: Verify tests pass**

Run:

```bash
npm test -- src/client/components/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit editing UI**

```bash
git add src/client/components/WorkbenchBoard.tsx src/client/components/LinkCard.tsx src/client/components/RightPanel.tsx src/client/components/LinkEditor.tsx src/client/App.tsx src/client/api.ts src/client/components/App.test.tsx
git commit -m "feat: edit link status and today actions"
```

## Task 8: Add Search, Filters, Dragging, Import, And Export

**Files:**
- Create: `src/client/components/ImportExportDialog.tsx`
- Modify: `src/client/components/TopToolbar.tsx`
- Modify: `src/client/components/WorkbenchBoard.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`

- [ ] **Step 1: Add filtering and import/export tests**

Add tests that type into search and confirm unrelated cards disappear, then open export and confirm JSON text includes `"productName":"草莓工作台"`.

```tsx
it("filters links by search text", async () => {
  render(<App />);
  const search = await screen.findByPlaceholderText("搜索系统、链接或备注");
  await userEvent.type(search, "客户");
  expect(await screen.findByText("客户工作台")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement filters**

Filtering rules:

- Search matches title, domain, note, today action.
- Group filter comes from left rail.
- Health status filter comes from toolbar.
- Business status filter comes from toolbar.
- Filters never mutate persisted order.

- [ ] **Step 3: Implement dnd-kit dragging**

Use `@dnd-kit/core` and `@dnd-kit/sortable` to reorder links in a group and move a link to another group. On drag end call `POST /api/links/reorder` with link ids, group id, and order values.

- [ ] **Step 4: Implement import/export dialog**

Export:

- Calls `GET /api/export`.
- Shows a downloadable JSON blob.

Import:

- Accepts JSON text or uploaded `.json`.
- Validates through `POST /api/import`.
- Shows Chinese success or error feedback.
- Does not overwrite current state if server rejects the payload.

- [ ] **Step 5: Run client and API tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit interactivity**

```bash
git add src/client/components/ImportExportDialog.tsx src/client/components/TopToolbar.tsx src/client/components/WorkbenchBoard.tsx src/client/App.tsx src/client/api.ts src/client/components/App.test.tsx
git commit -m "feat: add search drag import export"
```

## Task 9: Add Documentation, Local Run, And Visual QA

**Files:**
- Create: `README.md`
- Modify: `src/client/styles.css`
- Modify: `.env.example`

- [ ] **Step 1: Write README**

Create `README.md` with:

```md
# 草莓工作台

草莓工作台是一个本地网页工作台，用来聚合常用网页系统、手动维护业务状态和今日动作，并自动检测链接入口是否可访问。

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev
```

默认地址：

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:8787

## 可迁移数据

运行数据默认保存在 `data/`：

- `data/workbench.json`
- `data/health-checks.json`
- `data/backups/`

迁移到另一台机器时，复制项目目录和 `data/` 目录，再按需调整 `.env`。

## 配置

```bash
STRAWBERRY_PORT=8787
STRAWBERRY_DATA_DIR=./data
STRAWBERRY_CHECK_INTERVAL_MINUTES=30
STRAWBERRY_CHECK_TIMEOUT_MS=8000
STRAWBERRY_ACCESS_TOKEN=
STRAWBERRY_ALLOW_LAN=false
```

## 第一版边界

第一版不做登录、多用户协作、云同步、浏览器插件、网页截图预览或自动生成今日动作。
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 3: Start the app**

Run:

```bash
npm run dev
```

Expected:

- API listens on `127.0.0.1:8787`.
- Vite serves `http://127.0.0.1:5173`.
- The first screen shows 「草莓工作台」 in the top-left.

- [ ] **Step 4: Browser QA**

Open `http://127.0.0.1:5173` in the in-app Browser and verify:

- Left top says 「草莓工作台」.
- All visible UI text is Simplified Chinese.
- Add link, edit link, delete link, search, filter, and open link controls are visible.
- Today actions and abnormal links show in the right panel.
- Text does not overlap at desktop width.
- Color palette is not one-note purple, beige, dark slate, or brown/orange.

- [ ] **Step 5: Commit documentation and polish**

```bash
git add README.md .env.example src/client/styles.css
git commit -m "docs: document strawberry workbench setup"
```

## Task 10: Connect GitHub Remote And Push

**Files:**
- No code files unless remote metadata is missing.

- [ ] **Step 1: Ensure the repository remote exists**

Run:

```bash
git remote -v
```

If no origin exists, run:

```bash
git remote add origin git@github.com:caomei242/juhegongzuotai.git
```

If origin exists but points elsewhere, stop and ask before changing it.

- [ ] **Step 2: Push main**

Run:

```bash
git branch -M main
git push -u origin main
```

Expected: GitHub receives the V1 code, spec, and plan on `main`.

## Self-Review

- Spec coverage: The plan covers Chinese product name, three-zone UI, local service, JSON persistence, backups, health checks, manual fields, import/export, access-token-ready config, migration-ready data directory, tests, README, and push.
- Intentional V1 exclusions: login, multi-user collaboration, cloud sync, browser extension, screenshots, automatic business analysis, automatic today actions, and mobile-specific work remain out of implementation tasks.
- Placeholder scan: The plan uses concrete file paths, concrete commands, and concrete test snippets. No placeholder terms remain.
