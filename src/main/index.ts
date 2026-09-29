import { app, ipcMain, screen, BrowserWindow, globalShortcut, dialog } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createPetWindow } from "./pet-window";
import { createBubbleWindow, bubbleSize } from "./bubble-window";
import { createMemoWindow } from "./memo-window";
import { createLauncherWindow } from "./launcher-window";
import { classify, inferName, open as openLauncher, iconDataUrl } from "./launcher";
import { loadManifest } from "../shared/manifest";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { Memo, Launcher } from "../shared/types";
import { PetController } from "./pet-controller";
import { WalkDriver, displayContainingElectron, groundY, recoverPosition } from "./screen-utils";
import { createTray } from "./tray";
import { Store, runDailyBackup, settingsStore } from "./store";
import { registerQuickMemo } from "./shortcuts";

const characterDir = join(__dirname, "../../characters/poodle");

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let currentPetWindow: BrowserWindow | null = null;

app.on("second-instance", () => {
  if (currentPetWindow) {
    currentPetWindow.show();
    currentPetWindow.webContents.send("pet:state", "happy");
    setTimeout(() => currentPetWindow?.webContents.send("pet:state", "idle"), 1200);
  }
});

function sortMemos(arr: Memo[]): Memo[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

async function bootstrap() {
  const manifest = loadManifest(characterDir);
  const scale = DEFAULT_SETTINGS.spriteScale;
  const petSize = manifest.frameSize * scale;

  const memosStore = new Store<Memo[]>("memos.json", []);
  const launchersStore = new Store<Launcher[]>("launchers.json", []);
  runDailyBackup(["memos.json", "launchers.json", "settings.json"]);

  ipcMain.handle("sprite:get", () => ({
    manifestPath: pathToFileURL(join(characterDir, "manifest.json")).toString(),
    imagePath: pathToFileURL(join(characterDir, "sprite.png")).toString(),
    scale
  }));

  const win = createPetWindow(scale, manifest.frameSize);
  currentPetWindow = win;
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

  const memoWin = createMemoWindow();
  if (process.env.ELECTRON_RENDERER_URL) {
    memoWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}/memo/index.html`);
  } else {
    memoWin.loadFile(join(__dirname, "../renderer/memo/index.html"));
  }

  const launcherWin = createLauncherWindow();
  if (process.env.ELECTRON_RENDERER_URL) {
    launcherWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}/launcher/index.html`);
  } else {
    launcherWin.loadFile(join(__dirname, "../renderer/launcher/index.html"));
  }

  // Launchers helpers
  function sortLaunchers(a: Launcher[]) { return [...a].sort((x, y) => x.order - y.order); }

  ipcMain.handle("launchers:list", () => sortLaunchers(launchersStore.load()));

  ipcMain.handle("launchers:add", (_, payload: { name?: string; type?: Launcher["type"]; target: string }) => {
    const type = payload.type ?? classify(payload.target);
    const name = payload.name ?? inferName(payload.target, type);
    const arr = launchersStore.load();
    const order = arr.length ? Math.max(...arr.map(x => x.order)) + 1 : 0;
    const l: Launcher = { id: randomUUID(), name, type, target: payload.target, order };
    arr.push(l); launchersStore.save(arr);
    return l;
  });

  ipcMain.handle("launchers:remove", (_, id: string) => {
    launchersStore.save(launchersStore.load().filter(x => x.id !== id));
  });

  ipcMain.handle("launchers:reorder", (_, ids: string[]) => {
    const map = new Map(launchersStore.load().map(x => [x.id, x]));
    const arr = ids.map((id, i) => ({ ...(map.get(id)!), order: i }));
    launchersStore.save(arr);
  });

  ipcMain.handle("launchers:open", async (_, id: string) => {
    const l = launchersStore.load().find(x => x.id === id);
    if (!l) return { ok: false, error: "not found" };
    const r = await openLauncher(l);
    if (!r.ok) {
      win.webContents.send("pet:toast", { text: "앗, 못 찾겠어요 🥺", ms: 2000 });
    }
    return r;
  });

  ipcMain.handle("launchers:iconFor", async (_, id: string) => {
    const l = launchersStore.load().find(x => x.id === id);
    if (!l) return null;
    return iconDataUrl(l);
  });

  ipcMain.handle("launchers:pickFile", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile"] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle("pet:dropFiles", (_, paths: string[]) => {
    const now = launchersStore.load();
    let order = now.length ? Math.max(...now.map(x => x.order)) + 1 : 0;
    const added: Launcher[] = [];
    for (const p of paths) {
      const type = classify(p);
      added.push({ id: randomUUID(), name: inferName(p, type), type, target: p, order: order++ });
    }
    launchersStore.save([...now, ...added]);
    win.webContents.send("pet:toast", { text: `바로가기 ${added.length}개 추가!`, ms: 1500 });
    return added.length;
  });

  ipcMain.handle("memos:list", () => sortMemos(memosStore.load()));
  ipcMain.handle("memos:add", (_, payload: { text: string }) => {
    const now = new Date().toISOString();
    const m: Memo = { id: randomUUID(), text: payload.text, pinned: false, createdAt: now, updatedAt: now };
    const arr = memosStore.load(); arr.push(m); memosStore.save(arr);
    win.webContents.send("pet:toast", { text: "기억했어요!", ms: 1500 });
    controller.notify("click"); // happy 반응
    return m;
  });
  ipcMain.handle("memos:update", (_, id: string, patch: Partial<Pick<Memo, "text" | "pinned">>) => {
    const arr = memosStore.load();
    const idx = arr.findIndex(x => x.id === id);
    if (idx < 0) throw new Error("not found");
    arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
    memosStore.save(arr);
    return arr[idx];
  });
  ipcMain.handle("memos:remove", (_, id: string) => {
    memosStore.save(memosStore.load().filter(x => x.id !== id));
  });
  ipcMain.handle("memos:search", (_, q: string) => {
    const needle = q.toLowerCase();
    return sortMemos(memosStore.load().filter(m => m.text.toLowerCase().includes(needle)));
  });

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

  // Display recovery when monitor configuration changes
  screen.on("display-metrics-changed", () => attemptRecover());
  screen.on("display-removed", () => attemptRecover());
  function attemptRecover() {
    const b = win.getBounds();
    const displays = screen.getAllDisplays().map(d => d.workArea);
    const r = recoverPosition({ x: b.x, y: b.y }, { w: petSize, h: petSize }, displays);
    win.setBounds({ x: r.x, y: r.y, width: petSize, height: petSize });
  }

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

  // Create tray
  const tray = createTray(win, () => clearInterval(loop), characterDir);

  // Register global shortcut for quick memo
  const settings = settingsStore.load();
  const res = registerQuickMemo(settings.shortcutQuickMemo, () => {
    memoWin.show(); memoWin.focus();
    win.webContents.send("pet:toast", { text: "빠른 메모 열었어요!", ms: 1200 });
  });
  if (!res.ok) tray.displayBalloon?.({ title: "단축키 충돌", content: `${settings.shortcutQuickMemo}: ${res.error}` });

  // Fullscreen auto-hide polling
  let fullscreenInterval: NodeJS.Timeout | null = null;
  if (DEFAULT_SETTINGS.hideOnFullscreen) {
    fullscreenInterval = setInterval(() => {
      const primary = screen.getPrimaryDisplay();
      const isFullscreen =
        primary.bounds.height === primary.workAreaSize.height &&
        primary.bounds.width === primary.workAreaSize.width;
      if (isFullscreen && win.isVisible()) win.hide();
      if (!isFullscreen && !win.isVisible()) win.show();
    }, 5000);
  }

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
    if (a === "memo") { memoWin.show(); memoWin.focus(); }
    if (a === "launcher") { launcherWin.show(); launcherWin.focus(); }
    if (a === "sleep") controller.forceState("sleep");
  });

  bubble.on("blur", () => bubble.hide());

  app.on("before-quit", () => {
    clearInterval(loop);
    if (fullscreenInterval) clearInterval(fullscreenInterval);
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
