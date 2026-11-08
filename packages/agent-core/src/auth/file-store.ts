import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Credential, CredentialStore } from "@earendil-works/pi-ai";
import { lock } from "proper-lockfile";

type Credentials = Record<string, Credential>;

export class FileCredentialStore implements CredentialStore {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  private async load(): Promise<Credentials> {
    return existsSync(this.path) ? JSON.parse(await readFile(this.path, "utf8")) : {};
  }

  async read(providerId: string): Promise<Credential | undefined> {
    return (await this.load())[providerId];
  }

  async list() {
    const credentials = await this.load();
    return Object.entries(credentials).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }));
  }

  async modify(
    providerId: string,
    update: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    return this.mutate(async (credentials) => {
      const current = credentials[providerId];
      const next = await update(current);
      if (next !== undefined) credentials[providerId] = next;
      return next ?? current;
    });
  }

  async delete(providerId: string): Promise<void> {
    await this.mutate((credentials) => delete credentials[providerId]);
  }

  // Locked read-modify-write so concurrent processes cannot double-refresh a rotated token.
  private async mutate<T>(update: (credentials: Credentials) => T | Promise<T>): Promise<T> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const release = await lock(this.path, { realpath: false, retries: 10 });
    try {
      const credentials = await this.load();
      const result = await update(credentials);
      // Write-then-rename so unlocked readers never see a partial file.
      await writeFile(`${this.path}.tmp`, JSON.stringify(credentials), { mode: 0o600 });
      await rename(`${this.path}.tmp`, this.path);
      return result;
    } finally {
      await release();
    }
  }
}
