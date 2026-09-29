import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createMemoWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360, height: 480,
    frame: true, resizable: true,
    show: false, skipTaskbar: false, title: "메모 - Poodle Pet",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.setMenu(null);
  win.on("close", (e) => { e.preventDefault(); win.hide(); });
  return win;
}
