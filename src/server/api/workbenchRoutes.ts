import express, { type ErrorRequestHandler, type RequestHandler, type Router } from "express";
import { nanoid } from "nanoid";
import { z, ZodError } from "zod";
import {
  BusinessStatusSchema,
  ExportPayloadSchema,
  type ExportPayload,
  type Group,
  type Workbench,
  type WorkbenchLink
} from "../../shared/schema.js";
import { JsonStore } from "../storage/jsonStore.js";

const CreateGroupPayloadSchema = z
  .object({
    name: z.string().trim().min(1),
    order: z.number().int().nonnegative().optional(),
    accent: z.string().trim().min(1).optional()
  })
  .strict();

const UpdateGroupPayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    order: z.number().int().nonnegative().optional(),
    accent: z.string().trim().min(1).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "must include at least one field");

const GroupReorderPayloadSchema = z
  .object({
    groupIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

const CreateLinkPayloadSchema = z
  .object({
    groupId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    url: z.string().trim().url(),
    domain: z.string().trim().min(1).optional(),
    businessStatus: BusinessStatusSchema.optional(),
    note: z.string().optional(),
    todayAction: z.string().optional(),
    order: z.number().int().nonnegative().optional(),
    pinned: z.boolean().optional(),
    checkIntervalMinutes: z.number().int().positive().optional()
  })
  .strict();

const UpdateLinkPayloadSchema = z
  .object({
    groupId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    url: z.string().trim().url().optional(),
    domain: z.string().trim().min(1).optional(),
    businessStatus: BusinessStatusSchema.optional(),
    note: z.string().optional(),
    todayAction: z.string().optional(),
    order: z.number().int().nonnegative().optional(),
    pinned: z.boolean().optional(),
    checkIntervalMinutes: z.number().int().positive().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "must include at least one field");

const LinkReorderPayloadSchema = z
  .object({
    groupId: z.string().trim().min(1).optional(),
    linkIds: z.array(z.string().min(1)).min(1).optional(),
    links: z
      .array(
        z
          .object({
            id: z.string().min(1),
            groupId: z.string().trim().min(1).optional()
          })
          .strict()
      )
      .min(1)
      .optional()
  })
  .strict()
  .refine((value) => value.links !== undefined || (value.groupId !== undefined && value.linkIds !== undefined), {
    message: "must include links or groupId/linkIds"
  });

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function createWorkbenchRouter(store = new JsonStore("./data")): Router {
  const router = express.Router();
  let mutationQueue: Promise<void> = Promise.resolve();

  function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = mutationQueue.then(operation, operation);
    mutationQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  router.get(
    "/state",
    asyncRoute(async (_req, res) => {
      res.json(await store.readState());
    })
  );

  router.post(
    "/groups",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(CreateGroupPayloadSchema, req.body);

      await withMutationLock(async () => {
        const state = await store.readState();
        const group: Group = {
          id: nanoid(),
          name: payload.name,
          order: payload.order ?? nextGroupOrder(state.workbench),
          accent: payload.accent ?? "blue"
        };

        state.workbench.groups = normalizeGroupOrders([...state.workbench.groups, group]);
        await store.writeWorkbench(state.workbench);

        const persistedState = await store.readState();
        res.status(201).json({
          group: findGroup(persistedState.workbench, group.id),
          state: persistedState
        });
      });
    })
  );

  router.patch(
    "/groups/:id",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(UpdateGroupPayloadSchema, req.body);

      await withMutationLock(async () => {
        const state = await store.readState();
        const groupIndex = findGroupIndex(state.workbench, req.params.id);
        const group = {
          ...state.workbench.groups[groupIndex],
          ...payload
        };

        state.workbench.groups[groupIndex] = group;
        state.workbench.groups = normalizeGroupOrders(state.workbench.groups);
        await store.writeWorkbench(state.workbench);

        const persistedState = await store.readState();
        res.json({
          group: findGroup(persistedState.workbench, req.params.id),
          state: persistedState
        });
      });
    })
  );

  router.delete(
    "/groups/:id",
    asyncRoute(async (req, res) => {
      await withMutationLock(async () => {
        const state = await store.readState();
        const groupIndex = findGroupIndex(state.workbench, req.params.id);

        if (state.workbench.links.some((link) => link.groupId === req.params.id)) {
          throw new HttpError(400, "不能删除仍包含链接的分组，请先移动或删除这些链接。");
        }

        state.workbench.groups.splice(groupIndex, 1);
        state.workbench.groups = normalizeGroupOrders(state.workbench.groups);
        await store.writeWorkbench(state.workbench);

        res.json({ state: await store.readState() });
      });
    })
  );

  router.post(
    "/groups/reorder",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(GroupReorderPayloadSchema, req.body);

      await withMutationLock(async () => {
        const state = await store.readState();
        assertUnique(payload.groupIds, "分组排序里有重复分组。");
        assertKnownIds(
          payload.groupIds,
          state.workbench.groups.map((group) => group.id),
          "分组排序包含不存在的分组。"
        );

        state.workbench.groups = reorderGroups(state.workbench.groups, payload.groupIds);
        await store.writeWorkbench(state.workbench);

        res.json({ state: await store.readState() });
      });
    })
  );

  router.post(
    "/links",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(CreateLinkPayloadSchema, req.body);

      await withMutationLock(async () => {
        const state = await store.readState();
        assertGroupExists(state.workbench, payload.groupId);

        const link: WorkbenchLink = {
          id: nanoid(),
          groupId: payload.groupId,
          title: payload.title,
          url: payload.url,
          domain: payload.domain ?? deriveDomain(payload.url),
          businessStatus: payload.businessStatus ?? "待处理",
          note: payload.note ?? "",
          todayAction: payload.todayAction ?? "",
          order: payload.order ?? nextLinkOrder(state.workbench, payload.groupId),
          pinned: payload.pinned ?? false,
          checkIntervalMinutes: payload.checkIntervalMinutes ?? state.workbench.settings.checkIntervalMinutes
        };

        state.workbench.links = normalizeLinkOrders(state.workbench, [...state.workbench.links, link]);
        await store.writeWorkbench(state.workbench);

        const persistedState = await store.readState();
        res.status(201).json({
          link: findLink(persistedState.workbench, link.id),
          state: persistedState
        });
      });
    })
  );

  router.patch(
    "/links/:id",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(UpdateLinkPayloadSchema, req.body);

      await withMutationLock(async () => {
        const state = await store.readState();
        const linkIndex = findLinkIndex(state.workbench, req.params.id);
        const current = state.workbench.links[linkIndex];
        const nextGroupId = payload.groupId ?? current.groupId;

        assertGroupExists(state.workbench, nextGroupId);

        const link: WorkbenchLink = {
          ...current,
          ...payload,
          groupId: nextGroupId,
          domain: payload.domain ?? (payload.url === undefined ? current.domain : deriveDomain(payload.url)),
          order:
            payload.order ??
            (nextGroupId === current.groupId ? current.order : nextLinkOrder(state.workbench, nextGroupId))
        };

        state.workbench.links[linkIndex] = link;
        state.workbench.links = normalizeLinkOrders(state.workbench, state.workbench.links);
        await store.writeWorkbench(state.workbench);

        const persistedState = await store.readState();
        res.json({
          link: findLink(persistedState.workbench, req.params.id),
          state: persistedState
        });
      });
    })
  );

  router.delete(
    "/links/:id",
    asyncRoute(async (req, res) => {
      await withMutationLock(async () => {
        const state = await store.readState();
        const linkIndex = findLinkIndex(state.workbench, req.params.id);
        state.workbench.links.splice(linkIndex, 1);
        state.workbench.links = normalizeLinkOrders(state.workbench, state.workbench.links);
        await store.writeWorkbench(state.workbench);

        res.json({ state: await store.readState() });
      });
    })
  );

  router.post(
    "/links/reorder",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(LinkReorderPayloadSchema, req.body);

      await withMutationLock(async () => {
        const state = await store.readState();
        state.workbench.links = reorderLinks(state.workbench, payload);
        await store.writeWorkbench(state.workbench);

        res.json({ state: await store.readState() });
      });
    })
  );

  router.get(
    "/export",
    asyncRoute(async (_req, res) => {
      res.json(await store.readState());
    })
  );

  router.post(
    "/import",
    asyncRoute(async (req, res) => {
      const payload = parsePayload(ExportPayloadSchema, req.body);
      validateImportIntegrity(payload);

      await withMutationLock(async () => {
        res.json(await store.importPayload(payload));
      });
    })
  );

  router.use(errorHandler);

  return router;
}

export const apiJsonErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (isApiRequest(req) && isJsonParseError(error)) {
    res.status(400).json({ error: "请求 JSON 格式无效。" });
    return;
  }

  next(error);
};

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function errorHandler(error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: formatValidationError(error) });
    return;
  }

  res.status(500).json({ error: "服务器处理请求时发生错误。" });
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  return schema.parse(payload);
}

function formatValidationError(error: ZodError): string {
  const firstIssue = error.issues[0];

  if (firstIssue === undefined) {
    return "请求数据无效。";
  }

  const field = firstIssue.path.join(".");
  return field === "" ? "请求数据无效。" : `请求数据无效：${field}`;
}

function nextGroupOrder(workbench: Workbench): number {
  return maxOrder(workbench.groups) + 1;
}

function nextLinkOrder(workbench: Workbench, groupId: string): number {
  return maxOrder(workbench.links.filter((link) => link.groupId === groupId)) + 1;
}

function maxOrder(items: Array<{ order: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.order), -1);
}

function findGroupIndex(workbench: Workbench, id: string): number {
  const index = workbench.groups.findIndex((group) => group.id === id);

  if (index === -1) {
    throw new HttpError(404, "没有找到这个分组。");
  }

  return index;
}

function findGroup(workbench: Workbench, id: string): Group {
  return workbench.groups[findGroupIndex(workbench, id)];
}

function findLinkIndex(workbench: Workbench, id: string): number {
  const index = workbench.links.findIndex((link) => link.id === id);

  if (index === -1) {
    throw new HttpError(404, "没有找到这个链接。");
  }

  return index;
}

function findLink(workbench: Workbench, id: string): WorkbenchLink {
  return workbench.links[findLinkIndex(workbench, id)];
}

function assertGroupExists(workbench: Workbench, groupId: string): void {
  if (!workbench.groups.some((group) => group.id === groupId)) {
    throw new HttpError(400, "请求数据无效：分组不存在。");
  }
}

function assertUnique(values: string[], message: string): void {
  if (new Set(values).size !== values.length) {
    throw new HttpError(400, message);
  }
}

function assertKnownIds(values: string[], knownValues: string[], message: string): void {
  const known = new Set(knownValues);

  if (values.some((value) => !known.has(value))) {
    throw new HttpError(400, message);
  }
}

function validateImportIntegrity(payload: ExportPayload): void {
  const groupIds = payload.workbench.groups.map((group) => group.id);
  const linkIds = payload.workbench.links.map((link) => link.id);
  const healthRecordLinkIds = payload.healthRecords.map((record) => record.linkId);

  assertUnique(groupIds, "导入数据无效：分组 ID 重复。");
  assertUnique(linkIds, "导入数据无效：链接 ID 重复。");
  assertUnique(healthRecordLinkIds, "导入数据无效：健康记录链接 ID 重复。");

  const groupIdSet = new Set(groupIds);
  const linkIdSet = new Set(linkIds);

  if (payload.workbench.links.some((link) => !groupIdSet.has(link.groupId))) {
    throw new HttpError(400, "导入数据无效：链接引用了不存在的分组。");
  }

  if (payload.healthRecords.some((record) => !linkIdSet.has(record.linkId))) {
    throw new HttpError(400, "导入数据无效：健康记录引用了不存在的链接。");
  }
}

function normalizeGroupOrders(groups: Group[]): Group[] {
  return [...groups]
    .sort((left, right) => left.order - right.order)
    .map((group, order) => ({ ...group, order }));
}

function reorderGroups(groups: Group[], groupIds: string[]): Group[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const selected = groupIds.map((id) => groupById.get(id)).filter((group): group is Group => group !== undefined);
  const selectedIds = new Set(groupIds);
  const remaining = groups
    .filter((group) => !selectedIds.has(group.id))
    .sort((left, right) => left.order - right.order);

  return [...selected, ...remaining].map((group, order) => ({ ...group, order }));
}

function normalizeLinkOrders(workbench: Workbench, links: WorkbenchLink[]): WorkbenchLink[] {
  const groupsByOrder = [...workbench.groups].sort((left, right) => left.order - right.order);

  return groupsByOrder.flatMap((group) =>
    links
      .filter((link) => link.groupId === group.id)
      .sort((left, right) => left.order - right.order)
      .map((link, order) => ({ ...link, order }))
  );
}

function reorderLinks(workbench: Workbench, payload: z.infer<typeof LinkReorderPayloadSchema>): WorkbenchLink[] {
  const linkById = new Map(workbench.links.map((link) => [link.id, link]));
  const priorityByGroup = new Map<string, string[]>();
  const touchedIds: string[] = [];

  if (payload.links !== undefined) {
    for (const item of payload.links) {
      const link = linkById.get(item.id);

      if (link === undefined) {
        throw new HttpError(400, "链接排序包含不存在的链接。");
      }

      const groupId = item.groupId ?? link.groupId;
      assertGroupExists(workbench, groupId);
      link.groupId = groupId;
      touchedIds.push(link.id);
      appendPriority(priorityByGroup, groupId, link.id);
    }
  } else {
    const groupId = payload.groupId;
    const linkIds = payload.linkIds;

    if (groupId === undefined || linkIds === undefined) {
      throw new HttpError(400, "请求数据无效：链接排序缺少分组或链接列表。");
    }

    assertGroupExists(workbench, groupId);
    assertUnique(linkIds, "链接排序里有重复链接。");

    for (const id of linkIds) {
      const link = linkById.get(id);

      if (link === undefined) {
        throw new HttpError(400, "链接排序包含不存在的链接。");
      }

      link.groupId = groupId;
      touchedIds.push(link.id);
      appendPriority(priorityByGroup, groupId, link.id);
    }
  }

  assertUnique(touchedIds, "链接排序里有重复链接。");

  return [...workbench.groups]
    .sort((left, right) => left.order - right.order)
    .flatMap((group) => {
      const priorityIds = priorityByGroup.get(group.id) ?? [];
      const prioritySet = new Set(priorityIds);
      const priorityLinks = priorityIds.map((id) => linkById.get(id)).filter((link): link is WorkbenchLink => link !== undefined);
      const remainingLinks = [...linkById.values()]
        .filter((link) => link.groupId === group.id && !prioritySet.has(link.id))
        .sort((left, right) => left.order - right.order);

      return [...priorityLinks, ...remainingLinks].map((link, order) => ({ ...link, order }));
    });
}

function appendPriority(priorityByGroup: Map<string, string[]>, groupId: string, linkId: string): void {
  const groupLinks = priorityByGroup.get(groupId) ?? [];
  groupLinks.push(linkId);
  priorityByGroup.set(groupId, groupLinks);
}

function deriveDomain(url: string): string {
  return new URL(url).hostname;
}

function isApiRequest(req: express.Request): boolean {
  return req.originalUrl === "/api" || req.originalUrl.startsWith("/api/");
}

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof (error as { status?: unknown }).status === "number" &&
    (error as { status?: unknown }).status === 400 &&
    "body" in error
  );
}
