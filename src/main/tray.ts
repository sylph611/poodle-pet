import { app, Tray, Menu, nativeImage, BrowserWindow, NativeImage } from "electron";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { Phase } from "./pomodoro-controller";

export type TrayActions = {
  onQuit: () => void;
  onOpenSettings: () => void;
  onShowHelp: () => void;
  onShowAbout: () => void;
  onCheckUpdate: () => void;
  onPomoStart: () => void;
  onPomoStop: () => void;
  // Tray 메뉴 rebuild 시 최신 포모도로 상태를 알기 위한 getter (circular import 회피)
  getPomoState: () => { phase: Phase; remainingMs: number };
};

function loadTrayIcon(characterDir: string): NativeImage {
  // 1순위: characters/poodle/tray-icon.png (사용자가 정면 얼굴 등 별도로 넣은 파일)
  // 원본을 그대로 반환 — Windows Shell이 트레이 슬롯 크기에 맞춰 자동 스케일링.
  // (수동 resize는 큰 이미지→작은 크기 다운스케일에서 bilinear로 뭉개짐)
  const customPath = join(characterDir, "tray-icon.png");
  if (existsSync(customPath)) {
    const custom = nativeImage.createFromPath(customPath);
    if (!custom.isEmpty()) return custom;
  }

  // 2순위: sprite.png 첫 idle 프레임에서 실루엣 bbox만 tight crop
  const manifest = JSON.parse(readFileSync(join(characterDir, "manifest.json"), "utf8")) as {
    frameSize: number;
    animations: Record<string, { row: number; frames: number; fps: number }>;
  };
  const f = manifest.frameSize;
  const idleRow = manifest.animations.idle?.row ?? 0;
  const sheet = nativeImage.createFromPath(join(characterDir, "sprite.png"));
  const idleFrame = sheet.crop({ x: 0, y: idleRow * f, width: f, height: f });

  const bmp = idleFrame.toBitmap();
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
  const cropped = maxX >= 0
    ? idleFrame.crop({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    : idleFrame;
  return cropped.resize({ width: 48, height: 48, quality: "best" });
}

function formatMMSS(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pomoLabel(phase: Phase, remainingMs: number): string {
  if (phase === "idle") return "⏱ 포모도로 시작";
  const kind = phase === "focus" ? "집중" : "휴식";
  return `⏱ 포모도로 중지 (${kind} ${formatMMSS(remainingMs)})`;
}

export function createTray(
  pet: BrowserWindow,
  actions: TrayActions,
  characterDir: string
): Tray {
  const icon = loadTrayIcon(characterDir);
  const tray = new Tray(icon);
  tray.setToolTip("뽁이");

  function buildMenu(): Menu {
    const { phase, remainingMs } = actions.getPomoState();
    const remaining = remainingMs;
    return Menu.buildFromTemplate([
      { label: "숨기기/보이기", click: () => (pet.isVisible() ? pet.hide() : pet.show()) },
      {
        label: pomoLabel(phase, remaining),
        click: () => {
          if (phase === "idle") actions.onPomoStart();
          else actions.onPomoStop();
        }
      },
      { label: "설정", click: () => actions.onOpenSettings() },
      { label: "도움말", click: () => actions.onShowHelp() },
      { label: "업데이트 확인", click: () => actions.onCheckUpdate() },
      { label: "뽁이에 대해…", click: () => actions.onShowAbout() },
      { type: "separator" },
      {
        label: "종료",
        click: () => { actions.onQuit(); app.quit(); }
      }
    ]);
  }

  // 좌/우 클릭 모두 rebuild해서 띄움
  function openMenu() {
    if (tray.isDestroyed()) return;
    tray.popUpContextMenu(buildMenu());
  }
  tray.on("right-click", openMenu);
  tray.on("click", openMenu);

  // 초기 ContextMenu도 set (유저가 트레이에 호버 시 이름 표시 등)
  tray.setContextMenu(buildMenu());

  return tray;
}
