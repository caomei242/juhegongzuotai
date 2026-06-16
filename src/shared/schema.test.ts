import { describe, expect, it } from "vitest";
import { defaultWorkbench } from "./defaultData.js";
import { WorkbenchSchema } from "./schema.js";

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
