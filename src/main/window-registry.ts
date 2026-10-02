import { BrowserWindow } from "electron";
import { join } from "node:path";
import { createMemoWindow } from "./memo-window";
import { createLauncherWindow } from "./launcher-window";
import { createSettingsWindow } from "./settings-window";
import { createInfoWindow } from "./info-window";

let memoWin: BrowserWindow | null = null;
let launcherWin: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;
let infoWin: BrowserWindow | null = null;

let shuttingDown = false;

export function setShuttingDown(flag: boolean): void {
  shuttingDown = flag;
}

function loadInto(win: BrowserWindow, route: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${route}/index.html`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${route}/index.html`));
  }
}

export function ensureMemoWindow(): BrowserWindow {
  if (shuttingDown) throw new Error("app is shutting down");
  if (memoWin && !memoWin.isDestroyed()) return memoWin;
  memoWin = createMemoWindow();
  memoWin.on("closed", () => { memoWin = null; });
  loadInto(memoWin, "memo");
  return memoWin;
}

export function ensureLauncherWindow(): BrowserWindow {
  if (shuttingDown) throw new Error("app is shutting down");
  if (launcherWin && !launcherWin.isDestroyed()) return launcherWin;
  launcherWin = createLauncherWindow();
  launcherWin.on("closed", () => { launcherWin = null; });
  loadInto(launcherWin, "launcher");
  return launcherWin;
}

export function ensureSettingsWindow(): BrowserWindow {
  if (shuttingDown) throw new Error("app is shutting down");
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin;
  settingsWin = createSettingsWindow();
  settingsWin.on("closed", () => { settingsWin = null; });
  loadInto(settingsWin, "settings");
  return settingsWin;
}

export function ensureInfoWindow(): BrowserWindow {
  if (shuttingDown) throw new Error("app is shutting down");
  if (infoWin && !infoWin.isDestroyed()) return infoWin;
  infoWin = createInfoWindow();
  infoWin.on("closed", () => { infoWin = null; });
  loadInto(infoWin, "info");
  return infoWin;
}

export function destroyAllRegistered(): void {
  [memoWin, launcherWin, settingsWin, infoWin].forEach(w => {
    if (w && !w.isDestroyed()) w.destroy();
  });
  memoWin = launcherWin = settingsWin = infoWin = null;
}
