import { app, ipcMain, screen, BrowserWindow, globalShortcut, dialog } from "electron";
import { join } from "node:path";
import { readFileSync } from "node:fs";
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
import { WalkDriver, displayContainingElectron, displayBoundsContainingElectron, groundY, recoverPosition } from "./screen-utils";
import { createTray } from "./tray";
import { Store, runDailyBackup, settingsStore } from "./store";
import { registerQuickMemo } from "./shortcuts";

const characterDir = join(__dirname, "../../characters/poodle");

// Single instance lock (skip in e2e test mode to allow restart within same userData)
if (!process.env.E2E_TEST) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    process.exit(0);
  }
}

let currentPetWindow: BrowserWindow | null = null;
let isShuttingDown = false;

function petWindowAlive(): BrowserWindow | null {
  if (isShuttingDown) return null;
  const w = currentPetWindow;
  if (!w || w.isDestroyed() || w.webContents.isDestroyed()) return null;
  return w;
}

app.on("second-instance", () => {
  const w = petWindowAlive();
  if (!w) return;
  w.show();
  w.webContents.send("pet:state", "happy");
  setTimeout(() => {
    const w2 = petWindowAlive();
    if (w2) w2.webContents.send("pet:state", "idle");
  }, 1200);
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

  ipcMain.handle("sprite:get", () => {
    const manifestJson = JSON.parse(readFileSync(join(characterDir, "manifest.json"), "utf8"));
    const imageBytes = readFileSync(join(characterDir, "sprite.png"));
    return {
      manifest: manifestJson,
      imageDataUrl: `data:image/png;base64,${imageBytes.toString("base64")}`,
      scale
    };
  });

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
    const arr = ids.flatMap((id, i) => {
      const entry = map.get(id);
      return entry ? [{ ...entry, order: i }] : [];
    });
    launchersStore.save(arr);
  });

  ipcMain.handle("launchers:open", async (_, id: string) => {
    const l = launchersStore.load().find(x => x.id === id);
    if (!l) return { ok: false, error: "not found" };
    const r = await openLauncher(l);
    if (!r.ok && petWindowAlive()) {
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
    if (petWindowAlive()) {
      win.webContents.send("pet:toast", { text: `바로가기 ${added.length}개 추가!`, ms: 1500 });
    }
    return added.length;
  });

  ipcMain.handle("memos:list", () => sortMemos(memosStore.load()));
  ipcMain.handle("memos:add", (_, payload: { text: string }) => {
    const now = new Date().toISOString();
    const m: Memo = { id: randomUUID(), text: payload.text, pinned: false, createdAt: now, updatedAt: now };
    const arr = memosStore.load(); arr.push(m); memosStore.save(arr);
    if (petWindowAlive()) {
      win.webContents.send("pet:toast", { text: "기억했어요!", ms: 1500 });
      controller.notify("click"); // happy 반응
    }
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
    if (!petWindowAlive()) return;
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
  const onDisplayChange = () => attemptRecover();
  screen.on("display-metrics-changed", onDisplayChange);
  screen.on("display-removed", onDisplayChange);
  function attemptRecover() {
    if (!petWindowAlive()) return;
    const b = win.getBounds();
    const displays = screen.getAllDisplays().map(d => d.workArea);
    const r = recoverPosition({ x: b.x, y: b.y }, { w: petSize, h: petSize }, displays);
    win.setBounds({ x: r.x, y: r.y, width: petSize, height: petSize });
  }

  // Gravity for fall state (px/s²) — cartoony 낙하 속도
  const GRAVITY = 1800;
  let fallVy = 0;
  let prevState: string = controller.state;

  let last = performance.now();
  const loop = setInterval(() => {
    if (!petWindowAlive()) return;
    const now = performance.now();
    const dt = now - last; last = now;

    controller.tick(now);
    const b = win.getBounds();
    const d = displayContainingElectron(screen, { x: b.x, y: b.y });
    const groundYNow = groundY(d, petSize);

    // fall 진입 감지 → 낙하 속도 리셋
    if (controller.state === "fall" && prevState !== "fall") fallVy = 0;
    prevState = controller.state;

    if (controller.state === "walk") {
      walker.tick(dt);
      win.setBounds({ x: Math.round(walker.x), y: groundYNow, width: petSize, height: petSize });
      win.webContents.send("pet:facing", walker.direction);
    } else if (controller.state === "fall") {
      // 중력 물리로 낙하. 착지하면 forceState("idle").
      fallVy += GRAVITY * (dt / 1000);
      const newY = b.y + fallVy * (dt / 1000);
      if (newY >= groundYNow) {
        win.setBounds({ x: b.x, y: groundYNow, width: petSize, height: petSize });
        fallVy = 0;
        controller.forceState("idle");
      } else {
        win.setBounds({ x: b.x, y: Math.round(newY), width: petSize, height: petSize });
      }
    } else if (
      controller.state === "idle" ||
      controller.state === "sit" ||
      controller.state === "sleep"
    ) {
      win.setBounds({ x: b.x, y: groundYNow, width: petSize, height: petSize });
    }
  }, 33); // ~30fps

  // Create tray
  const tray = createTray(win, () => clearInterval(loop), characterDir);

  // Register global shortcut for quick memo
  const settings = settingsStore.load();
  const res = registerQuickMemo(settings.shortcutQuickMemo, () => {
    if (!memoWin.isDestroyed()) { memoWin.show(); memoWin.focus(); }
    if (petWindowAlive()) {
      win.webContents.send("pet:toast", { text: "빠른 메모 열었어요!", ms: 1200 });
    }
  });
  if (!res.ok) tray.displayBalloon?.({ title: "단축키 충돌", content: `${settings.shortcutQuickMemo}: ${res.error}` });

  // Fullscreen auto-hide polling
  let fullscreenInterval: NodeJS.Timeout | null = null;
  if (DEFAULT_SETTINGS.hideOnFullscreen) {
    fullscreenInterval = setInterval(() => {
      if (!petWindowAlive()) return;
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
  // bubble state — 재클릭 토글용 잠금 창 + 드래그 중 자동 hide 억제 플래그
  let ignoreBubbleOpenUntil = 0;
  let isDragging = false;
  // blur가 즉시 hide하지 않고 100ms 유예 — 그 안에 dragStart 감지되면 hide 취소
  let blurHideTimer: NodeJS.Timeout | null = null;

  function positionBubbleAbovePet() {
    if (!petWindowAlive() || bubble.isDestroyed()) return;
    const b = win.getBounds();
    bubble.setBounds({
      x: b.x - Math.floor(bubbleSize.w / 2) + Math.floor(petSize / 2),
      y: b.y - bubbleSize.h - 8,
      width: bubbleSize.w,
      height: bubbleSize.h
    });
  }

  ipcMain.on("pet:action", (_, kind: "click" | "dragStart" | "dragEnd") => {
    if (kind === "dragStart" && !dragAnchor) {
      const b = win.getBounds();
      dragAnchor = { winX: b.x, winY: b.y };
      isDragging = true;
      // 드래그 시작 감지 → 예약된 bubble hide 취소 (드래그 중 유지)
      if (blurHideTimer) { clearTimeout(blurHideTimer); blurHideTimer = null; }
    }
    if (kind === "dragEnd") {
      dragAnchor = null;
      isDragging = false;
    }
    controller.notify(kind);
  });

  ipcMain.on("pet:dragMove", (_, delta: { dx: number; dy: number }) => {
    if (!dragAnchor) return;
    const newPos = { x: dragAnchor.winX + delta.dx, y: dragAnchor.winY + delta.dy };
    // 드래그 중에는 workArea가 아닌 display.bounds(태스크바 포함 전체 화면)로 클램프.
    // 커서가 태스크바 영역에 들어가도 강아지가 따라가서 이탈 방지. 놓으면 중력으로 groundY 착지.
    const disp = displayBoundsContainingElectron(screen, newPos);
    const clamped = {
      x: Math.max(disp.x, Math.min(disp.x + disp.width - petSize, newPos.x)),
      y: Math.max(disp.y, Math.min(disp.y + disp.height - petSize, newPos.y))
    };
    win.setBounds({ x: clamped.x, y: clamped.y, width: petSize, height: petSize });
    // bubble이 열려있으면 pet 위치 따라 같이 이동
    if (bubble.isVisible()) positionBubbleAbovePet();
  });

  ipcMain.on("bubble:open", (_, _anchor: { x: number; y: number }) => {
    if (isShuttingDown) return;
    // 재클릭 토글 잠금 (blur 직후 openBubble이 도착하면 무시)
    if (Date.now() < ignoreBubbleOpenUntil) return;
    // 이미 열려있으면 닫기 (토글)
    if (bubble.isVisible()) {
      bubble.hide();
      return;
    }
    positionBubbleAbovePet();
    bubble.show(); // focus를 잡아서 외부 클릭 시 blur → hide
  });

  ipcMain.on("bubble:choose", (_, a: "memo" | "launcher" | "sleep") => {
    if (isShuttingDown) return;
    if (!bubble.isDestroyed()) bubble.hide();
    if (a === "memo" && !memoWin.isDestroyed()) { memoWin.show(); memoWin.focus(); }
    if (a === "launcher" && !launcherWin.isDestroyed()) { launcherWin.show(); launcherWin.focus(); }
    if (a === "sleep") controller.forceState("sleep");
  });

  bubble.on("blur", () => {
    if (bubble.isDestroyed() || !bubble.isVisible()) return;
    if (isDragging) return;
    // 100ms 유예 — 그 안에 dragStart 도착하면 hide 취소되어 bubble이 드래그 따라옴
    if (blurHideTimer) clearTimeout(blurHideTimer);
    blurHideTimer = setTimeout(() => {
      blurHideTimer = null;
      if (bubble.isDestroyed() || !bubble.isVisible()) return;
      bubble.hide();
      // pet 재클릭이 blur → openBubble 순으로 도착하는 레이스 방지
      ignoreBubbleOpenUntil = Date.now() + 200;
    }, 100);
  });

  app.on("before-quit", () => {
    isShuttingDown = true;
    clearInterval(loop);
    if (fullscreenInterval) clearInterval(fullscreenInterval);
    screen.removeListener("display-metrics-changed", onDisplayChange);
    screen.removeListener("display-removed", onDisplayChange);
    // Force-destroy all windows so app.quit() isn't blocked by close event prevention
    BrowserWindow.getAllWindows().forEach(w => w.destroy());
    currentPetWindow = null;
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
