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

  const size = manifest.frameSize * scale;
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

// Click / drag interaction
let dragStartPt: { x: number; y: number } | null = null;
let dragged = false;

document.body.addEventListener("mousedown", (e) => {
  dragStartPt = { x: e.screenX, y: e.screenY };
  dragged = false;
});

document.body.addEventListener("mousemove", (e) => {
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

document.body.addEventListener("mouseup", (e) => {
  if (dragged) {
    window.pet.action("dragEnd");
  } else {
    const anchor = { x: e.screenX - e.clientX, y: e.screenY - e.clientY };
    window.pet.action("click");
    window.pet.openBubble(anchor);
  }
  dragStartPt = null;
  dragged = false;
});

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
