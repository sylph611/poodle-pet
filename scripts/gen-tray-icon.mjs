/**
 * 트레이 아이콘용 정사각 PNG 생성.
 * 원본(사용자 커스텀 hi-res PNG)에서 실루엣 bbox 자동 검출 → tight crop →
 * 알파 가중 다운샘플로 target 크기(정사각)에 중앙 배치.
 *
 * 입력: characters/poodle/tray-icon-source.png
 * 출력: characters/poodle/tray-icon.png (기본 128×128, 여백 4px)
 */
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const srcPath = join(HERE, "..", "characters", "poodle", "tray-icon-source.png");
const dstPath = join(HERE, "..", "characters", "poodle", "tray-icon.png");
const TARGET = 128;   // 128x128 (Windows 트레이는 이후 자동으로 32/48로 리샘플)
const PAD = 4;        // 상하좌우 여백 pixel

const ALPHA_THRESHOLD = 32;

const src = PNG.sync.read(readFileSync(srcPath));
console.log(`source: ${src.width}×${src.height}`);

// 실루엣 bbox 찾기
let minX = src.width, maxX = -1, minY = src.height, maxY = -1;
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const a = src.data[(y * src.width + x) * 4 + 3];
    if (a >= ALPHA_THRESHOLD) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) throw new Error("no opaque pixels in source");
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
console.log(`bbox: ${bw}×${bh} at (${minX},${minY})`);

// 정사각으로 채우되 여백 PAD 반영. 짧은 축 기준으로 스케일.
const inner = TARGET - PAD * 2;
const scale = Math.min(inner / bw, inner / bh);
const outW = Math.max(1, Math.round(bw * scale));
const outH = Math.max(1, Math.round(bh * scale));
const offX = Math.floor((TARGET - outW) / 2);
const offY = Math.floor((TARGET - outH) / 2);

const dst = new PNG({ width: TARGET, height: TARGET });
dst.data.fill(0);

// 알파 가중 다운샘플 (bbox 영역 → outW×outH)
for (let y = 0; y < outH; y++) {
  const sy0 = minY + Math.floor(y * bh / outH);
  const sy1 = minY + Math.floor((y + 1) * bh / outH);
  for (let x = 0; x < outW; x++) {
    const sx0 = minX + Math.floor(x * bw / outW);
    const sx1 = minX + Math.floor((x + 1) * bw / outW);
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
    for (let sy = sy0; sy < sy1; sy++) {
      for (let sx = sx0; sx < sx1; sx++) {
        const si = (sy * src.width + sx) * 4;
        const a = src.data[si + 3];
        sumR += src.data[si]     * a;
        sumG += src.data[si + 1] * a;
        sumB += src.data[si + 2] * a;
        sumA += a;
        count++;
      }
    }
    const di = ((offY + y) * TARGET + (offX + x)) * 4;
    if (sumA === 0 || count === 0) continue;
    dst.data[di]     = Math.round(sumR / sumA);
    dst.data[di + 1] = Math.round(sumG / sumA);
    dst.data[di + 2] = Math.round(sumB / sumA);
    dst.data[di + 3] = Math.round(sumA / count);
  }
}

writeFileSync(dstPath, PNG.sync.write(dst));
console.log(`wrote ${dstPath} (${TARGET}×${TARGET}, inner ${outW}×${outH})`);
