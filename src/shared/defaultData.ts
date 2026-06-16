import type { HealthRecord, Workbench } from "./schema.js";

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
