import { test, expect, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let userData: string;

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), "poodle-e2e-"));
});

test.afterEach(async () => {
  // Give Electron a moment to release file handles on Windows, then clean up
  await waitMs(500);
  try { rmSync(userData, { recursive: true, force: true }); } catch { /* ignore EPERM */ }
});

async function launch() {
  return await electron.launch({
    args: [".", `--user-data-dir=${userData}`],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1", E2E_TEST: "1" }
  });
}

async function closeApp(app: ElectronApplication) {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
}

async function waitMs(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Get the pet window (has #pet canvas and window.memos/launchers API).
 */
async function getPetWindow(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    for (const wnd of app.windows()) {
      try {
        const count = await wnd.locator("#pet").count();
        if (count > 0) return wnd;
      } catch { /* window not ready */ }
    }
    await waitMs(150);
  }
  return app.firstWindow();
}

test("pet window opens", async () => {
  const app = await launch();
  const wnd = await getPetWindow(app);
  await expect(wnd.locator("#pet")).toBeAttached();
  await closeApp(app);
});

test("memo persists across restart", async () => {
  let app = await launch();
  let wnd = await getPetWindow(app);
  await wnd.evaluate(async () => {
    await (window as any).memos.add("hello e2e");
  });
  // Allow store's atomic write to flush to disk
  await waitMs(400);
  await closeApp(app);
  // Give OS time to release file handles before relaunch
  await waitMs(500);

  app = await launch();
  wnd = await getPetWindow(app);
  const items = await wnd.evaluate(async () => (window as any).memos.list());
  expect(items.some((m: any) => m.text === "hello e2e")).toBe(true);
  await closeApp(app);
});

test("launcher URL add", async () => {
  const app = await launch();
  const wnd = await getPetWindow(app);
  await wnd.evaluate(async () => {
    await (window as any).launchers.add({ target: "https://example.com", type: "url" });
  });
  const items = await wnd.evaluate(async () => (window as any).launchers.list());
  expect(items.length).toBe(1);
  expect(items[0].type).toBe("url");
  await closeApp(app);
});

async function findWindowBy(
  app: ElectronApplication,
  predicate: (w: Page) => boolean,
  timeoutMs: number
): Promise<Page | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await waitMs(150);
  }
  return undefined;
}

test("memo window is lazy — created on open, destroyed on close", async () => {
  const app = await launch();
  const pet = await getPetWindow(app);

  // 메모 창은 아직 없어야 함
  const memoBefore = app.windows().find(w => w.url().includes("/memo/"));
  expect(memoBefore).toBeUndefined();

  // 메모 창 열기 (IPC로 bubble:choose "memo")
  await pet.evaluate(() => {
    (window as any).pet.chooseAction("memo");
  });

  // 메모 창이 생겼는지 waitFor
  const memo = await findWindowBy(app, w => w.url().includes("memo"), 5000);
  expect(memo).toBeTruthy();

  // 메모 창 닫기
  await memo!.close();
  await waitMs(1000);

  // destroy 됐는지 확인
  const memoAfter = app.windows().find(w => w.url().includes("memo"));
  expect(memoAfter).toBeUndefined();

  await closeApp(app);
});

test("pomodoro start → focus badge visible", async () => {
  const app = await launch();
  const pet = await getPetWindow(app);

  // 포모도로 시작 (E2E IPC 핸들러 사용)
  await pet.evaluate(() => (window as any).__e2e.pomoStart());

  // 배지가 .focus 클래스를 가져야 함
  await pet.waitForSelector("#pomo-badge:not(.hidden).focus", { timeout: 5000 });
  const badgeText = await pet.textContent("#pomo-badge");
  expect(badgeText).toMatch(/\d+:\d{2}/);

  await closeApp(app);
});
