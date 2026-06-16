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
