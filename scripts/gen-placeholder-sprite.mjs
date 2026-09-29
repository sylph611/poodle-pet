import { PNG } from "pngjs";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(HERE, "..", "characters", "poodle", "manifest.json");
const outPath = join(HERE, "..", "characters", "poodle", "sprite.png");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const size = manifest.frameSize;
const rows = Object.keys(manifest.animations).length;
const cols = Math.max(...Object.values(manifest.animations).map(a => a.frames));

const png = new PNG({ width: cols * size, height: rows * size });

// 행별 색상: 초콜릿·카라멜·애프리콧 계열 + 상태별 대비 (실제 아트는 별도 작업)
const rowColors = [
  [139, 69, 19],   // idle  - 초콜릿
  [160, 82, 45],   // walk  - 시에나
  [205, 133, 63], // sit    - 페루
  [222, 184, 135], // sleep - 뷔르릭
  [210, 105, 30],  // drag  - 초콜릿+
  [255, 165, 0]    // happy - 오렌지
];

const anims = Object.entries(manifest.animations);
for (let r = 0; r < anims.length; r++) {
  const [name, def] = anims[r];
  for (let c = 0; c < def.frames; c++) {
    // 프레임 안에서 y좌표를 조금씩 흔들어 애니메이션 티가 나게
    const bob = Math.floor(Math.sin((c / def.frames) * Math.PI * 2) * 3);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = (r * size + y) * png.width + (c * size + x);
        const idx = px * 4;
        const inBody = x >= 6 && x < 26 && y >= (10 + bob) && y < (28 + bob);
        if (inBody) {
          const [rr, gg, bb] = rowColors[r] ?? [128, 128, 128];
          png.data[idx] = rr; png.data[idx+1] = gg; png.data[idx+2] = bb; png.data[idx+3] = 255;
        } else {
          png.data[idx+3] = 0; // 투명
        }
      }
    }
  }
}

writeFileSync(outPath, PNG.sync.write(png));
console.log(`wrote ${outPath}`);
