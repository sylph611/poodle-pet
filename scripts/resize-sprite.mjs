/**
 * AI로 뽑은 대용량 스프라이트를 32×32 프레임의 192×192 시트로 재샘플링.
 *
 * 입력: characters/poodle/sprite-source-hires.png (원본, 크기 무관)
 * 출력: characters/poodle/sprite.png (192×192)
 *
 * 각 32×32 목적 픽셀은 원본의 대응 블록(약 7×6 pixel)에서 알파-가중 평균 색으로 계산.
 * 알파 기반 다운샘플이라 픽셀아트 특유의 선명함이 어느 정도 유지되면서 투명 배경이 살아남음.
 */
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const srcPath = join(HERE, "..", "characters", "poodle", "sprite-source-hires.png");
const dstPath = join(HERE, "..", "characters", "poodle", "sprite.png");
const manifestPath = join(HERE, "..", "characters", "poodle", "manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const S = manifest.frameSize; // 32
const rows = Object.keys(manifest.animations).length;
const cols = Math.max(...Object.values(manifest.animations).map(a => a.frames));

const src = PNG.sync.read(readFileSync(srcPath));
console.log(`source: ${src.width}×${src.height}`);

const dstW = cols * S;
const dstH = rows * S;
console.log(`target: ${dstW}×${dstH} (${cols}×${rows} cells of ${S}×${S})`);

const dst = new PNG({ width: dstW, height: dstH });

// Alpha-weighted box downsample: for each dest pixel, average all source
// pixels in the corresponding block, weighted by alpha. Transparent source
// pixels contribute nothing. Dest alpha = mean of source alphas.
const sxRatio = src.width / dstW;
const syRatio = src.height / dstH;

for (let y = 0; y < dstH; y++) {
  const sy0 = Math.floor(y * syRatio);
  const sy1 = Math.floor((y + 1) * syRatio);
  for (let x = 0; x < dstW; x++) {
    const sx0 = Math.floor(x * sxRatio);
    const sx1 = Math.floor((x + 1) * sxRatio);

    let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
    for (let sy = sy0; sy < sy1; sy++) {
      for (let sx = sx0; sx < sx1; sx++) {
        const si = (sy * src.width + sx) * 4;
        const a = src.data[si + 3];
        // Weight color by alpha so mostly-transparent edge pixels don't wash out the color
        sumR += src.data[si]     * a;
        sumG += src.data[si + 1] * a;
        sumB += src.data[si + 2] * a;
        sumA += a;
        count++;
      }
    }

    const di = (y * dstW + x) * 4;
    if (sumA === 0 || count === 0) {
      dst.data[di] = 0; dst.data[di + 1] = 0; dst.data[di + 2] = 0; dst.data[di + 3] = 0;
    } else {
      dst.data[di]     = Math.round(sumR / sumA);
      dst.data[di + 1] = Math.round(sumG / sumA);
      dst.data[di + 2] = Math.round(sumB / sumA);
      dst.data[di + 3] = Math.round(sumA / count);
    }
  }
}

writeFileSync(dstPath, PNG.sync.write(dst));
console.log(`wrote ${dstPath}`);
