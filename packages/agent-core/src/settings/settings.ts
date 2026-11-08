import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Value } from "typebox/value";
import { SettingsSchema, type Settings } from "./schema.js";

export async function getOrCreateDeviceId(path = "./state/settings.json"): Promise<string> {
  if (existsSync(path)) {
    const settings: unknown = JSON.parse(await readFile(path, "utf8"));
    Value.Assert(SettingsSchema, settings);
    return settings.deviceId;
  }

  const settings: Settings = { deviceId: randomUUID() };
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(settings), { mode: 0o600 });
  return settings.deviceId;
}
