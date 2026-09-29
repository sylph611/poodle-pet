/**
 * 스프라이트 시트의 각 프레임을 자동 중앙 정렬.
 * AI가 그린 프레임들이 셀 안에서 위치가 미묘히 다르면 재생 시 캐릭터가
 * 옆으로 흐르는(drift) 것처럼 보임. 각 프레임의 실루엣 bounding box를
 * 찾아 셀 중앙(수평)·바닥선(수직 하단) 기준으로 재배치.
 *
 * 입력/출력: characters/poodle/sprite.png (in-place)
 */
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const spritePath = join(HERE, "..", "characters", "poodle", "sprite.png");
const manifestPath = join(HERE, "..", "characters", "poodle", "manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const S = manifest.frameSize;
const png = PNG.sync.read(readFileSync(spritePath));
console.log(`sheet: ${png.width}×${png.height}, frame size: ${S}`);

// 반투명·거의투명 픽셀은 실루엣으로 간주하지 않음 (AI가 남긴 흐린 안개 픽셀 무시)
const ALPHA_THRESHOLD = 96;

// 원본 데이터를 새 버퍼로 정렬해 씀
const out = new PNG({ width: png.width, height: png.height });
out.data.fill(0);

function alphaAt(data, x, y, w) {
  if (x < 0 || x >= w || y < 0) return 0;
  return data[(y * w + x) * 4 + 3];
}

function copyPixel(srcData, srcW, sx, sy, dstData, dstW, dx, dy) {
  const si = (sy * srcW + sx) * 4;
  const di = (dy * dstW + dx) * 4;
  dstData[di]     = srcData[si];
  dstData[di + 1] = srcData[si + 1];
  dstData[di + 2] = srcData[si + 2];
  dstData[di + 3] = srcData[si + 3];
}

// 셀별 처리
for (const [name, def] of Object.entries(manifest.animations)) {
  const cellY0 = def.row * S;
  const results = [];
  for (let c = 0; c < def.frames; c++) {
    const cellX0 = c * S;

    // bounding box 계산 (셀 내부 좌표)
    let minX = S, maxX = -1, minY = S, maxY = -1;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (alphaAt(png.data, cellX0 + x, cellY0 + y, png.width) >= ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) {
      results.push({ frame: c, empty: true });
      continue;
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    // 목표: 실루엣을 수평 중앙, 수직으로는 바닥선 정렬 (밑 여백 1px)
    const targetX0 = Math.floor((S - bw) / 2);
    const targetY0 = S - bh - 1;
    const shiftX = targetX0 - minX;
    const shiftY = targetY0 - minY;

    // 프레임 복사 (shift 적용)
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const a = alphaAt(png.data, cellX0 + x, cellY0 + y, png.width);
        if (a === 0) continue;
        const nx = x + shiftX;
        const ny = y + shiftY;
        if (nx < 0 || nx >= S || ny < 0 || ny >= S) continue;
        copyPixel(png.data, png.width, cellX0 + x, cellY0 + y, out.data, out.width, cellX0 + nx, cellY0 + ny);
      }
    }

    results.push({ frame: c, bw, bh, shiftX, shiftY });
  }
  console.log(`${name}:`, results.map(r => r.empty ? "empty" : `#${r.frame} shift(${r.shiftX},${r.shiftY}) bbox=${r.bw}×${r.bh}`).join(", "));
}

writeFileSync(spritePath, PNG.sync.write(out));
console.log(`wrote ${spritePath}`);
