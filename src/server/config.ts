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
