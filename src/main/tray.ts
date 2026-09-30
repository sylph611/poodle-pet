import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { join } from "node:path";
import { readFileSync } from "node:fs";

export type TrayActions = {
  onQuit: () => void;
  onOpenSettings: () => void;
  onShowHelp: () => void;
  onShowAbout: () => void;
};

export function createTray(
  pet: BrowserWindow,
  actions: TrayActions,
  characterDir: string
): Tray {
  // 스프라이트 시트(192×192 = 6×6 격자)를 그대로 축소하면 뭉개진다.
  // manifest에서 idle 행/frameSize 읽고 첫 프레임(top-left 32×32)만 crop 후 리사이즈.
  const manifest = JSON.parse(readFileSync(join(characterDir, "manifest.json"), "utf8")) as {
    frameSize: number;
    animations: Record<string, { row: number; frames: number; fps: number }>;
  };
  const f = manifest.frameSize;
  const idleRow = manifest.animations.idle?.row ?? 0;
  const sheet = nativeImage.createFromPath(join(characterDir, "sprite.png"));
  const idleFrame = sheet.crop({ x: 0, y: idleRow * f, width: f, height: f });
  // Windows 트레이는 16 or 32px. 32로 하면 hi-DPI 스케일에서도 선명.
  const icon = idleFrame.resize({ width: 32, height: 32, quality: "good" });
  const tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    {
      label: "숨기기/보이기",
      click: () => (pet.isVisible() ? pet.hide() : pet.show())
    },
    { label: "설정", click: () => actions.onOpenSettings() },
    { label: "도움말", click: () => actions.onShowHelp() },
    { label: "뽁이에 대해…", click: () => actions.onShowAbout() },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        actions.onQuit();
        app.quit();
      }
    }
  ]);
  tray.setToolTip("뽁이");
  tray.setContextMenu(menu);
  return tray;
}
