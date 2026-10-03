import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

const W = 560, H = 360;

export function createPaletteWindow(): BrowserWindow {
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

/** 커서가 있는 디스플레이 중앙에 팔레트 위치시킴 */
export function positionPaletteAtCursor(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;
  win.setBounds({
    x: Math.round(x + (width - W) / 2),
    y: Math.round(y + height / 3),
    width: W, height: H
  });
}

export const paletteSize = { w: W, h: H };
