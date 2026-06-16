import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

loadEnv();

export type AppConfig = {
  port: number;
  dataDir: string;
  checkIntervalMinutes: number;
  checkTimeoutMs: number;
  accessToken: string;
  allowLan: boolean;
};

const ConfigEnvSchema = z.object({
  STRAWBERRY_PORT: integerEnv("integer between 1 and 65535", "8787", 1, 65535),
  STRAWBERRY_DATA_DIR: z
    .string()
    .optional()
    .default("./data")
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "must be a non-empty string")
    .transform((value) => resolve(value)),
  STRAWBERRY_CHECK_INTERVAL_MINUTES: integerEnv("positive integer", "30", 1),
  STRAWBERRY_CHECK_TIMEOUT_MS: integerEnv("positive integer", "8000", 1),
  STRAWBERRY_ACCESS_TOKEN: z.string().optional().default(""),
  STRAWBERRY_ALLOW_LAN: z
    .string()
    .optional()
    .default("")
    .refine((value) => value === "" || value === "true" || value === "false", 'must be "true" or "false"')
    .transform((value) => value === "true")
});

export function readConfig(): AppConfig {
  const parsed = ConfigEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid strawberry config: ${issues}`);
  }

  return {
    port: parsed.data.STRAWBERRY_PORT,
    dataDir: parsed.data.STRAWBERRY_DATA_DIR,
    checkIntervalMinutes: parsed.data.STRAWBERRY_CHECK_INTERVAL_MINUTES,
    checkTimeoutMs: parsed.data.STRAWBERRY_CHECK_TIMEOUT_MS,
    accessToken: parsed.data.STRAWBERRY_ACCESS_TOKEN,
    allowLan: parsed.data.STRAWBERRY_ALLOW_LAN
  };
}

function integerEnv(description: string, defaultValue: string, min: number, max?: number) {
  return z
    .string()
    .optional()
    .default(defaultValue)
    .refine((value) => /^\d+$/.test(value), `must be a ${description}`)
    .transform((value) => Number(value))
    .refine((value) => Number.isSafeInteger(value), "must be a safe integer")
    .refine(
      (value) => value >= min && (max === undefined || value <= max),
      max === undefined ? `must be at least ${min}` : `must be between ${min} and ${max}`
    );
}
