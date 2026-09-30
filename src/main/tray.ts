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
  // 스프라이트 첫 idle 프레임 → 강아지 실제 bounding box만 tight crop → 확대.
  // 32×32 프레임 안에 강아지가 실제로는 ~20×18 정도만 차지해서 리사이즈만 하면 작아 보임.
  const manifest = JSON.parse(readFileSync(join(characterDir, "manifest.json"), "utf8")) as {
    frameSize: number;
    animations: Record<string, { row: number; frames: number; fps: number }>;
  };
  const f = manifest.frameSize;
  const idleRow = manifest.animations.idle?.row ?? 0;
  const sheet = nativeImage.createFromPath(join(characterDir, "sprite.png"));
  const idleFrame = sheet.crop({ x: 0, y: idleRow * f, width: f, height: f });

  // 실루엣 bbox 찾기 (alpha > 32)
  const bmp = idleFrame.toBitmap(); // BGRA on Windows
  const sz = idleFrame.getSize();
  let minX = sz.width, maxX = -1, minY = sz.height, maxY = -1;
  for (let y = 0; y < sz.height; y++) {
    for (let x = 0; x < sz.width; x++) {
      const a = bmp[(y * sz.width + x) * 4 + 3];
      if (a > 32) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // bbox이 유효하면 tight crop, 아니면 원본 프레임 사용
  const cropped = maxX >= 0
    ? idleFrame.crop({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    : idleFrame;
  // 48×48로 확대 (하이 DPI 스케일링 대비 · Windows 트레이는 자동으로 적절 크기 선택)
  const icon = cropped.resize({ width: 48, height: 48, quality: "best" });
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
