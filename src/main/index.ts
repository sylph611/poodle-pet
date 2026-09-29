import { app, ipcMain, protocol, net } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPetWindow } from "./pet-window";
import { loadManifest } from "../shared/manifest";
import { DEFAULT_SETTINGS } from "../shared/types";

const characterDir = join(__dirname, "../../characters/poodle");

async function bootstrap() {
  const manifest = loadManifest(characterDir);
  const scale = DEFAULT_SETTINGS.spriteScale;

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
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
