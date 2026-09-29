import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { filePath, backupDir, userDataRoot } from "./paths";

export class Store<T> {
  constructor(private name: string, private defaults: T) {}

  private path() { return filePath(this.name); }

  load(): T {
    const p = this.path();
    if (!existsSync(p)) return structuredClone(this.defaults);
    try {
      return JSON.parse(readFileSync(p, "utf8")) as T;
    } catch {
      const iso = new Date().toISOString().replace(/[-:T.Z]/g, "");
      const ts = iso.slice(0, 8) + "-" + iso.slice(8, 14);
      const brokenName = `${this.name.replace(/\.json$/, "")}.broken-${ts}.json`;
      renameSync(p, filePath(brokenName));
      return structuredClone(this.defaults);
    }
  }

  save(data: T): void {
    const p = this.path();
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, p);
  }
}

export function runDailyBackup(names: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const dir = join(backupDir(), today);
  if (existsSync(dir)) return;
  mkdirSync(dir, { recursive: true });
  for (const n of names) {
    const src = filePath(n);
    if (existsSync(src)) cpSync(src, join(dir, n));
  }
  pruneBackups(7);
}

function pruneBackups(keep: number) {
  const root = backupDir();
  if (!existsSync(root)) return;
  const entries = readdirSync(root).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  const excess = entries.slice(0, Math.max(0, entries.length - keep));
  for (const e of excess) rmSync(join(root, e), { recursive: true, force: true });
}

import type { Memo, Launcher, Settings } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";

export const memosStore = new Store<Memo[]>("memos.json", []);
export const launchersStore = new Store<Launcher[]>("launchers.json", []);
export const settingsStore = new Store<Settings>("settings.json", DEFAULT_SETTINGS);
