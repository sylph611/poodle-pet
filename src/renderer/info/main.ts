/// <reference path="../../preload/api.d.ts" />

const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const views = document.querySelectorAll<HTMLElement>(".view");

function showTab(name: string) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  views.forEach(v => v.classList.toggle("active", v.dataset.view === name));
}

tabs.forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab!)));

// Main → renderer: which tab to show
window.info.onShow((section) => showTab(section));

async function initAbout() {
  // 스프라이트 첫 프레임을 hero icon으로
  try {
    const s = await window.pet.getSprite();
    const cvs = document.createElement("canvas");
    cvs.width = s.manifest.frameSize;
    cvs.height = s.manifest.frameSize;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = s.imageDataUrl;
    });
    ctx.drawImage(img, 0, 0, s.manifest.frameSize, s.manifest.frameSize, 0, 0, s.manifest.frameSize, s.manifest.frameSize);
    const heroIcon = document.getElementById("hero-icon") as HTMLImageElement;
    if (heroIcon) heroIcon.src = cvs.toDataURL();
  } catch { /* 무시 — hero icon 없어도 OK */ }

  // 앱 버전 반영
  try {
    const v = await window.info.getVersion();
    const badge = document.getElementById("version-badge");
    if (badge) badge.textContent = `v${v}`;
  } catch {}

  // 현재 단축키 반영
  try {
    const s = await window.settings.get();
    const kbd = document.getElementById("shortcut-kbd");
    if (kbd) kbd.textContent = s.shortcutQuickMemo.replace(/CommandOrControl/g, "Ctrl");
  } catch {}
}

document.getElementById("btn-coffee")!.addEventListener("click", () => window.settings.openCoffee());
document.getElementById("btn-github")!.addEventListener("click", () => window.info.openRepo());
document.getElementById("repo-link")!.addEventListener("click", (e) => {
  e.preventDefault();
  window.info.openRepo();
});

// 기본은 도움말 탭
showTab("help");
initAbout();
export {};
