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
const TARGET = 256;   // 256×256 (하이 DPI 대응 — Windows가 크게 표시 가능)
const FILL_MODE = "cover"; // "cover" (얼굴이 캔버스 꽉 채움, 양쪽 살짝 crop) | "contain" (여백 있음, 크롭 없음)

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

// cover: 얼굴이 캔버스를 꽉 채우도록 짧은 축 기준 스케일 (긴 축 살짝 crop).
// contain: 얼굴 완전히 안 잘리도록 긴 축 기준 스케일 (여백 발생).
const scale = FILL_MODE === "cover"
  ? TARGET / Math.min(bw, bh)   // 짧은 쪽이 TARGET에 맞음
  : TARGET / Math.max(bw, bh);  // 긴 쪽이 TARGET에 맞음

const scaledW = Math.round(bw * scale);
const scaledH = Math.round(bh * scale);
// 캔버스 중앙에 배치 (cover면 두 축 중 하나는 캔버스보다 커서 잘림)
const offX = Math.floor((TARGET - scaledW) / 2);
const offY = Math.floor((TARGET - scaledH) / 2);

const dst = new PNG({ width: TARGET, height: TARGET });
dst.data.fill(0);

// 알파 가중 다운샘플 — 목적 픽셀별로 원본 bbox의 대응 블록 평균
for (let dy = 0; dy < TARGET; dy++) {
  // 목적 y에 대응하는 원본 y 범위
  const localY = dy - offY;
  if (localY < 0 || localY >= scaledH) continue;
  const sy0 = minY + Math.floor(localY * bh / scaledH);
  const sy1 = minY + Math.floor((localY + 1) * bh / scaledH);
  for (let dx = 0; dx < TARGET; dx++) {
    const localX = dx - offX;
    if (localX < 0 || localX >= scaledW) continue;
    const sx0 = minX + Math.floor(localX * bw / scaledW);
    const sx1 = minX + Math.floor((localX + 1) * bw / scaledW);
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
    const di = (dy * TARGET + dx) * 4;
    if (sumA === 0 || count === 0) continue;
    dst.data[di]     = Math.round(sumR / sumA);
    dst.data[di + 1] = Math.round(sumG / sumA);
    dst.data[di + 2] = Math.round(sumB / sumA);
    dst.data[di + 3] = Math.round(sumA / count);
  }
}

writeFileSync(dstPath, PNG.sync.write(dst));
console.log(`wrote ${dstPath} (${TARGET}×${TARGET}, mode=${FILL_MODE}, scaled ${scaledW}×${scaledH})`);
