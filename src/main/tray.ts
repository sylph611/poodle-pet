import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { join } from "node:path";

export type TrayActions = {
  onQuit: () => void;
  onOpenSettings: () => void;
  onShowHelp: () => void;
};

export function createTray(
  pet: BrowserWindow,
  actions: TrayActions,
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
    { label: "설정", click: () => actions.onOpenSettings() },
    { label: "도움말", click: () => actions.onShowHelp() },
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
