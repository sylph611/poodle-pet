type Manifest = {
  frameSize: number;
  animations: Record<string, { row: number; frames: number; fps: number }>;
};

async function main() {
  const { manifestPath, imagePath, scale } = await window.pet.getSprite();
  const manifest: Manifest = await (await fetch(manifestPath)).json();
  const img = new Image(); img.src = imagePath;
  await new Promise(r => (img.onload = r));

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
