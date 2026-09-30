/**
 * 뽁이 walk 애니메이션 GIF 생성 (블로그·README용).
 *
 * 스프라이트 시트의 walk 행(6 프레임)을 스캔 → 각 프레임 4x 확대 →
 * 캐릭터를 왼쪽에서 오른쪽으로 이동시키며 GIF 프레임 합성 → 애니메이션 GIF 저장.
 *
 * 출력: docs/media/pet-walk.gif  (transparent bg, loop, ~2s)
 */
import { PNG } from "pngjs";
import gifencPkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifencPkg;
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const manifestPath = join(ROOT, "characters", "poodle", "manifest.json");
const spritePath = join(ROOT, "characters", "poodle", "sprite.png");
const outPath = join(ROOT, "docs", "media", "pet-walk.gif");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const F = manifest.frameSize;              // 32
const walk = manifest.animations.walk;     // { row: 1, frames: 6, fps: 5 }
const SCALE = 4;                            // 128px pet display size

const sheet = PNG.sync.read(readFileSync(spritePath));

// walk 6 프레임을 각 4배 확대해 128×128 프레임으로 추출
function extractFrame(col) {
  const src = { x: col * F, y: walk.row * F };
  const dst = new PNG({ width: F * SCALE, height: F * SCALE });
  dst.data.fill(0);
  for (let y = 0; y < F; y++) {
    for (let x = 0; x < F; x++) {
      const si = ((src.y + y) * sheet.width + (src.x + x)) * 4;
      const r = sheet.data[si], g = sheet.data[si + 1], b = sheet.data[si + 2], a = sheet.data[si + 3];
      if (a === 0) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const di = ((y * SCALE + dy) * dst.width + (x * SCALE + dx)) * 4;
          dst.data[di] = r; dst.data[di + 1] = g; dst.data[di + 2] = b; dst.data[di + 3] = a;
        }
      }
    }
  }
  return dst;
}

const frames = [];
for (let c = 0; c < walk.frames; c++) frames.push(extractFrame(c));
const petW = F * SCALE, petH = F * SCALE;

// GIF 캔버스: 6 * petW 폭, petH 높이. 왼→오 이동하며 walk 프레임 순환.
// 총 프레임: 24 (부드러운 이동 + walk cycle 4회)
const CANVAS_W = petW * 6;
const CANVAS_H = petH + 20; // 하단 여백 (그림자 공간)
const GIF_FRAMES = 24;
const FPS = 8;

// 배경색 — 카라멜 톤 (블로그와 매치)
const BG_R = 255, BG_G = 248, BG_B = 240; // #FFF8F0

// 바닥선 (은은한 그림자용)
const GROUND_Y = CANVAS_H - 8;

const gif = GIFEncoder();

for (let f = 0; f < GIF_FRAMES; f++) {
  const walkFrameIdx = f % walk.frames;
  const petImg = frames[walkFrameIdx];

  // 이동: 왼쪽 여백 → 오른쪽 여백 (pet은 항상 화면 안). 마지막 프레임이 첫 프레임과 만나 loop 자연스럽게.
  const t = f / GIF_FRAMES;
  const xPos = Math.round(20 + t * (CANVAS_W - petW - 40));

  // 캔버스 RGBA 버퍼
  const canvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4);
  for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
    canvas[i * 4]     = BG_R;
    canvas[i * 4 + 1] = BG_G;
    canvas[i * 4 + 2] = BG_B;
    canvas[i * 4 + 3] = 255;
  }

  // 은은한 바닥 그림자 (타원)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -Math.floor(petW / 3); dx <= Math.floor(petW / 3); dx++) {
      const cx = xPos + Math.floor(petW / 2) + dx;
      const cy = GROUND_Y + dy;
      if (cx < 0 || cx >= CANVAS_W || cy < 0 || cy >= CANVAS_H) continue;
      const norm = (dx * dx) / ((petW / 3) * (petW / 3)) + (dy * dy) / 9;
      if (norm > 1) continue;
      const alpha = (1 - norm) * 0.25;
      const i = (cy * CANVAS_W + cx) * 4;
      canvas[i]     = Math.round(canvas[i]     * (1 - alpha) + 62  * alpha);
      canvas[i + 1] = Math.round(canvas[i + 1] * (1 - alpha) + 42  * alpha);
      canvas[i + 2] = Math.round(canvas[i + 2] * (1 - alpha) + 26  * alpha);
    }
  }

  // 강아지 합성 (알파 블렌드)
  for (let py = 0; py < petH; py++) {
    for (let px = 0; px < petW; px++) {
      const dstX = xPos + px;
      const dstY = py + (CANVAS_H - petH - 8);
      if (dstX < 0 || dstX >= CANVAS_W || dstY < 0 || dstY >= CANVAS_H) continue;
      const si = (py * petW + px) * 4;
      const a = petImg.data[si + 3];
      if (a === 0) continue;
      const di = (dstY * CANVAS_W + dstX) * 4;
      const alpha = a / 255;
      canvas[di]     = Math.round(petImg.data[si]     * alpha + canvas[di]     * (1 - alpha));
      canvas[di + 1] = Math.round(petImg.data[si + 1] * alpha + canvas[di + 1] * (1 - alpha));
      canvas[di + 2] = Math.round(petImg.data[si + 2] * alpha + canvas[di + 2] * (1 - alpha));
    }
  }

  const palette = quantize(canvas, 256);
  const index = applyPalette(canvas, palette);
  gif.writeFrame(index, CANVAS_W, CANVAS_H, {
    palette,
    delay: Math.round(1000 / FPS)
  });
}

gif.finish();
writeFileSync(outPath, Buffer.from(gif.bytes()));
console.log(`wrote ${outPath}  (${CANVAS_W}×${CANVAS_H}, ${GIF_FRAMES} frames @ ${FPS}fps)`);
