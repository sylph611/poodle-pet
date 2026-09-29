/**
 * 원본 hi-res 이미지에서 각 강아지(연결 성분)를 자동 검출해 32×32 셀에 재배치.
 *
 * AI가 그린 스프라이트 시트는 프레임 간 간격·크기가 균일하지 않음.
 * 단순히 6×6 그리드로 자르면 인접 셀 내용이 섞임.
 *
 * 이 스크립트:
 * 1. 원본에서 수평 밴드(6줄) 자동 검출
 * 2. 각 밴드 안에서 수직 그룹(강아지들) 자동 검출
 * 3. 각 강아지를 개별 crop → 32×32로 축소 → 셀 중앙 정렬 후 시트에 배치
 *
 * 입력:  characters/poodle/sprite-source-hires.png
 * 출력:  characters/poodle/sprite.png  (192×192)
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
const S = manifest.frameSize;              // 32
const anims = Object.entries(manifest.animations);
const rows = anims.length;                 // 6
const cols = Math.max(...Object.values(manifest.animations).map(a => a.frames));

const src = PNG.sync.read(readFileSync(srcPath));
console.log(`source: ${src.width}×${src.height}`);

const ALPHA_THRESHOLD = 96; // 이 이하는 실루엣으로 안 침 (AI 안개픽셀 무시)

function alpha(x, y) {
  if (x < 0 || y < 0 || x >= src.width || y >= src.height) return 0;
  return src.data[(y * src.width + x) * 4 + 3];
}

// 각 y row 별 실루엣 픽셀 개수 → 밴드 검출
const rowSums = new Array(src.height).fill(0);
for (let y = 0; y < src.height; y++) {
  let s = 0;
  for (let x = 0; x < src.width; x++) if (alpha(x, y) >= ALPHA_THRESHOLD) s++;
  rowSums[y] = s;
}

// 연속으로 rowSums > 임계인 구간을 밴드로 그루핑
function findBands(sums, threshold, minGap = 8) {
  const bands = [];
  let inBand = false, start = 0, gap = 0;
  for (let i = 0; i < sums.length; i++) {
    if (sums[i] > threshold) {
      if (!inBand) { start = i; inBand = true; }
      gap = 0;
    } else if (inBand) {
      gap++;
      if (gap >= minGap) { bands.push({ start, end: i - gap }); inBand = false; }
    }
  }
  if (inBand) bands.push({ start, end: sums.length - 1 });
  return bands;
}

const yBands = findBands(rowSums, 3, 10);
console.log(`detected ${yBands.length} horizontal bands:`, yBands.map(b => `[${b.start}-${b.end}]`).join(" "));

if (yBands.length !== rows) {
  console.error(`ERROR: expected ${rows} bands, got ${yBands.length}. Adjust threshold or check source.`);
  process.exit(1);
}

// 출력 시트 준비
const out = new PNG({ width: cols * S, height: rows * S });
out.data.fill(0);

// 각 밴드 안에서 x 방향으로 강아지 그루핑
for (let r = 0; r < rows; r++) {
  const [name, def] = anims[r];
  const yb = yBands[r];

  // 밴드 내부만으로 column sums
  const colSums = new Array(src.width).fill(0);
  for (let x = 0; x < src.width; x++) {
    let s = 0;
    for (let y = yb.start; y <= yb.end; y++) if (alpha(x, y) >= ALPHA_THRESHOLD) s++;
    colSums[x] = s;
  }
  const xGroups = findBands(colSums, 2, 6);
  console.log(`[${name}] band y[${yb.start}-${yb.end}] → ${xGroups.length} figures (expected ${def.frames})`);

  // 개수 불일치 시 갯수 맞추기 (남는 건 버리고, 부족하면 마지막 반복)
  const groups = xGroups.slice(0, def.frames);
  while (groups.length < def.frames) groups.push(groups[groups.length - 1] ?? xGroups[0]);

  for (let c = 0; c < def.frames; c++) {
    const xg = groups[c];
    if (!xg) continue;

    // 이 강아지의 정밀 bbox 계산 (밴드×xg 영역 내에서)
    let minX = xg.end, maxX = xg.start, minY = yb.end, maxY = yb.start;
    for (let y = yb.start; y <= yb.end; y++) {
      for (let x = xg.start; x <= xg.end; x++) {
        if (alpha(x, y) >= ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    // 강아지가 32×32로 들어가되 최대 28×28로 (좌우/상하 2px 여백)
    const maxDim = Math.max(bw, bh);
    const scale = Math.min(1, 28 / maxDim);
    const outW = Math.max(1, Math.round(bw * scale));
    const outH = Math.max(1, Math.round(bh * scale));
    const offX = Math.floor((S - outW) / 2);
    // 수직: 바닥선 정렬 (아래 여백 1px)
    const offY = S - outH - 1;

    // 알파 가중 다운샘플로 강아지만 32×32에 그리기
    const cellX0 = c * S;
    const cellY0 = def.row * S;
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
        const di = ((cellY0 + offY + y) * out.width + (cellX0 + offX + x)) * 4;
        if (sumA === 0 || count === 0) continue;
        out.data[di]     = Math.round(sumR / sumA);
        out.data[di + 1] = Math.round(sumG / sumA);
        out.data[di + 2] = Math.round(sumB / sumA);
        out.data[di + 3] = Math.round(sumA / count);
      }
    }
  }
}

writeFileSync(dstPath, PNG.sync.write(out));
console.log(`wrote ${dstPath}`);
