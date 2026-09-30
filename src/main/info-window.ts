import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createInfoWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 460,
    height: 580,
    frame: true,
    resizable: false,
    show: false,
    minimizable: false,
    maximizable: false,
    title: "뽁이 정보",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenu(null);
  win.on("close", (e) => { e.preventDefault(); win.hide(); });
  return win;
}
