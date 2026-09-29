import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

export function createPetWindow(scale: number, frameSize: number): BrowserWindow {
  const primary = screen.getPrimaryDisplay().workArea;
  const size = frameSize * scale;
  const win = new BrowserWindow({
    width: size,
    height: size,
    x: primary.x + Math.floor(primary.width / 2 - size / 2),
    y: primary.y + primary.height - size - 4,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}
