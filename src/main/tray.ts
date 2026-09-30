import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { join } from "node:path";

export function createTray(
  pet: BrowserWindow,
  onQuit: () => void,
  characterDir: string
): Tray {
  const iconPath = join(characterDir, "sprite.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    {
      label: "숨기기/보이기",
      click: () => (pet.isVisible() ? pet.hide() : pet.show())
    },
    { label: "설정 (준비 중)", enabled: false },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        onQuit();
        app.quit();
      }
    }
  ]);
  tray.setToolTip("뽁이");
  tray.setContextMenu(menu);
  return tray;
}
