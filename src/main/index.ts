import { app, BrowserWindow } from "electron";
import { join } from "node:path";

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 400,
    height: 200,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/pet/index.html"));
  }
});

app.on("window-all-closed", () => app.quit());
