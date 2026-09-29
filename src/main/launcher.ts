import { app, shell } from "electron";
import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { Launcher } from "../shared/types";

export async function iconDataUrl(l: Launcher): Promise<string | null> {
  if (l.type === "url") return null;
  if (!existsSync(l.target)) return null;
  const icon = await app.getFileIcon(l.target, { size: "small" });
  return icon.toDataURL();
}

export function classify(target: string): Launcher["type"] {
  if (/^https?:\/\//i.test(target)) return "url";
  if (!existsSync(target)) return "file";
  return statSync(target).isDirectory() ? "folder" : "file";
}

export function inferName(target: string, type: Launcher["type"]): string {
  if (type === "url") return target.replace(/^https?:\/\//i, "").split("/")[0];
  return basename(target);
}

export async function open(l: Launcher): Promise<{ ok: boolean; error?: string }> {
  if (l.type === "url") { await shell.openExternal(l.target); return { ok: true }; }
  if (!existsSync(l.target)) return { ok: false, error: "not found" };
  const err = await shell.openPath(l.target);
  return err ? { ok: false, error: err } : { ok: true };
}
