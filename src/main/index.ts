import { app, ipcMain, screen, BrowserWindow, globalShortcut, dialog, shell } from "electron";
import electronUpdaterPkg from "electron-updater";
const { autoUpdater } = electronUpdaterPkg;
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createPetWindow } from "./pet-window";
import { createBubbleWindow, bubbleSize } from "./bubble-window";
import {
  ensureMemoWindow,
  ensureLauncherWindow,
  ensureSettingsWindow,
  ensureInfoWindow,
  destroyAllRegistered,
  setShuttingDown
} from "./window-registry";
import { classify, inferName, open as openLauncher, iconDataUrl } from "./launcher";
import { loadManifest } from "../shared/manifest";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { Memo, Launcher, Settings } from "../shared/types";
import { PetController } from "./pet-controller";
import { PomodoroController } from "./pomodoro-controller";
import type { Phase } from "./pomodoro-controller";
import { WalkDriver, displayContainingElectron, groundY, recoverPosition } from "./screen-utils";
import { createTray } from "./tray";
import { Store, runDailyBackup, settingsStore, ClipboardHistoryStore } from "./store";
import { registerPalette } from "./shortcuts";
import { userDataRoot, filePath } from "./paths";
import { createPaletteWindow, positionPaletteAtCursor } from "./palette-window";
import { ClipboardWatcher } from "./clipboard-watcher";
import { clipboard as electronClipboard } from "electron";

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
  // 스프라이트 크기는 설정에서 hot-swap 되도록 let
  let petSize = manifest.frameSize * scale;

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

  // ─── 팔레트 창 (lazy) ───
  let paletteWin: BrowserWindow | null = null;
  function ensurePaletteWindow(): BrowserWindow {
    if (isShuttingDown) throw new Error("cannot create palette during shutdown");
    if (paletteWin && !paletteWin.isDestroyed()) return paletteWin;
    const win = createPaletteWindow();
    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/palette/index.html`);
    } else {
      win.loadFile(join(__dirname, "../renderer/palette/index.html"));
    }
    win.on("blur", () => {
      if (!win.isDestroyed() && win.isVisible()) win.hide();
    });
    win.on("closed", () => { paletteWin = null; });
    paletteWin = win;
    return win;
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

  // Adaptive tick — 걷기/낙하만 30fps, 나머지는 절전 모드
  let last = performance.now();
  let loopStopped = false;
  function tickInterval(): number {
    const s = controller.state;
    if (s === "walk" || s === "fall" || s === "drag") return 33;  // ~30fps
    if (s === "sleep") return 500;                                  // 절전
    return 120;                                                     // idle/sit/happy 등
  }
  function tick() {
    if (!petWindowAlive()) return;
    const now = performance.now();
    // 큰 dt(오래 자다가 깨어난 첫 tick 등)는 시각 점프 방지 위해 50ms로 클램프
    const dt = Math.min(50, now - last);
    last = now;

    controller.tick(now);
    const b = win.getBounds();
    const d = displayContainingElectron(screen, { x: b.x, y: b.y });
    const groundYNow = groundY(d, petSize);

    if (controller.state === "fall" && prevState !== "fall") fallVy = 0;
    prevState = controller.state;

    if (controller.state === "walk") {
      walker.tick(dt);
      win.setBounds({ x: Math.round(walker.x), y: groundYNow, width: petSize, height: petSize });
      win.webContents.send("pet:facing", walker.direction);
    } else if (controller.state === "fall") {
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
  }
  function scheduleLoop() {
    if (loopStopped) return;
    setTimeout(() => { tick(); scheduleLoop(); }, tickInterval());
  }
  scheduleLoop();
  const loop = { stop: () => { loopStopped = true; } };

  // ─── Settings 로드 및 Reactive 갱신 ───
  const settingsPath = filePath("settings.json");
  const isFirstRun = !existsSync(settingsPath);
  let settings = { ...DEFAULT_SETTINGS, ...settingsStore.load() };
  // 저장 (기본값 병합된 상태로)
  settingsStore.save(settings);

  // ─── ClipboardStore + Watcher ───
  const clipboardStore = new ClipboardHistoryStore(() => settings.clipboardMaxEntries);
  const clipboardWatcher = new ClipboardWatcher(clipboardStore, {
    readText: () => electronClipboard.readText()
  });
  if (settings.clipboardCaptureEnabled) clipboardWatcher.start();

  // ─── PomodoroController ───
  const pomo = new PomodoroController({
    focusMs: settings.pomodoroFocusMin * 60_000,
    breakMs: settings.pomodoroBreakMin * 60_000
  });

  let suppressIdleToast = false;
  function pomoStopManual() {
    // suppressIdleToast는 pomo.stop() → onPhaseChange 콜백이 동기 완료됨에 의존
    // (PomodoroController.transitionTo 동기). 콜백이 비동기화되면 Promise 체인으로 대체 필요.
    suppressIdleToast = true;
    pomo.stop();
    suppressIdleToast = false;
  }

  if (process.env.E2E_TEST) {
    ipcMain.handle("_e2e:pomoStart", () => { pomo.start(); });
  }

  pomo.onPhaseChange((phase: Phase, remainingMs: number) => {
    // 1) PetController 집중 잠금
    if (phase === "focus") controller.setFocusLock(true);
    else controller.setFocusLock(false);

    // 2) 토스트 알림
    if (phase === "break" && petWindowAlive()) {
      win.webContents.send("pet:toast", { text: "집중 끝! 5분 쉬어요 🍵", ms: 2000 });
    } else if (phase === "idle" && !suppressIdleToast && petWindowAlive()) {
      win.webContents.send("pet:toast", { text: "다시 집중할까요? ☕", ms: 2000 });
    }

    // 3) 배지 IPC
    if (phase === "idle") {
      if (petWindowAlive()) win.webContents.send("pet:pomoHide");
    } else {
      if (petWindowAlive()) {
        win.webContents.send("pet:pomoBadge", {
          phase,
          remainingSec: Math.ceil(remainingMs / 1000)
        });
      }
    }
  });

  const pomoTickInterval = setInterval(() => {
    if (isShuttingDown) return;
    pomo.tick(performance.now());
    if (pomo.phase !== "idle" && petWindowAlive()) {
      win.webContents.send("pet:pomoBadge", {
        phase: pomo.phase,
        remainingSec: Math.ceil(pomo.remainingMs / 1000)
      });
    }
  }, 1000);

  function showInfoWindow(section: "help" | "about") {
    if (isShuttingDown) return;
    const w = ensureInfoWindow();
    w.show();
    w.focus();
    w.webContents.send("info:show", section);
  }
  const showAboutDialog = () => showInfoWindow("about");
  const showHelpDialog = () => showInfoWindow("help");

  // 재사용 가능한 shortcut 재등록
  let shortcutRegistered = false;
  function registerShortcut(accel: string): boolean {
    globalShortcut.unregisterAll();
    const ok = registerPalette(accel, () => {
      if (isShuttingDown) return;
      const pw = ensurePaletteWindow();
      positionPaletteAtCursor(pw);
      pw.show();
      pw.focus();
      pw.webContents.send("palette:reset");
    });
    shortcutRegistered = ok;
    if (!ok) tray?.displayBalloon?.({ title: "단축키 충돌", content: `${accel}: 등록 실패` });
    return ok;
  }

  // ─── Auto Update (electron-updater) ───
  // packaged 앱에서만 동작. dev에서는 checkForUpdates가 조용히 실패.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // 사용자 confirm 필요

  let updateCheckManual = false;
  autoUpdater.on("update-available", (info) => {
    if (updateCheckManual) {
      tray?.displayBalloon?.({ title: "업데이트 발견", content: `v${info.version} 다운로드 중...` });
    }
  });
  autoUpdater.on("update-not-available", () => {
    if (updateCheckManual) {
      tray?.displayBalloon?.({ title: "최신 버전", content: `현재 v${app.getVersion()}이 최신입니다.` });
    }
    updateCheckManual = false;
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateCheckManual = false;
    dialog.showMessageBox({
      type: "info",
      title: "업데이트 준비 완료",
      message: `새 버전 v${info.version} 다운로드 완료`,
      detail: "지금 앱을 재시작하면 새 버전으로 실행됩니다.",
      buttons: ["지금 재시작", "나중에"],
      defaultId: 0,
      cancelId: 1
    }).then((r) => {
      if (r.response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on("error", (err) => {
    console.error("[updater]", err.message);
    if (updateCheckManual) {
      tray?.displayBalloon?.({ title: "업데이트 확인 실패", content: err.message || "네트워크 확인" });
      updateCheckManual = false;
    }
  });

  function checkForUpdates(manual: boolean) {
    if (!app.isPackaged) {
      if (manual) {
        tray?.displayBalloon?.({ title: "개발 모드", content: "자동 업데이트는 패키지 빌드에서만 동작합니다." });
      }
      return;
    }
    updateCheckManual = manual;
    autoUpdater.checkForUpdates().catch((e) => {
      if (manual) tray?.displayBalloon?.({ title: "업데이트 확인 실패", content: e?.message ?? "네트워크 확인" });
      updateCheckManual = false;
    });
  }

  // Create tray
  const tray = createTray(win, {
    onQuit: () => loop.stop(),
    onOpenSettings: () => { const w = ensureSettingsWindow(); w.show(); w.focus(); },
    onShowHelp: showHelpDialog,
    onShowAbout: showAboutDialog,
    onCheckUpdate: () => checkForUpdates(true),
    onPomoStart: () => pomo.start(),
    onPomoStop: () => pomoStopManual(),
    getPomoState: () => ({ phase: pomo.phase, remainingMs: pomo.remainingMs })
  }, characterDir);

  // 시작 5초 후 자동 체크 (조용히)
  setTimeout(() => checkForUpdates(false), 5000);

  registerShortcut(settings.shortcutQuickMemo);

  // Fullscreen auto-hide polling — settings.hideOnFullscreen 토글 반영
  let fullscreenInterval: NodeJS.Timeout | null = null;
  function startFullscreenPolling() {
    if (fullscreenInterval) return;
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
  function stopFullscreenPolling() {
    if (fullscreenInterval) { clearInterval(fullscreenInterval); fullscreenInterval = null; }
  }
  if (settings.hideOnFullscreen) startFullscreenPolling();

  // Autostart 적용
  function applyAutoStart(on: boolean) {
    if (process.platform !== "win32") return;
    app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: [] });
  }
  applyAutoStart(settings.autoStart);

  // Settings IPC
  ipcMain.handle("settings:get", () => settings);
  ipcMain.handle("settings:update", (_, patch: Partial<Settings>) => {
    const prev = settings;
    settings = { ...settings, ...patch };
    let shortcutOk: boolean | undefined;
    if (patch.shortcutQuickMemo && patch.shortcutQuickMemo !== prev.shortcutQuickMemo) {
      shortcutOk = registerShortcut(patch.shortcutQuickMemo);
      if (!shortcutOk) settings.shortcutQuickMemo = prev.shortcutQuickMemo; // 롤백
    }
    if (patch.hideOnFullscreen !== undefined && patch.hideOnFullscreen !== prev.hideOnFullscreen) {
      if (patch.hideOnFullscreen) startFullscreenPolling(); else stopFullscreenPolling();
    }
    if (patch.autoStart !== undefined && patch.autoStart !== prev.autoStart) {
      applyAutoStart(patch.autoStart);
    }
    if (patch.walkSpeedPxPerSec !== undefined) {
      walker.speedPxPerSec = patch.walkSpeedPxPerSec;
    }
    if (patch.pomodoroFocusMin !== undefined || patch.pomodoroBreakMin !== undefined) {
      pomo.updateDurations(
        settings.pomodoroFocusMin * 60_000,
        settings.pomodoroBreakMin * 60_000
      );
    }
    if ("clipboardCaptureEnabled" in patch) {
      if (patch.clipboardCaptureEnabled) {
        clipboardWatcher.start();
      } else {
        clipboardWatcher.stop();
      }
    }
    if (patch.spriteScale !== undefined && patch.spriteScale !== prev.spriteScale) {
      // Hot swap: petSize 갱신 + 창 리사이즈 + walker 경계 갱신 + 렌더러에 새 크기 알림
      const oldSize = petSize;
      const newSize = manifest.frameSize * patch.spriteScale;
      petSize = newSize;
      const b = win.getBounds();
      const centerX = b.x + Math.floor(oldSize / 2);
      const disp = displayContainingElectron(screen, { x: b.x, y: b.y });
      const newX = Math.max(disp.x, Math.min(disp.x + disp.width - newSize, centerX - Math.floor(newSize / 2)));
      win.setBounds({ x: newX, y: groundY(disp, newSize), width: newSize, height: newSize });
      walker.minX = disp.x;
      walker.maxX = disp.x + disp.width - newSize;
      walker.x = newX;
      if (petWindowAlive()) {
        win.webContents.send("pet:rescale", { scale: patch.spriteScale, size: newSize });
      }
    }
    settingsStore.save(settings);
    return { shortcutOk };
  });

  // Export / Import
  ipcMain.handle("settings:exportMemos", async () => {
    if (isShuttingDown) return { ok: false };
    const r = await dialog.showSaveDialog(ensureSettingsWindow(), {
      title: "메모 내보내기",
      defaultPath: `bokki-memos-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (r.canceled || !r.filePath) return { ok: false };
    try {
      writeFileSync(r.filePath, JSON.stringify(memosStore.load(), null, 2), "utf8");
      return { ok: true, path: r.filePath };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "저장 실패" };
    }
  });
  ipcMain.handle("settings:importMemos", async () => {
    if (isShuttingDown) return { ok: false };
    const r = await dialog.showOpenDialog(ensureSettingsWindow(), {
      title: "메모 가져오기",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const arr = JSON.parse(readFileSync(r.filePaths[0], "utf8")) as Memo[];
      if (!Array.isArray(arr)) throw new Error("JSON 배열이 아님");
      // 병합 (id 중복은 새 것으로 덮음)
      const existing = memosStore.load();
      const merged = [...existing.filter(m => !arr.some(x => x.id === m.id)), ...arr];
      memosStore.save(merged);
      return { ok: true, count: arr.length };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "파싱 실패" };
    }
  });
  ipcMain.handle("settings:exportLaunchers", async () => {
    if (isShuttingDown) return { ok: false };
    const r = await dialog.showSaveDialog(ensureSettingsWindow(), {
      title: "바로가기 내보내기",
      defaultPath: `bokki-launchers-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (r.canceled || !r.filePath) return { ok: false };
    try {
      writeFileSync(r.filePath, JSON.stringify(launchersStore.load(), null, 2), "utf8");
      return { ok: true, path: r.filePath };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "저장 실패" };
    }
  });
  ipcMain.handle("settings:importLaunchers", async () => {
    if (isShuttingDown) return { ok: false };
    const r = await dialog.showOpenDialog(ensureSettingsWindow(), {
      title: "바로가기 가져오기",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const arr = JSON.parse(readFileSync(r.filePaths[0], "utf8")) as Launcher[];
      if (!Array.isArray(arr)) throw new Error("JSON 배열이 아님");
      const existing = launchersStore.load();
      const merged = [...existing.filter(l => !arr.some(x => x.id === l.id)), ...arr];
      launchersStore.save(merged);
      return { ok: true, count: arr.length };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "파싱 실패" };
    }
  });
  ipcMain.on("settings:openDataFolder", () => {
    shell.openPath(userDataRoot());
  });
  ipcMain.on("settings:showHelp", showHelpDialog);
  ipcMain.on("settings:showAbout", showAboutDialog);
  ipcMain.on("settings:openCoffee", () => shell.openExternal("https://buymeacoffee.com/sylph611"));
  ipcMain.handle("info:getVersion", () => app.getVersion());
  ipcMain.on("info:openRepo", () => shell.openExternal("https://github.com/sylph611/poodle-pet"));

  // First-run: 도움말 자동 표시
  if (isFirstRun) {
    // 창 뜬 뒤 살짝 뒤에 표시
    setTimeout(() => showHelpDialog(), 800);
  }

  // drag state — 커서 대비 창 좌상단 오프셋을 저장. 매 tick 마다 OS 커서 위치로
  // 창 위치 재계산 (renderer의 e.screenX보다 다중 모니터에서 신뢰성 높음).
  let dragAnchor: { offsetX: number; offsetY: number } | null = null;
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
      const cursor = screen.getCursorScreenPoint();
      // 커서 - 창좌상단 = 오프셋. 이 값을 유지하며 커서를 따라가면 상대 위치 고정.
      dragAnchor = { offsetX: cursor.x - b.x, offsetY: cursor.y - b.y };
      isDragging = true;
      if (blurHideTimer) { clearTimeout(blurHideTimer); blurHideTimer = null; }
    }
    if (kind === "dragEnd") {
      dragAnchor = null;
      isDragging = false;
    }
    controller.notify(kind);
  });

  ipcMain.on("pet:dragMove", () => {
    if (!dragAnchor) return;
    // OS 커서 위치는 항상 정확 (multi-monitor + DPI-per-monitor 안전).
    // 클램프 없음 — 커서가 어느 모니터 위에 있으면 창도 같이 그리로 감.
    const cursor = screen.getCursorScreenPoint();
    win.setBounds({
      x: cursor.x - dragAnchor.offsetX,
      y: cursor.y - dragAnchor.offsetY,
      width: petSize,
      height: petSize
    });
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
    bubble.webContents.send("bubble:pomoState", { phase: pomo.phase, remainingMs: pomo.remainingMs });
  });

  ipcMain.on("bubble:choose", (_, a: "memo" | "launcher" | "pomo" | "sleep") => {
    if (isShuttingDown) return;
    if (!bubble.isDestroyed()) bubble.hide();
    if (a === "memo") { const w = ensureMemoWindow(); w.show(); w.focus(); }
    if (a === "launcher") { const w = ensureLauncherWindow(); w.show(); w.focus(); }
    if (a === "pomo") {
      if (pomo.phase === "idle") pomo.start();
      else pomoStopManual();
    }
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

  // ─── 팔레트 IPC ───
  ipcMain.handle("palette:search", (_, query: string) => {
    const q = (query ?? "").toLowerCase().trim();
    const memos = memosStore.load();
    const clips = clipboardStore.list();
    const launchers = sortLaunchers(launchersStore.load());

    const matchText = (text: string) => q === "" || text.toLowerCase().includes(q);

    const pinnedMemos = memos.filter(m => m.pinned && matchText(m.text)).slice(0, 10);
    const normalMemos = memos.filter(m => !m.pinned && matchText(m.text)).slice(0, 10);
    const matchedClips = clips.filter(c => matchText(c.text)).slice(0, 10);
    const matchedLaunchers = launchers.filter(l => matchText(l.name) || matchText(l.target)).slice(0, 10);

    const items: Array<{ kind: "memo" | "snippet" | "clipboard" | "launcher"; id: string; text: string; meta?: string }> = [];
    for (const m of pinnedMemos)      items.push({ kind: "snippet",   id: m.id, text: m.text.slice(0, 120) });
    for (const c of matchedClips)     items.push({ kind: "clipboard", id: c.id, text: c.text.slice(0, 120), meta: timeago(c.copiedAt) });
    for (const m of normalMemos)      items.push({ kind: "memo",      id: m.id, text: m.text.slice(0, 120) });
    for (const l of matchedLaunchers) items.push({ kind: "launcher",  id: l.id, text: l.name });

    return items.slice(0, 40);
  });

  function timeago(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.round(diff / 1000);
    if (s < 60) return `${s}초 전`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}분 전`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.round(h / 24);
    return `${d}일 전`;
  }

  ipcMain.handle("palette:select", async (_, item: { kind: string; id: string; editMode: boolean }) => {
    if (item.kind === "launcher") {
      const l = launchersStore.load().find(x => x.id === item.id);
      if (!l) return;
      await openLauncher(l);
      return;
    }
    let text: string | null = null;
    if (item.kind === "memo" || item.kind === "snippet") {
      const m = memosStore.load().find(x => x.id === item.id);
      text = m?.text ?? null;
      if (item.editMode && m) {
        const w = ensureMemoWindow();
        w.show();
        w.focus();
        return;
      }
    } else if (item.kind === "clipboard") {
      const c = clipboardStore.list().find(x => x.id === item.id);
      text = c?.text ?? null;
    }
    if (text != null) {
      electronClipboard.writeText(text);
      if (petWindowAlive()) win.webContents.send("pet:toast", { text: "복사됨!", ms: 1200 });
    }
  });

  ipcMain.handle("palette:createMemo", async (_, text: string) => {
    const now = new Date().toISOString();
    const m: Memo = { id: randomUUID(), text, pinned: false, createdAt: now, updatedAt: now };
    const arr = memosStore.load(); arr.push(m); memosStore.save(arr);
    if (petWindowAlive()) win.webContents.send("pet:toast", { text: "기억했어요!", ms: 1200 });
  });

  ipcMain.handle("palette:openMemoWindow", () => {
    if (isShuttingDown) return;
    const w = ensureMemoWindow();
    w.show();
    w.focus();
  });

  ipcMain.on("palette:close", () => {
    if (paletteWin && !paletteWin.isDestroyed()) paletteWin.hide();
  });

  // ─── 클립보드 IPC ───
  ipcMain.handle("clipboard:togglePaused", () => {
    clipboardWatcher.setPaused(!clipboardWatcher.isPaused());
    return clipboardWatcher.isPaused();
  });

  ipcMain.handle("clipboard:isPaused", () => clipboardWatcher.isPaused());

  ipcMain.handle("clipboard:clear", () => {
    clipboardStore.clear();
  });

  app.on("before-quit", () => {
    isShuttingDown = true;
    setShuttingDown(true);
    loop.stop();
    clearInterval(pomoTickInterval);
    if (fullscreenInterval) clearInterval(fullscreenInterval);
    clipboardWatcher.stop();
    screen.removeListener("display-metrics-changed", onDisplayChange);
    screen.removeListener("display-removed", onDisplayChange);
    // Force-destroy all windows so app.quit() isn't blocked by close event prevention
    BrowserWindow.getAllWindows().forEach(w => w.destroy());
    destroyAllRegistered();
    currentPetWindow = null;
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
