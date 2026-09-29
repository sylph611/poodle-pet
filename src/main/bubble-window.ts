import { BrowserWindow } from "electron";
import { join } from "node:path";

const W = 180, H = 60;

export function createBubbleWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: W, height: H,
    frame: false, transparent: true, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    show: false, focusable: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}

export const bubbleSize = { w: W, h: H };
