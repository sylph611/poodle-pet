/// <reference path="../../preload/api.d.ts" />

// Toast helper
function toast(msg: string) {
  let el = document.querySelector(".toast") as HTMLElement | null;
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el && el.classList.remove("show"), 1600);
}

// Accelerator recorder — Electron accelerator string 생성
function toAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const k = e.key;
  if (k.length === 1) parts.push(k.toUpperCase());
  else if (/^F\d+$/.test(k)) parts.push(k);
  else if (k === "Enter" || k === "Escape" || k === "Tab" || k === " ") return null;
  else return null;
  if (parts.length < 2) return null;
  return parts.join("+");
}

function formatKbd(accel: string): string {
  return accel.replace(/CommandOrControl/g, "Ctrl");
}

async function main() {
  const s = await window.settings.get();

  // 스프라이트 크기
  const scaleBtns = document.querySelectorAll<HTMLButtonElement>('.scale-buttons button');
  function markScale(n: number) {
    scaleBtns.forEach(b => b.classList.toggle("active", Number(b.dataset.scale) === n));
  }
  markScale(s.spriteScale);
  scaleBtns.forEach(b => b.addEventListener("click", async () => {
    const n = Number(b.dataset.scale);
    markScale(n);
    await window.settings.update({ spriteScale: n });
    toast("스프라이트 크기 변경됨 · 창이 새로 로드됩니다");
  }));

  // 걷기 속도
  const speed = document.getElementById("walk-speed") as HTMLInputElement;
  const speedVal = document.getElementById("walk-speed-val")!;
  speed.value = String(s.walkSpeedPxPerSec);
  speedVal.textContent = String(s.walkSpeedPxPerSec);
  speed.addEventListener("input", () => { speedVal.textContent = speed.value; });
  speed.addEventListener("change", async () => {
    await window.settings.update({ walkSpeedPxPerSec: Number(speed.value) });
  });

  // 단축키
  const shortcutEl = document.getElementById("shortcut-display")!;
  const shortcutBtn = document.getElementById("shortcut-change") as HTMLButtonElement;
  const shortcutHint = document.getElementById("shortcut-hint")!;
  shortcutEl.textContent = formatKbd(s.shortcutQuickMemo);

  let recording = false;
  shortcutBtn.addEventListener("click", () => {
    recording = true;
    shortcutEl.classList.add("recording");
    shortcutHint.style.display = "";
    shortcutEl.textContent = "누르는 중…";
  });

  window.addEventListener("keydown", async (e) => {
    if (!recording) return;
    e.preventDefault();
    if (e.key === "Escape") {
      recording = false;
      shortcutEl.classList.remove("recording");
      shortcutHint.style.display = "none";
      shortcutEl.textContent = formatKbd(s.shortcutQuickMemo);
      return;
    }
    const accel = toAccelerator(e);
    if (!accel) return;
    const res = await window.settings.update({ shortcutQuickMemo: accel });
    recording = false;
    shortcutEl.classList.remove("recording");
    shortcutHint.style.display = "none";
    if (res.shortcutOk === false) {
      shortcutEl.textContent = formatKbd(s.shortcutQuickMemo);
      toast(`이미 사용 중인 조합입니다: ${formatKbd(accel)}`);
    } else {
      shortcutEl.textContent = formatKbd(accel);
      s.shortcutQuickMemo = accel;
      toast("단축키 변경됨");
    }
  }, true);

  // 토글들
  const hideFs = document.getElementById("hide-fs") as HTMLInputElement;
  hideFs.checked = s.hideOnFullscreen;
  hideFs.addEventListener("change", async () => {
    await window.settings.update({ hideOnFullscreen: hideFs.checked });
  });

  const autoStart = document.getElementById("auto-start") as HTMLInputElement;
  autoStart.checked = s.autoStart;
  autoStart.addEventListener("change", async () => {
    await window.settings.update({ autoStart: autoStart.checked });
  });

  // Export/Import
  document.getElementById("export-memos")!.addEventListener("click", async () => {
    const r = await window.settings.exportMemos();
    if (r.ok) toast(`저장됨: ${r.path?.split(/[/\\]/).pop()}`);
  });
  document.getElementById("import-memos")!.addEventListener("click", async () => {
    const r = await window.settings.importMemos();
    if (r.ok) toast(`가져옴: ${r.count}개`);
    else if (r.error) toast(`실패: ${r.error}`);
  });
  document.getElementById("export-launchers")!.addEventListener("click", async () => {
    const r = await window.settings.exportLaunchers();
    if (r.ok) toast(`저장됨: ${r.path?.split(/[/\\]/).pop()}`);
  });
  document.getElementById("import-launchers")!.addEventListener("click", async () => {
    const r = await window.settings.importLaunchers();
    if (r.ok) toast(`가져옴: ${r.count}개`);
    else if (r.error) toast(`실패: ${r.error}`);
  });
  document.getElementById("open-data-folder")!.addEventListener("click", () => {
    window.settings.openDataFolder();
  });

  // 도움말·정보
  document.getElementById("show-help")!.addEventListener("click", () => {
    window.settings.showHelp();
  });
  document.getElementById("show-about")!.addEventListener("click", () => {
    window.settings.showAbout();
  });
  document.getElementById("repo-link")!.addEventListener("click", (e) => {
    e.preventDefault();
    window.settings.showAbout();
  });
  document.getElementById("buy-coffee")!.addEventListener("click", () => {
    window.settings.openCoffee();
  });
}

main();
export {};
