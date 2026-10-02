import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createLauncherWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320, height: 420,
    frame: true, resizable: true, show: false, title: "바로가기 · 뽁이",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenu(null);
  return win;
}
