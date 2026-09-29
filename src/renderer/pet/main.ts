type Manifest = {
  frameSize: number;
  animations: Record<string, { row: number; frames: number; fps: number }>;
};

async function main() {
  const { manifestPath, imagePath, scale } = await window.pet.getSprite();
  const manifest: Manifest = await (await fetch(manifestPath)).json();
  const img = new Image();
  img.src = imagePath;
  await new Promise(r => (img.onload = r));

  const size = manifest.frameSize * scale;
  const cvs = document.getElementById("pet") as HTMLCanvasElement;
  cvs.width = size; cvs.height = size;
  const ctx = cvs.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let anim = "idle";
  let frame = 0;
  let last = performance.now();

  function draw(now: number) {
    const def = manifest.animations[anim];
    const dt = now - last;
    if (dt >= 1000 / def.fps) {
      frame = (frame + 1) % def.frames;
      last = now;
    }
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(
      img,
      frame * manifest.frameSize, def.row * manifest.frameSize,
      manifest.frameSize, manifest.frameSize,
      0, 0, size, size
    );
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

main();
