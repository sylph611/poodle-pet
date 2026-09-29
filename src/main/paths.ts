import { join } from "node:path";

let overrideRoot: string | null = null;

export function setUserDataRootForTest(root: string | null) {
  overrideRoot = root;
}

export function userDataRoot(): string {
  if (overrideRoot) return overrideRoot;
  // lazy import so Node-only tests (with overrideRoot set) never touch electron
  const { app } = require("electron");
  return app.getPath("userData");
}

export const filePath = (name: string) => join(userDataRoot(), name);
export const backupDir = () => join(userDataRoot(), "backup");
