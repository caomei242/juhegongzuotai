// @vitest-environment node

import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readConfig } from "./config.js";

const configKeys = [
  "STRAWBERRY_PORT",
  "STRAWBERRY_DATA_DIR",
  "STRAWBERRY_CHECK_INTERVAL_MINUTES",
  "STRAWBERRY_CHECK_TIMEOUT_MS",
  "STRAWBERRY_ACCESS_TOKEN",
  "STRAWBERRY_ALLOW_LAN"
] as const;

type ConfigKey = (typeof configKeys)[number];

const originalEnv: Partial<Record<ConfigKey, string>> = {};

describe("readConfig", () => {
  beforeEach(() => {
    for (const key of configKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of configKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("uses validated defaults", () => {
    expect(readConfig()).toEqual({
      port: 8787,
      dataDir: resolve("./data"),
      checkIntervalMinutes: 30,
      checkTimeoutMs: 8000,
      accessToken: "",
      allowLan: false
    });
  });

  it("coerces valid environment values", () => {
    process.env.STRAWBERRY_PORT = "8788";
    process.env.STRAWBERRY_DATA_DIR = "custom-data";
    process.env.STRAWBERRY_CHECK_INTERVAL_MINUTES = "15";
    process.env.STRAWBERRY_CHECK_TIMEOUT_MS = "1000";
    process.env.STRAWBERRY_ACCESS_TOKEN = "secret-token";
    process.env.STRAWBERRY_ALLOW_LAN = "true";

    expect(readConfig()).toEqual({
      port: 8788,
      dataDir: resolve("custom-data"),
      checkIntervalMinutes: 15,
      checkTimeoutMs: 1000,
      accessToken: "secret-token",
      allowLan: true
    });
  });

  it.each([
    ["STRAWBERRY_PORT", "0"],
    ["STRAWBERRY_PORT", "65536"],
    ["STRAWBERRY_PORT", "abc"],
    ["STRAWBERRY_PORT", "123.4"],
    ["STRAWBERRY_DATA_DIR", ""],
    ["STRAWBERRY_DATA_DIR", "   "],
    ["STRAWBERRY_CHECK_INTERVAL_MINUTES", "0"],
    ["STRAWBERRY_CHECK_INTERVAL_MINUTES", "1.5"],
    ["STRAWBERRY_CHECK_TIMEOUT_MS", "-1"],
    ["STRAWBERRY_ALLOW_LAN", "yes"]
  ] satisfies Array<[ConfigKey, string]>)("throws clearly for invalid %s=%s", (key, value) => {
    process.env[key] = value;

    expect(() => readConfig()).toThrow(new RegExp(`Invalid strawberry config.*${key}`));
  });
});
