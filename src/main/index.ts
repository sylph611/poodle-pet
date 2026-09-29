import { app, ipcMain, screen } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPetWindow } from "./pet-window";
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

  const controller = new PetController();
  controller.onStateChange(s => win.webContents.send("pet:state", s));

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
    const y = groundY(disp, petSize);

    if (controller.state === "walk") {
      walker.tick(dt);
      win.setBounds({ x: Math.round(walker.x), y, width: petSize, height: petSize });
      win.webContents.send("pet:facing", walker.direction);
    } else if (
      controller.state === "idle" ||
      controller.state === "sit" ||
      controller.state === "sleep"
    ) {
      const b = win.getBounds();
      win.setBounds({ x: b.x, y, width: petSize, height: petSize });
    }
  }, 33); // ~30fps

  app.on("before-quit", () => clearInterval(loop));
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
