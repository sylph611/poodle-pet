import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 440,
    height: 780,
    frame: true,
    resizable: true,
    show: false,
    title: "설정 · 뽁이",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenu(null);
  return win;
}
