import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { defaultHealthRecords, defaultWorkbench } from "../../shared/defaultData.js";
import {
  ExportPayloadSchema,
  HealthRecordSchema,
  WorkbenchSchema,
  type ExportPayload,
  type HealthRecord,
  type Workbench
} from "../../shared/schema.js";

const workbenchFile = "workbench.json";
const healthRecordsFile = "health-checks.json";
const backupsDir = "backups";

type FileSnapshot =
  | {
      path: string;
      existed: true;
      contents: string;
    }
  | {
      path: string;
      existed: false;
    };

export class JsonStore {
  private readonly workbenchPath: string;
  private readonly healthRecordsPath: string;
  private readonly backupsPath: string;

  constructor(private readonly dataDir: string) {
    this.workbenchPath = join(dataDir, workbenchFile);
    this.healthRecordsPath = join(dataDir, healthRecordsFile);
    this.backupsPath = join(dataDir, backupsDir);
  }

  async readState(): Promise<ExportPayload> {
    await this.ensureDataDir();

    const [workbench, healthRecords] = await Promise.all([
      this.readWorkbench(),
      this.readHealthRecords()
    ]);

    return ExportPayloadSchema.parse({ workbench, healthRecords });
  }

  async writeWorkbench(workbench: Workbench): Promise<void> {
    const parsed = WorkbenchSchema.parse(workbench);
    await this.writeValidatedJson(this.workbenchPath, join(this.backupsPath, "latest-workbench.json"), parsed);
  }

  async writeHealthRecords(healthRecords: HealthRecord[]): Promise<void> {
    const parsed = healthRecords.map((record) => HealthRecordSchema.parse(record));
    await this.writeValidatedJson(
      this.healthRecordsPath,
      join(this.backupsPath, "latest-health-checks.json"),
      parsed
    );
  }

  async importPayload(payload: unknown): Promise<ExportPayload> {
    const parsed = ExportPayloadSchema.parse(payload);
    const snapshots = await this.snapshotFiles([this.workbenchPath, this.healthRecordsPath]);

    try {
      await this.writeWorkbench(parsed.workbench);
      await this.writeHealthRecords(parsed.healthRecords);
    } catch (error) {
      try {
        await this.restoreSnapshots(snapshots);
      } catch (rollbackError) {
        if (error instanceof Error) {
          (error as Error & { rollbackError?: unknown }).rollbackError = rollbackError;
        }
      }

      throw error;
    }

    return parsed;
  }

  private async readWorkbench(): Promise<Workbench> {
    if (!(await pathExists(this.workbenchPath))) {
      await this.writeWorkbench(defaultWorkbench);
      return WorkbenchSchema.parse(defaultWorkbench);
    }

    return WorkbenchSchema.parse(await readJson(this.workbenchPath));
  }

  private async readHealthRecords(): Promise<HealthRecord[]> {
    if (!(await pathExists(this.healthRecordsPath))) {
      await this.writeHealthRecords(defaultHealthRecords);
      return defaultHealthRecords.map((record) => HealthRecordSchema.parse(record));
    }

    const records = await readJson(this.healthRecordsPath);
    return HealthRecordSchema.array().parse(records);
  }

  private async writeValidatedJson(path: string, backupPath: string, value: unknown): Promise<void> {
    await this.ensureDataDir();
    await this.backupExisting(path, backupPath);
    await writeJsonAtomic(path, value);
  }

  private async backupExisting(path: string, backupPath: string): Promise<void> {
    if (!(await pathExists(path))) {
      return;
    }

    await mkdir(this.backupsPath, { recursive: true });
    await copyFile(path, backupPath);
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  private async snapshotFiles(paths: string[]): Promise<FileSnapshot[]> {
    return Promise.all(paths.map((path) => snapshotFile(path)));
  }

  private async restoreSnapshots(snapshots: FileSnapshot[]): Promise<void> {
    await Promise.all(
      snapshots.map((snapshot) => {
        if (snapshot.existed) {
          return writeTextAtomic(snapshot.path, snapshot.contents);
        }

        return rm(snapshot.path, { force: true, recursive: true });
      })
    );
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextAtomic(path: string, contents: string): Promise<void> {
  const tempPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  await writeFile(tempPath, contents, "utf8");
  await rename(tempPath, path);
}

async function snapshotFile(path: string): Promise<FileSnapshot> {
  try {
    return {
      path,
      existed: true,
      contents: await readFile(path, "utf8")
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { path, existed: false };
    }

    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
