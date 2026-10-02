import { BrowserWindow } from "electron";
import { join } from "node:path";

// bubble 창 크기 — 아래쪽 꼬리(::after 8px + margin)를 포함해야 잘리지 않음
// 버튼 4개 (memo, launcher, pomo, sleep) 수용
const W = 236, H = 72;

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
