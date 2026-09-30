/**
 * README/블로그용 스크린샷 자동 캡처.
 *
 * Playwright Electron으로 앱 실행 → 샘플 데이터 주입 → 각 창 열고 screenshot() → 저장.
 * 임시 userData 디렉토리 사용해서 사용자 실 데이터를 건드리지 않음.
 *
 * 출력: docs/media/
 *   pet.png · bubble.png · memo.png · launcher.png · settings.png · about.png · help.png
 */
import { _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "docs", "media");
mkdirSync(OUT, { recursive: true });

// 임시 userData
const userData = mkdtempSync(join(tmpdir(), "bokki-capture-"));
console.log(`temp userData: ${userData}`);

// 샘플 데이터 미리 주입
const now = new Date().toISOString();
const sampleMemos = [
  { id: "s1", text: "AI로 뽁이 만들기 회고 — 스프라이트는 실제 강아지 사진 참조가 압도적", pinned: true, createdAt: now, updatedAt: now },
  { id: "s2", text: "3시 회의 · 뽁이 v0.3 로드맵", pinned: false, createdAt: now, updatedAt: now },
  { id: "s3", text: "쇼핑\n· 라면\n· 김치\n· 계란", pinned: false, createdAt: now, updatedAt: now }
];
const sampleLaunchers = [
  { id: "l1", name: "GitHub — poodle-pet", type: "url",    target: "https://github.com/sylph611/poodle-pet", order: 0 },
  { id: "l2", name: "Notion",              type: "url",    target: "https://notion.so", order: 1 },
  { id: "l3", name: "Downloads",           type: "folder", target: "C:\\Users\\", order: 2 }
];
writeFileSync(join(userData, "memos.json"), JSON.stringify(sampleMemos, null, 2), "utf8");
writeFileSync(join(userData, "launchers.json"), JSON.stringify(sampleLaunchers, null, 2), "utf8");

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findWindow(app, matcherFn, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (await matcherFn(w)) return w;
      } catch {}
    }
    await wait(150);
  }
  throw new Error("window not found within timeout");
}

async function main() {
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userData}`],
    env: { ...process.env, E2E_TEST: "1" }
  });

  try {
    // pet 창 찾기
    const pet = await findWindow(app, async (w) => (await w.$("#pet")) !== null);
    await wait(600); // 스프라이트 로드
    await pet.screenshot({ path: join(OUT, "pet.png"), omitBackground: true });
    console.log("✓ pet.png");

    // Memo 창
    await app.evaluate(async ({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      for (const w of wins) {
        const url = w.webContents.getURL();
        if (url.includes("/memo/")) { w.show(); w.focus(); }
      }
    });
    const memo = await findWindow(app, async (w) => (await w.$("#input")) !== null);
    await wait(500);
    await memo.screenshot({ path: join(OUT, "memo.png") });
    console.log("✓ memo.png");

    // Launcher 창
    await app.evaluate(async ({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) {
        const url = w.webContents.getURL();
        if (url.includes("/launcher/")) { w.show(); w.focus(); }
      }
    });
    const launcher = await findWindow(app, async (w) => (await w.$("#add-file")) !== null);
    await wait(700); // 아이콘 로드
    await launcher.screenshot({ path: join(OUT, "launcher.png") });
    console.log("✓ launcher.png");

    // Settings 창
    await app.evaluate(async ({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) {
        const url = w.webContents.getURL();
        if (url.includes("/settings/")) { w.show(); w.focus(); }
      }
    });
    const settings = await findWindow(app, async (w) => (await w.$("#walk-speed")) !== null);
    await wait(600);
    await settings.screenshot({ path: join(OUT, "settings.png") });
    console.log("✓ settings.png");

    // Info 창 (도움말 탭)
    await app.evaluate(async ({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) {
        const url = w.webContents.getURL();
        if (url.includes("/info/")) { w.show(); w.focus(); w.webContents.send("info:show", "help"); }
      }
    });
    const info = await findWindow(app, async (w) => (await w.$(".tabs")) !== null);
    await wait(500);
    await info.screenshot({ path: join(OUT, "help.png") });
    console.log("✓ help.png");

    // Info 창 — 뽁이에 대해 탭
    await info.evaluate(() => {
      const btn = document.querySelector('[data-tab="about"]');
      if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await wait(700); // hero icon 로드
    await info.screenshot({ path: join(OUT, "about.png") });
    console.log("✓ about.png");

    // 종료
    await app.evaluate(({ app }) => app.quit());
    try { await app.close(); } catch {}
  } catch (e) {
    console.error("capture failed:", e);
    try { await app.close(); } catch {}
    process.exitCode = 1;
  } finally {
    rmSync(userData, { recursive: true, force: true });
  }
}

main();
