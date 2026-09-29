import { app, ipcMain, screen } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPetWindow } from "./pet-window";
import { createBubbleWindow, bubbleSize } from "./bubble-window";
import { loadManifest } from "../shared/manifest";
import { DEFAULT_SETTINGS } from "../shared/types";
import { PetController } from "./pet-controller";
import { WalkDriver, displayContainingElectron, groundY } from "./screen-utils";

const characterDir = join(__dirname, "../../characters/poodle");

async function bootstrap() {
  const manifest = loadManifest(characterDir);
  const scale = DEFAULT_SETTINGS.spriteScale;
  const petSize = manifest.frameSize * scale;

  ipcMain.handle("sprite:get", () => ({
    manifestPath: pathToFileURL(join(characterDir, "manifest.json")).toString(),
    imagePath: pathToFileURL(join(characterDir, "sprite.png")).toString(),
    scale
  }));

  const win = createPetWindow(scale, manifest.frameSize);
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/pet/index.html"));
  }

  const bubble = createBubbleWindow();
  if (process.env.ELECTRON_RENDERER_URL) {
    bubble.loadURL(`${process.env.ELECTRON_RENDERER_URL}/bubble/index.html`);
  } else {
    bubble.loadFile(join(__dirname, "../renderer/bubble/index.html"));
  }

  const controller = new PetController();
  controller.onStateChange((s) => {
    win.webContents.send("pet:state", s);
    if (s === "idle") {
      const b = win.getBounds();
      const d = displayContainingElectron(screen, { x: b.x, y: b.y });
      Object.assign(walker, { x: b.x, minX: d.x, maxX: d.x + d.width - petSize });
      win.setBounds({ x: b.x, y: groundY(d, petSize), width: petSize, height: petSize });
    }
  });

  const initialBounds = win.getBounds();
  const disp = displayContainingElectron(screen, { x: initialBounds.x, y: initialBounds.y });
  const walker = new WalkDriver({
    x: initialBounds.x,
    direction: 1,
    speedPxPerSec: DEFAULT_SETTINGS.walkSpeedPxPerSec,
    minX: disp.x,
    maxX: disp.x + disp.width - petSize
  });

  let last = performance.now();
  const loop = setInterval(() => {
    const now = performance.now();
    const dt = now - last; last = now;

    controller.tick(now);
    const b = win.getBounds();
    const d = displayContainingElectron(screen, { x: b.x, y: b.y });
    const y = groundY(d, petSize);

    if (controller.state === "walk") {
      walker.tick(dt);
      win.setBounds({ x: Math.round(walker.x), y, width: petSize, height: petSize });
      win.webContents.send("pet:facing", walker.direction);
    } else if (
      controller.state === "idle" ||
      controller.state === "sit" ||
      controller.state === "sleep"
    ) {
      win.setBounds({ x: b.x, y, width: petSize, height: petSize });
    }
  }, 33); // ~30fps

  // drag state
  let dragAnchor: { winX: number; winY: number } | null = null;

  ipcMain.on("pet:action", (_, kind: "click" | "dragStart" | "dragEnd") => {
    if (kind === "dragStart" && !dragAnchor) {
      const b = win.getBounds();
      dragAnchor = { winX: b.x, winY: b.y };
    }
    if (kind === "dragEnd") dragAnchor = null;
    controller.notify(kind);
  });

  ipcMain.on("pet:dragMove", (_, delta: { dx: number; dy: number }) => {
    if (!dragAnchor) return;
    const newPos = { x: dragAnchor.winX + delta.dx, y: dragAnchor.winY + delta.dy };
    const newDisp = displayContainingElectron(screen, newPos);
    const clamped = {
      x: Math.max(newDisp.x, Math.min(newDisp.x + newDisp.width - petSize, newPos.x)),
      y: Math.max(newDisp.y, Math.min(newDisp.y + newDisp.height - petSize, newPos.y))
    };
    win.setBounds({ x: clamped.x, y: clamped.y, width: petSize, height: petSize });
  });

  ipcMain.on("bubble:open", (_, anchor: { x: number; y: number }) => {
    bubble.setBounds({
      x: anchor.x - Math.floor(bubbleSize.w / 2) + Math.floor(petSize / 2),
      y: anchor.y - bubbleSize.h - 8,
      width: bubbleSize.w,
      height: bubbleSize.h
    });
    bubble.showInactive();
  });

  ipcMain.on("bubble:choose", (_, a: "memo" | "launcher" | "sleep") => {
    bubble.hide();
    if (a === "sleep") controller.forceState("sleep");
    // memo / launcher: Task 9/11에서 확장
  });

  bubble.on("blur", () => bubble.hide());

  app.on("before-quit", () => clearInterval(loop));
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
