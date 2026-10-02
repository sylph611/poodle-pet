/**
 * 상태별 뽁이 메모리 사용량 측정 리포트.
 * Playwright Electron으로 앱 실행 → 시나리오별 창 open/close → 각 상태에서 2초 안정화 후 측정.
 * 측정은 OS 레벨 (Windows: Get-Process BOKKI | tasklist /FI "IMAGENAME eq BOKKI.exe").
 *
 * 실행: npm run measure:memory
 */
import { _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

function measureMemoryMB() {
  // Windows PowerShell로 BOKKI 프로세스 메모리 합산
  const script = `(Get-Process | Where-Object { $_.Path -like '*poodle-pet*' -or $_.Path -like '*BOKKI*' } | Measure-Object WorkingSet64 -Sum).Sum`;
  try {
    const out = execSync(`powershell -NoProfile -Command "${script}"`, { encoding: "utf8" });
    const bytes = parseInt(out.trim(), 10);
    return isNaN(bytes) ? 0 : Math.round(bytes / 1024 / 1024);
  } catch {
    return -1;
  }
}

function countProcs() {
  const script = `(Get-Process | Where-Object { $_.Path -like '*poodle-pet*' -or $_.Path -like '*BOKKI*' }).Count`;
  try {
    const out = execSync(`powershell -NoProfile -Command "${script}"`, { encoding: "utf8" });
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function openWindow(app, kind) {
  const pet = app.windows().find(w => /\/pet\//.test(w.url()));
  if (!pet) return;
  await pet.evaluate((k) => (window).pet.chooseAction(k), kind);
  await wait(1500);
}

async function closeWindow(app, pattern) {
  const w = app.windows().find(w => pattern.test(w.url()));
  if (w) { await w.close(); await wait(800); }
}

async function main() {
  const userData = mkdtempSync(join(tmpdir(), "bokki-mem-"));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userData}`],
    env: { ...process.env, E2E_TEST: "1" }
  });

  const scenarios = [
    { name: "초기 (아무 창도 안 열림)", setup: async () => {} },
    { name: "메모 창 열림",             setup: async (a) => { await openWindow(a, "memo"); } },
    { name: "메모 + 런처 열림",         setup: async (a) => { await openWindow(a, "launcher"); } },
    { name: "다 열었다 다 닫음",         setup: async (a) => {
      await closeWindow(a, /\/memo\//);
      await closeWindow(a, /\/launcher\//);
    } }
  ];

  await wait(3000); // 앱 안정화

  console.log("");
  console.log("┌─────────────────────────────────────────────┬───────┬─────────┐");
  console.log("│ 시나리오                                      │ 프로세스 │  메모리 │");
  console.log("├─────────────────────────────────────────────┼───────┼─────────┤");

  for (const s of scenarios) {
    await s.setup(app);
    await wait(2000); // 안정화
    const procs = countProcs();
    const mb = measureMemoryMB();
    const name = s.name.padEnd(43, " ");
    const p = String(procs).padStart(5, " ");
    const m = `${mb} MB`.padStart(7, " ");
    console.log(`│ ${name} │  ${p} │ ${m} │`);
  }

  console.log("└─────────────────────────────────────────────┴───────┴─────────┘");
  console.log("");

  await app.evaluate(({ app }) => app.quit());
  try { await app.close(); } catch {}
  rmSync(userData, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
