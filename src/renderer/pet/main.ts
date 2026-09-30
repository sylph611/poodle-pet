type Manifest = {
  frameSize: number;
  animations: Record<string, { row: number; frames: number; fps: number }>;
};

async function main() {
  const { manifest, imageDataUrl, scale } = await window.pet.getSprite();
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageDataUrl;
  });

  let size = manifest.frameSize * scale;
  const cvs = document.getElementById("pet") as HTMLCanvasElement;
  cvs.width = size; cvs.height = size;
  const ctx = cvs.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let anim: string = "idle";
  let facing: number = 1;
  let frame = 0;
  let last = performance.now();

  window.pet.onState(s => { anim = s in manifest.animations ? s : "idle"; frame = 0; });
  window.pet.onFacing(d => { facing = d; });
  // 설정에서 스프라이트 크기 변경 시 canvas 리사이즈
  window.pet.onRescale(({ size: newSize }) => {
    size = newSize;
    cvs.width = size;
    cvs.height = size;
    ctx.imageSmoothingEnabled = false;  // 리사이즈 후 재설정 필요
  });

  function draw(now: number) {
    const def = manifest.animations[anim];
    if (now - last >= 1000 / def.fps) { frame = (frame + 1) % def.frames; last = now; }
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    if (facing < 0) { ctx.translate(size, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img,
      frame * manifest.frameSize, def.row * manifest.frameSize,
      manifest.frameSize, manifest.frameSize,
      0, 0, size, size);
    ctx.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
main();

// Click / drag interaction — Pointer Events + setPointerCapture 사용:
// 드래그 중 창이 순간적으로 커서를 놓쳐도 pointermove/up 계속 수신되어 강아지 이탈 방지.
let dragStartPt: { x: number; y: number } | null = null;
let dragged = false;
let activePointerId: number | null = null;

document.body.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return; // 좌클릭만
  try { document.body.setPointerCapture(e.pointerId); } catch {}
  activePointerId = e.pointerId;
  dragStartPt = { x: e.screenX, y: e.screenY };
  dragged = false;
});

document.body.addEventListener("pointermove", (e) => {
  if (!dragStartPt) return;
  const dx = e.screenX - dragStartPt.x;
  const dy = e.screenY - dragStartPt.y;
  if (!dragged && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    dragged = true;
    window.pet.action("dragStart");
  }
  if (dragged) {
    window.pet.dragMove({ dx, dy });
  }
});

function endDrag(e: PointerEvent) {
  if (!dragStartPt) return;
  if (activePointerId != null) {
    try { document.body.releasePointerCapture(activePointerId); } catch {}
    activePointerId = null;
  }
  if (dragged) {
    window.pet.action("dragEnd");
  } else {
    const anchor = { x: e.screenX - e.clientX, y: e.screenY - e.clientY };
    window.pet.action("click");
    window.pet.openBubble(anchor);
  }
  dragStartPt = null;
  dragged = false;
}
document.body.addEventListener("pointerup", endDrag);
document.body.addEventListener("pointercancel", endDrag);

// Toast handler
const toast = document.getElementById("toast")!;
let toastTimer: number | null = null;
window.pet.onToast(({ text, ms }) => {
  toast.textContent = text;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), ms);
});

// File drag & drop — register dropped files as launchers
document.body.addEventListener("dragover", (e) => { e.preventDefault(); });
document.body.addEventListener("drop", (e) => {
  e.preventDefault();
  const paths: string[] = [];
  for (const f of Array.from(e.dataTransfer?.files ?? [])) {
    // Electron exposes File.path on the File object in the renderer
    const p = (f as any).path as string | undefined;
    if (p) paths.push(p);
  }
  if (paths.length) window.pet.dropFiles(paths);
});
