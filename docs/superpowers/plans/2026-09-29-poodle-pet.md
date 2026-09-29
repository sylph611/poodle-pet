# Poodle Pet v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 바탕화면을 돌아다니는 갈색 픽셀아트 푸들 데스크톱 펫. 돌아다니기 / 메모 / 바로가기 런처 3기능 v1.

**Architecture:** Electron main 프로세스가 128×128 투명 창(pet) + 부속 창들(bubble, memo, launcher)을 관리. PetController 상태 머신이 창 이동을 지시, Renderer는 preload IPC로만 Main과 통신. 데이터는 `%APPDATA%/poodle-pet/`의 JSON에 atomic write.

**Tech Stack:** Electron 32+, TypeScript 5+, electron-vite, Vitest, Playwright (Electron), electron-builder (NSIS), pngjs (placeholder sprite 생성).

## Global Constraints

- OS: **Windows** 전용 (v1)
- Renderer: **바닐라 HTML/CSS/TS**, React·프레임워크 금지
- 보안: `contextIsolation: true`, `nodeIntegration: false`, preload로만 IPC 노출
- 데이터 저장: `%APPDATA%/poodle-pet/` (`app.getPath('userData')`)
- 저장 방식: **atomic write** (`tmp` → `rename`) + **일 1회 백업** (`backup/YYYY-MM-DD/`, 최근 7일)
- 스프라이트: 32×32 프레임, 화면 4배 확대 (기본), 3~5배 설정 가능
- 라이선스 회피: 기존 IP 캐릭터 금지, 오리지널 픽셀아트만
- 전역 단축키 기본값: `Ctrl+Alt+M`
- **spec 원본**: `docs/superpowers/specs/2026-09-29-poodle-pet-design.md`

---

## File Structure

```
poodle-pet/
├── package.json
├── tsconfig.json
├── electron.vite.config.ts
├── electron-builder.yml
├── .gitignore
├── README.md
├── scripts/
│   └── gen-placeholder-sprite.mjs   # 임시 스프라이트 PNG 생성기
├── characters/
│   └── poodle/
│       ├── sprite.png               # 생성물 (git 포함)
│       └── manifest.json
├── src/
│   ├── main/
│   │   ├── index.ts                 # 앱 부트, 창 생성, IPC 라우팅
│   │   ├── pet-controller.ts        # 상태 머신 + 이동 지시 (pure logic)
│   │   ├── pet-window.ts            # 투명 창 생성 + 위치 갱신
│   │   ├── store.ts                 # atomic write + 백업 로테이션
│   │   ├── launcher.ts              # shell.openPath / openExternal, getFileIcon
│   │   ├── screen-utils.ts          # 모니터/바닥선 계산, 전체화면 감지
│   │   ├── tray.ts                  # 트레이 메뉴
│   │   ├── shortcuts.ts             # globalShortcut 등록 + 충돌 알림
│   │   ├── paths.ts                 # userData 경로 상수
│   │   └── ipc.ts                   # IPC 채널 정의 (main 측)
│   ├── preload/
│   │   ├── index.ts                 # contextBridge 노출
│   │   └── api.d.ts                 # window.pet API 타입 선언
│   ├── shared/
│   │   ├── types.ts                 # Memo, Launcher, Settings, PetState
│   │   └── manifest.ts              # SpriteManifest 파서
│   └── renderer/
│       ├── pet/
│       │   ├── index.html
│       │   ├── main.ts              # 스프라이트 애니메이션 + 클릭/드롭 이벤트
│       │   └── style.css
│       ├── bubble/
│       │   ├── index.html
│       │   ├── main.ts              # 말풍선 메뉴 (📝🚀💤)
│       │   └── style.css
│       ├── memo/
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── style.css
│       └── launcher/
│           ├── index.html
│           ├── main.ts
│           └── style.css
├── tests/
│   ├── unit/
│   │   ├── store.test.ts
│   │   ├── pet-controller.test.ts
│   │   ├── screen-utils.test.ts
│   │   └── manifest.test.ts
│   └── e2e/
│       └── smoke.spec.ts            # Playwright Electron
└── docs/superpowers/
    ├── specs/2026-09-29-poodle-pet-design.md
    └── plans/2026-09-29-poodle-pet.md
```

---

## Task 1: 프로젝트 부트스트랩 (Electron + TS + electron-vite + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `.gitignore`
- Create: `src/main/index.ts` (최소 스텁)
- Create: `src/preload/index.ts` (빈 스텁)
- Create: `src/renderer/pet/index.html`, `src/renderer/pet/main.ts` (Hello World)
- Test: `tests/unit/smoke.test.ts` (Vitest 자체 sanity)

**Interfaces:**
- Consumes: (없음)
- Produces: `npm run dev` → 창 하나가 뜨고 "hello poodle" 표시. `npm test` → 초록.

- [ ] **Step 1: `.gitignore` 작성**

```
node_modules/
out/
dist/
*.log
.DS_Store
```

- [ ] **Step 2: `package.json` 작성**

```json
{
  "name": "poodle-pet",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "gen:sprite": "node scripts/gen-placeholder-sprite.mjs",
    "pack": "electron-vite build && electron-builder --win"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-vite": "^2.3.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "@playwright/test": "^1.47.0",
    "pngjs": "^7.0.0",
    "@types/node": "^20.0.0",
    "@types/pngjs": "^6.0.0"
  }
}
```

- [ ] **Step 3: `tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"],
    "outDir": "out",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*"]
}
```

- [ ] **Step 4: `electron.vite.config.ts` 작성**

```ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: "out/main" }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: "out/preload" }
  },
  renderer: {
    root: "src/renderer",
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          pet: resolve(__dirname, "src/renderer/pet/index.html"),
          bubble: resolve(__dirname, "src/renderer/bubble/index.html"),
          memo: resolve(__dirname, "src/renderer/memo/index.html"),
          launcher: resolve(__dirname, "src/renderer/launcher/index.html")
        }
      }
    }
  }
});
```

- [ ] **Step 5: 스텁 파일 작성**

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from "electron";
import { join } from "node:path";

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 400,
    height: 200,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/pet/index.html"));
  }
});

app.on("window-all-closed", () => app.quit());
```

`src/preload/index.ts`:
```ts
export {};
```

`src/renderer/pet/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8"><link rel="stylesheet" href="./style.css"></head>
  <body><div id="app">hello poodle</div><script type="module" src="./main.ts"></script></body>
</html>
```

`src/renderer/pet/main.ts`:
```ts
console.log("pet renderer up");
```

`src/renderer/pet/style.css`:
```css
body { margin: 0; font-family: sans-serif; }
```

빈 스텁도 생성:
- `src/renderer/bubble/index.html` (동일 골격, id=`app`, 텍스트 "bubble")
- `src/renderer/memo/index.html` (동일, "memo")
- `src/renderer/launcher/index.html` (동일, "launcher")
- 각 폴더에 빈 `main.ts`, `style.css`

- [ ] **Step 6: Vitest sanity 테스트**

`tests/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("wires vitest", () => expect(1 + 1).toBe(2));
});
```

`vitest.config.ts` (프로젝트 루트):
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { globals: true, environment: "node", include: ["tests/unit/**/*.test.ts"] }
});
```

- [ ] **Step 7: 설치 + 실행 검증**

```powershell
npm install
npm test
npm run dev
```

Expected:
- `npm test` PASS
- `npm run dev` → 창 뜨고 "hello poodle" 표시, 콘솔에 "pet renderer up"

- [ ] **Step 8: 커밋**

```bash
git add package.json tsconfig.json electron.vite.config.ts vitest.config.ts .gitignore src/ tests/
git commit -m "chore: 프로젝트 부트스트랩 (electron-vite + vitest)"
```

---

## Task 2: Store 모듈 (atomic write + 백업 로테이션)

**Files:**
- Create: `src/main/paths.ts`, `src/main/store.ts`
- Create: `src/shared/types.ts`
- Test: `tests/unit/store.test.ts`

**Interfaces:**
- Consumes: `app.getPath('userData')` (Electron), Node `fs`
- Produces:
  - `Memo`, `Launcher`, `Settings` 타입 (`src/shared/types.ts`)
  - `class Store<T>` — `load(): T`, `save(data: T): void`, `runDailyBackup(): void`
  - Store 인스턴스: `memosStore`, `launchersStore`, `settingsStore`
  - 깨진 파일 시 `<name>.broken-YYYYMMDD-HHmmss.json`으로 이동 후 default 반환

- [ ] **Step 1: 타입 정의 작성**

`src/shared/types.ts`:
```ts
export type Memo = {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Launcher = {
  id: string;
  name: string;
  type: "file" | "folder" | "url";
  target: string;
  order: number;
};

export type Settings = {
  spriteScale: number;       // 3~5
  walkSpeedPxPerSec: number; // 기본 40
  shortcutQuickMemo: string; // 기본 "CommandOrControl+Alt+M"
  hideOnFullscreen: boolean; // 기본 true
};

export const DEFAULT_SETTINGS: Settings = {
  spriteScale: 4,
  walkSpeedPxPerSec: 40,
  shortcutQuickMemo: "CommandOrControl+Alt+M",
  hideOnFullscreen: true
};

export type PetState = "idle" | "walk" | "sit" | "sleep" | "drag" | "fall" | "happy";
```

- [ ] **Step 2: paths 스텁 (테스트용 주입 가능하게)**

`src/main/paths.ts`:
```ts
import { app } from "electron";
import { join } from "node:path";

let overrideRoot: string | null = null;

export function setUserDataRootForTest(root: string | null) {
  overrideRoot = root;
}

export function userDataRoot(): string {
  if (overrideRoot) return overrideRoot;
  return app.getPath("userData");
}

export const filePath = (name: string) => join(userDataRoot(), name);
export const backupDir = () => join(userDataRoot(), "backup");
```

- [ ] **Step 3: 실패 테스트 먼저 — atomic write + load**

`tests/unit/store.test.ts` (초기):
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setUserDataRootForTest } from "../../src/main/paths";
import { Store } from "../../src/main/store";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "poodle-store-"));
  setUserDataRootForTest(tmp);
});

afterEach(() => {
  setUserDataRootForTest(null);
  rmSync(tmp, { recursive: true, force: true });
});

describe("Store", () => {
  it("saves and loads JSON", () => {
    const s = new Store<{ n: number }>("memos.json", { n: 0 });
    s.save({ n: 42 });
    expect(s.load()).toEqual({ n: 42 });
  });

  it("returns default when file missing", () => {
    const s = new Store<{ n: number }>("missing.json", { n: 7 });
    expect(s.load()).toEqual({ n: 7 });
  });

  it("moves corrupt file aside and returns default", () => {
    writeFileSync(join(tmp, "broken.json"), "{ not json");
    const s = new Store<{ n: number }>("broken.json", { n: 1 });
    expect(s.load()).toEqual({ n: 1 });
    const brokenFiles = require("fs").readdirSync(tmp).filter((f: string) => f.startsWith("broken.broken-"));
    expect(brokenFiles).toHaveLength(1);
  });
});
```

- [ ] **Step 4: 테스트 실행 (RED)**

```powershell
npm test -- store
```
Expected: FAIL (Store 없음)

- [ ] **Step 5: Store 구현**

`src/main/store.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { filePath, backupDir, userDataRoot } from "./paths";

export class Store<T> {
  constructor(private name: string, private defaults: T) {}

  private path() { return filePath(this.name); }

  load(): T {
    const p = this.path();
    if (!existsSync(p)) return structuredClone(this.defaults);
    try {
      return JSON.parse(readFileSync(p, "utf8")) as T;
    } catch {
      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      const brokenName = `${this.name.replace(/\.json$/, "")}.broken-${ts}.json`;
      renameSync(p, filePath(brokenName));
      return structuredClone(this.defaults);
    }
  }

  save(data: T): void {
    const p = this.path();
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, p);
  }
}

export function runDailyBackup(names: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const dir = join(backupDir(), today);
  if (existsSync(dir)) return;
  mkdirSync(dir, { recursive: true });
  for (const n of names) {
    const src = filePath(n);
    if (existsSync(src)) cpSync(src, join(dir, n));
  }
  pruneBackups(7);
}

function pruneBackups(keep: number) {
  const root = backupDir();
  if (!existsSync(root)) return;
  const entries = readdirSync(root).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  const excess = entries.slice(0, Math.max(0, entries.length - keep));
  for (const e of excess) rmSync(join(root, e), { recursive: true, force: true });
}
```

- [ ] **Step 6: 테스트 실행 (GREEN)**

```powershell
npm test -- store
```
Expected: PASS 3/3

- [ ] **Step 7: 백업 로테이션 테스트 추가**

`tests/unit/store.test.ts`에 추가:
```ts
import { runDailyBackup } from "../../src/main/store";
import { mkdirSync } from "node:fs";

it("keeps only 7 most recent backup dirs", () => {
  const s = new Store<{ n: number }>("memos.json", { n: 0 });
  s.save({ n: 1 });
  const root = join(tmp, "backup");
  mkdirSync(root, { recursive: true });
  // 10일치 더미 백업 폴더 (오늘보다 과거)
  for (let i = 1; i <= 10; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    mkdirSync(join(root, d.toISOString().slice(0, 10)));
  }
  runDailyBackup(["memos.json"]);
  const dirs = require("fs").readdirSync(root).filter((x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x));
  expect(dirs.length).toBe(7);
});

it("skips backup if today folder exists", () => {
  const s = new Store<{ n: number }>("memos.json", { n: 0 });
  s.save({ n: 1 });
  runDailyBackup(["memos.json"]);
  const today = new Date().toISOString().slice(0, 10);
  const marker = join(tmp, "backup", today, "marker");
  writeFileSync(marker, "x");
  runDailyBackup(["memos.json"]); // 재실행
  expect(existsSync(marker)).toBe(true); // 덮어쓰지 않음
});
```

```powershell
npm test -- store
```
Expected: PASS 5/5

- [ ] **Step 8: 커밋**

```bash
git add src/shared/types.ts src/main/paths.ts src/main/store.ts tests/unit/store.test.ts
git commit -m "feat(store): atomic write + 백업 로테이션 + 깨진 파일 복구"
```

---

## Task 3: Sprite Manifest + 임시 스프라이트 생성기

**Files:**
- Create: `scripts/gen-placeholder-sprite.mjs`
- Create: `characters/poodle/manifest.json`
- Create: `characters/poodle/sprite.png` (생성물, 커밋 포함)
- Create: `src/shared/manifest.ts`
- Test: `tests/unit/manifest.test.ts`

**Interfaces:**
- Produces:
  - `SpriteManifest` 타입 + `loadManifest(dir: string): SpriteManifest`
  - `frameRect(manifest, anim, frameIndex): { x, y, w, h }`
  - `characters/poodle/sprite.png` (32×32 × 6행 × 6열 = 192×192)

- [ ] **Step 1: manifest.json 작성**

`characters/poodle/manifest.json`:
```json
{
  "frameSize": 32,
  "animations": {
    "idle":  { "row": 0, "frames": 4, "fps": 4 },
    "walk":  { "row": 1, "frames": 6, "fps": 8 },
    "sit":   { "row": 2, "frames": 2, "fps": 2 },
    "sleep": { "row": 3, "frames": 3, "fps": 2 },
    "drag":  { "row": 4, "frames": 2, "fps": 6 },
    "happy": { "row": 5, "frames": 4, "fps": 8 }
  }
}
```

- [ ] **Step 2: 임시 스프라이트 생성기 (pngjs)**

`scripts/gen-placeholder-sprite.mjs`:
```js
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
```

- [ ] **Step 3: 스프라이트 생성 실행**

```powershell
npm run gen:sprite
```

Expected: `characters/poodle/sprite.png` (약 192×192) 생성.

- [ ] **Step 4: manifest 파서 실패 테스트**

`tests/unit/manifest.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadManifest, frameRect } from "../../src/shared/manifest";
import { join } from "node:path";

const dir = join(__dirname, "../../characters/poodle");

describe("SpriteManifest", () => {
  it("loads manifest.json", () => {
    const m = loadManifest(dir);
    expect(m.frameSize).toBe(32);
    expect(m.animations.walk.frames).toBe(6);
  });

  it("computes frame rects", () => {
    const m = loadManifest(dir);
    const r = frameRect(m, "walk", 2);
    expect(r).toEqual({ x: 64, y: 32, w: 32, h: 32 });
  });

  it("throws on unknown animation", () => {
    const m = loadManifest(dir);
    expect(() => frameRect(m, "nope" as any, 0)).toThrow();
  });

  it("wraps frame index modulo total frames", () => {
    const m = loadManifest(dir);
    const total = m.animations.idle.frames;
    expect(frameRect(m, "idle", total)).toEqual(frameRect(m, "idle", 0));
  });
});
```

```powershell
npm test -- manifest
```
Expected: FAIL (모듈 없음)

- [ ] **Step 5: 파서 구현**

`src/shared/manifest.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type AnimationName = "idle" | "walk" | "sit" | "sleep" | "drag" | "happy";

export type SpriteManifest = {
  frameSize: number;
  animations: Record<AnimationName, { row: number; frames: number; fps: number }>;
};

export function loadManifest(dir: string): SpriteManifest {
  const raw = readFileSync(join(dir, "manifest.json"), "utf8");
  return JSON.parse(raw) as SpriteManifest;
}

export function frameRect(m: SpriteManifest, anim: AnimationName, frameIndex: number) {
  const def = m.animations[anim];
  if (!def) throw new Error(`unknown animation: ${anim}`);
  const c = ((frameIndex % def.frames) + def.frames) % def.frames;
  return { x: c * m.frameSize, y: def.row * m.frameSize, w: m.frameSize, h: m.frameSize };
}
```

```powershell
npm test -- manifest
```
Expected: PASS 4/4

- [ ] **Step 6: 커밋 (생성된 sprite.png 포함)**

```bash
git add scripts/gen-placeholder-sprite.mjs characters/ src/shared/manifest.ts tests/unit/manifest.test.ts
git commit -m "feat(sprite): 매니페스트 파서 + 임시 스프라이트 생성기"
```

---

## Task 4: 투명 펫 창 + 스프라이트 애니메이션 렌더러

**Files:**
- Create: `src/main/pet-window.ts`
- Create: `src/preload/index.ts` (교체), `src/preload/api.d.ts`
- Modify: `src/main/index.ts` (완전 교체)
- Modify: `src/renderer/pet/index.html`, `src/renderer/pet/main.ts`, `src/renderer/pet/style.css`

**Interfaces:**
- Consumes: `SpriteManifest`, `frameRect` (Task 3)
- Produces:
  - `createPetWindow(): BrowserWindow` — 투명·프레임 없음·항상 위·`skipTaskbar: true`, 크기 = `frameSize × scale`
  - preload API: `window.pet.getSprite(): Promise<{ manifestPath, imagePath, scale }>`
  - Renderer가 `idle` 애니메이션을 4배 확대로 재생

- [ ] **Step 1: preload 작성**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{
    manifestPath: string; imagePath: string; scale: number;
  }>
};

contextBridge.exposeInMainWorld("pet", api);
export type PetApi = typeof api;
```

`src/preload/api.d.ts`:
```ts
import type { PetApi } from "./index";
declare global { interface Window { pet: PetApi } }
export {};
```

- [ ] **Step 2: pet-window 작성**

`src/main/pet-window.ts`:
```ts
import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

export function createPetWindow(scale: number, frameSize: number): BrowserWindow {
  const primary = screen.getPrimaryDisplay().workArea;
  const size = frameSize * scale;
  const win = new BrowserWindow({
    width: size,
    height: size,
    x: primary.x + Math.floor(primary.width / 2 - size / 2),
    y: primary.y + primary.height - size - 4,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}
```

- [ ] **Step 3: main/index.ts 교체**

```ts
import { app, ipcMain, protocol, net } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPetWindow } from "./pet-window";
import { loadManifest } from "../shared/manifest";
import { DEFAULT_SETTINGS } from "../shared/types";

const characterDir = join(__dirname, "../../characters/poodle");

async function bootstrap() {
  const manifest = loadManifest(characterDir);
  const scale = DEFAULT_SETTINGS.spriteScale;

  ipcMain.handle("sprite:get", () => ({
    manifestPath: pathToFileURL(join(characterDir, "manifest.json")).toString(),
    imagePath: pathToFileURL(join(characterDir, "sprite.png")).toString(),
    scale
  }));

  const win = createPetWindow(scale, manifest.frameSize);
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/pet/index.html"));
  }
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
```

- [ ] **Step 4: pet renderer 작성**

`src/renderer/pet/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8"><link rel="stylesheet" href="./style.css"></head>
  <body>
    <canvas id="pet" width="0" height="0"></canvas>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/pet/style.css`:
```css
html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
canvas { image-rendering: pixelated; }
```

`src/renderer/pet/main.ts`:
```ts
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
```

- [ ] **Step 5: 실행 확인**

```powershell
npm run dev
```

Expected: 화면 하단 중앙에 128×128 투명 창, idle 애니메이션(초콜릿 색) 재생. 작업표시줄에는 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/main/pet-window.ts src/main/index.ts src/preload/ src/renderer/pet/
git commit -m "feat(pet): 투명 창 + 스프라이트 애니메이션 렌더러"
```

---

## Task 5: PetController 상태 머신 (순수 로직 + TDD)

**Files:**
- Create: `src/main/pet-controller.ts`
- Test: `tests/unit/pet-controller.test.ts`

**Interfaces:**
- Consumes: `PetState` (Task 2)
- Produces:
  - `class PetController` — 시간 tick 기반 상태 전환
  - `tick(nowMs: number): void`
  - `state: PetState` (readonly)
  - `onStateChange(cb: (s: PetState) => void): void`
  - `notify(kind: "click" | "dragStart" | "dragEnd"): void`
  - `wakeIfSleeping(): void`
  - 확률·타이머 주입 가능 (`opts.rng`, `opts.now` — 테스트용)

**전환 규칙 (spec §4 요약)**
- `idle` 진입 후 3~8초 후: walk 50% / idle 유지 30% / sit 20%
- `idle`이 30초 이상 지속되면 → `sit` → 이후 `sleep`
- `click` → `happy` (약 1.2s) → `idle`
- `dragStart` → `drag`, `dragEnd` → `fall` → 착지 시 `idle` (착지 이벤트는 외부에서 `notify("landed")` 대신 컨트롤러가 fall 지속시간 700ms 후 자동 idle)
- `sleep` 중 `click` → `happy`

- [ ] **Step 1: 실패 테스트 (초기 idle → walk 확률 분포)**

`tests/unit/pet-controller.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { PetController } from "../../src/main/pet-controller";

function make(opts: Partial<ConstructorParameters<typeof PetController>[0]> = {}) {
  return new PetController({ rng: () => 0.0, now: () => 0, ...opts });
}

describe("PetController — idle transitions", () => {
  it("starts in idle", () => {
    expect(make().state).toBe("idle");
  });

  it("after idle wait, rng<0.5 -> walk", () => {
    const c = make({ rng: () => 0.1, now: () => 0 });
    // idle 진입 후 최소 3초, 최대 8초 대기 — rng=0.1이면 wait = 3 + 5*0.1 = 3.5s
    c.tick(3500);
    expect(c.state).toBe("walk");
  });

  it("after idle wait, 0.5<=rng<0.8 -> idle 유지 (reset wait)", () => {
    // first rng picks wait (3.5s), second rng picks branch (0.6 -> stay)
    const rng = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.6).mockReturnValue(0.1);
    const c = new PetController({ rng, now: () => 0 });
    c.tick(3500);
    expect(c.state).toBe("idle");
  });

  it("after idle wait, rng>=0.8 -> sit", () => {
    const rng = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    const c = new PetController({ rng, now: () => 0 });
    c.tick(3500);
    expect(c.state).toBe("sit");
  });

  it("30s idle -> sit -> sleep", () => {
    // rng always picks stay-idle
    const rng = vi.fn().mockReturnValue(0.6);
    const c = new PetController({ rng, now: () => 0 });
    c.tick(30_000);
    expect(c.state).toBe("sleep");
  });
});

describe("PetController — interactions", () => {
  it("click -> happy -> idle after 1200ms", () => {
    const c = make();
    c.notify("click");
    expect(c.state).toBe("happy");
    c.tick(1200);
    expect(c.state).toBe("idle");
  });

  it("dragStart -> drag; dragEnd -> fall -> idle after 700ms", () => {
    const c = make();
    c.notify("dragStart");
    expect(c.state).toBe("drag");
    c.notify("dragEnd");
    expect(c.state).toBe("fall");
    c.tick(700);
    expect(c.state).toBe("idle");
  });

  it("click while sleep -> happy", () => {
    const rng = vi.fn().mockReturnValue(0.6);
    const c = new PetController({ rng, now: () => 0 });
    c.tick(30_000); // sleep
    expect(c.state).toBe("sleep");
    c.notify("click");
    expect(c.state).toBe("happy");
  });

  it("onStateChange fires on transitions", () => {
    const spy = vi.fn();
    const c = make();
    c.onStateChange(spy);
    c.notify("click");
    expect(spy).toHaveBeenCalledWith("happy");
  });
});
```

- [ ] **Step 2: 실행 (RED)**

```powershell
npm test -- pet-controller
```
Expected: FAIL

- [ ] **Step 3: PetController 구현**

`src/main/pet-controller.ts`:
```ts
import type { PetState } from "../shared/types";

type Opts = {
  rng?: () => number;
  now?: () => number;
};

const HAPPY_MS = 1200;
const FALL_MS = 700;
const IDLE_MIN_WAIT_MS = 3000;
const IDLE_MAX_WAIT_MS = 8000;
const IDLE_TO_SLEEP_MS = 30_000;

export class PetController {
  private _state: PetState = "idle";
  private listeners: Array<(s: PetState) => void> = [];
  private stateEnteredAt = 0;
  private idleWaitMs = 0;
  private idleAccumMs = 0; // idle에서 누적 시간 (sleep 판정용)
  private rng: () => number;
  private nowFn: () => number;
  private lastTickMs: number;

  constructor(opts: Opts = {}) {
    this.rng = opts.rng ?? Math.random;
    this.nowFn = opts.now ?? (() => performance.now());
    this.lastTickMs = this.nowFn();
    this.enter("idle");
  }

  get state(): PetState { return this._state; }

  onStateChange(cb: (s: PetState) => void) { this.listeners.push(cb); }

  tick(nowMs: number) {
    const dt = nowMs - this.lastTickMs;
    this.lastTickMs = nowMs;
    const inState = nowMs - this.stateEnteredAt;

    switch (this._state) {
      case "happy":
        if (inState >= HAPPY_MS) this.enter("idle");
        break;
      case "fall":
        if (inState >= FALL_MS) this.enter("idle");
        break;
      case "idle":
        this.idleAccumMs += dt;
        if (this.idleAccumMs >= IDLE_TO_SLEEP_MS) {
          this.enter("sleep");
          return;
        }
        if (inState >= this.idleWaitMs) this.rollIdleBranch();
        break;
      case "sit":
        // sit은 곧 sleep으로: idle 누적이 이미 임계면 sleep
        if (this.idleAccumMs >= IDLE_TO_SLEEP_MS) this.enter("sleep");
        break;
      // walk / sleep / drag: 외부 이벤트로만 전환
    }
  }

  notify(kind: "click" | "dragStart" | "dragEnd") {
    if (kind === "click") { this.enter("happy"); return; }
    if (kind === "dragStart") { this.enter("drag"); return; }
    if (kind === "dragEnd") { this.enter("fall"); return; }
  }

  private rollIdleBranch() {
    const r = this.rng();
    if (r < 0.5) this.enter("walk");
    else if (r < 0.8) this.enter("idle"); // 유지 = 재진입 (wait 재추첨)
    else this.enter("sit");
  }

  private enter(s: PetState) {
    const changed = s !== this._state;
    this._state = s;
    this.stateEnteredAt = this.lastTickMs;
    if (s === "idle") this.idleWaitMs = IDLE_MIN_WAIT_MS + this.rng() * (IDLE_MAX_WAIT_MS - IDLE_MIN_WAIT_MS);
    if (s !== "idle" && s !== "sit" && s !== "sleep") this.idleAccumMs = 0;
    if (s === "happy" || s === "walk") this.idleAccumMs = 0;
    if (changed) this.listeners.forEach(cb => cb(s));
  }
}
```

- [ ] **Step 4: 실행 (GREEN)**

```powershell
npm test -- pet-controller
```
Expected: PASS 9/9. 실패 시 rng 소비 순서를 테스트 기대치와 맞춰 조정.

- [ ] **Step 5: 커밋**

```bash
git add src/main/pet-controller.ts tests/unit/pet-controller.test.ts
git commit -m "feat(pet): PetController 상태 머신 (idle 확률·sleep·happy·fall)"
```

---

## Task 6: 화면 경계·바닥선 + walk 이동 통합

**Files:**
- Create: `src/main/screen-utils.ts`
- Modify: `src/main/index.ts` (PetController + tick 루프 + walk 이동)
- Test: `tests/unit/screen-utils.test.ts`

**Interfaces:**
- Consumes: Electron `screen`, `BrowserWindow`
- Produces:
  - `type Rect = { x, y, width, height }`
  - `groundY(display: Rect, petHeight): number` — 작업표시줄 위 바닥선의 y좌표
  - `clampToWorkArea(pos, size, display)` — 창을 workArea 안에 유지
  - `displayContaining(pos): Display` — 좌표가 속한 모니터
  - `class WalkDriver` — direction(-1/+1), speed(px/s), 화면 끝에서 방향 전환

- [ ] **Step 1: screen-utils 실패 테스트**

`tests/unit/screen-utils.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { groundY, clampToWorkArea, WalkDriver } from "../../src/main/screen-utils";

const display = { x: 0, y: 0, width: 1920, height: 1040 }; // taskbar 40px 제외

describe("groundY", () => {
  it("returns bottom minus petHeight", () => {
    expect(groundY(display, 128)).toBe(1040 - 128);
  });
});

describe("clampToWorkArea", () => {
  it("clamps left/right", () => {
    expect(clampToWorkArea({ x: -50, y: 100 }, { w: 128, h: 128 }, display)).toEqual({ x: 0, y: 100 });
    expect(clampToWorkArea({ x: 2000, y: 100 }, { w: 128, h: 128 }, display)).toEqual({ x: 1920 - 128, y: 100 });
  });
});

describe("WalkDriver", () => {
  it("advances by speed*dt", () => {
    const w = new WalkDriver({ x: 100, direction: 1, speedPxPerSec: 40, minX: 0, maxX: 1000 });
    w.tick(500); // 0.5s -> 20px
    expect(w.x).toBe(120);
  });

  it("reverses at right edge", () => {
    const w = new WalkDriver({ x: 990, direction: 1, speedPxPerSec: 40, minX: 0, maxX: 1000 });
    w.tick(1000); // +40 -> 1030, clamp to 1000, direction becomes -1
    expect(w.x).toBe(1000);
    expect(w.direction).toBe(-1);
  });

  it("reverses at left edge", () => {
    const w = new WalkDriver({ x: 10, direction: -1, speedPxPerSec: 40, minX: 0, maxX: 1000 });
    w.tick(1000);
    expect(w.x).toBe(0);
    expect(w.direction).toBe(1);
  });
});
```

- [ ] **Step 2: 실행 (RED)**

```powershell
npm test -- screen-utils
```
Expected: FAIL

- [ ] **Step 3: 구현**

`src/main/screen-utils.ts`:
```ts
export type Rect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

export function groundY(display: Rect, petHeight: number): number {
  return display.y + display.height - petHeight;
}

export function clampToWorkArea(pos: Point, size: { w: number; h: number }, display: Rect): Point {
  return {
    x: Math.max(display.x, Math.min(display.x + display.width - size.w, pos.x)),
    y: Math.max(display.y, Math.min(display.y + display.height - size.h, pos.y))
  };
}

type WalkOpts = { x: number; direction: 1 | -1; speedPxPerSec: number; minX: number; maxX: number };

export class WalkDriver {
  x: number;
  direction: 1 | -1;
  private speed: number;
  private min: number;
  private max: number;

  constructor(opts: WalkOpts) {
    this.x = opts.x;
    this.direction = opts.direction;
    this.speed = opts.speedPxPerSec;
    this.min = opts.minX;
    this.max = opts.maxX;
  }

  tick(dtMs: number) {
    this.x += this.direction * this.speed * (dtMs / 1000);
    if (this.x >= this.max) { this.x = this.max; this.direction = -1; }
    if (this.x <= this.min) { this.x = this.min; this.direction = 1; }
  }
}

// Electron screen 헬퍼 — 테스트 대상 아님
export function displayContainingElectron(screen: Electron.Screen, pos: Point): Rect {
  const d = screen.getDisplayNearestPoint(pos);
  return { x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height };
}
```

- [ ] **Step 4: GREEN 확인**

```powershell
npm test -- screen-utils
```
Expected: PASS 4/4

- [ ] **Step 5: main/index.ts — 컨트롤러+walk 통합**

`src/main/index.ts`에서 bootstrap 확장 (교체):
```ts
import { app, ipcMain, screen } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPetWindow } from "./pet-window";
import { loadManifest } from "../shared/manifest";
import { DEFAULT_SETTINGS } from "../shared/types";
import { PetController } from "./pet-controller";
import { WalkDriver, displayContainingElectron, groundY, clampToWorkArea } from "./screen-utils";

const characterDir = join(__dirname, "../../characters/poodle");

async function bootstrap() {
  const manifest = loadManifest(characterDir);
  const scale = DEFAULT_SETTINGS.spriteScale;
  const petSize = manifest.frameSize * scale;

  ipcMain.handle("sprite:get", () => ({
    manifestPath: pathToFileURL(join(characterDir, "manifest.json")).toString(),
    imagePath: pathToFileURL(join(characterDir, "sprite.png")).toString(),
    scale
  }));

  const win = createPetWindow(scale, manifest.frameSize);
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/pet/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/pet/index.html"));
  }

  const controller = new PetController();
  controller.onStateChange(s => win.webContents.send("pet:state", s));

  const initialBounds = win.getBounds();
  const disp = displayContainingElectron(screen, { x: initialBounds.x, y: initialBounds.y });
  const walker = new WalkDriver({
    x: initialBounds.x,
    direction: 1,
    speedPxPerSec: DEFAULT_SETTINGS.walkSpeedPxPerSec,
    minX: disp.x,
    maxX: disp.x + disp.width - petSize
  });

  let last = performance.now();
  const loop = setInterval(() => {
    const now = performance.now();
    const dt = now - last; last = now;

    controller.tick(now);
    const y = groundY(disp, petSize);

    if (controller.state === "walk") {
      walker.tick(dt);
      win.setBounds({ x: Math.round(walker.x), y, width: petSize, height: petSize });
      win.webContents.send("pet:facing", walker.direction);
    } else if (controller.state === "idle" || controller.state === "sit" || controller.state === "sleep") {
      // 정지 상태에서는 바닥선 유지
      const b = win.getBounds();
      win.setBounds({ x: b.x, y, width: petSize, height: petSize });
    }
  }, 33); // ~30fps 위치 갱신

  app.on("before-quit", () => clearInterval(loop));
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => app.quit());
```

`src/preload/index.ts`에 pet:state / pet:facing 구독 API 추가:
```ts
import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{
    manifestPath: string; imagePath: string; scale: number;
  }>,
  onState: (cb: (s: string) => void) => ipcRenderer.on("pet:state", (_, s) => cb(s)),
  onFacing: (cb: (d: number) => void) => ipcRenderer.on("pet:facing", (_, d) => cb(d))
};

contextBridge.exposeInMainWorld("pet", api);
export type PetApi = typeof api;
```

`src/renderer/pet/main.ts` — 상태·facing 반영:
```ts
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
```

- [ ] **Step 6: 실행 확인**

```powershell
npm run dev
```

Expected: 푸들이 잠시 idle 후 좌우로 걸어다니고 화면 끝에서 방향 전환. 30초 정지시 sleep.

- [ ] **Step 7: 커밋**

```bash
git add src/main/screen-utils.ts src/main/index.ts src/preload/index.ts src/renderer/pet/main.ts tests/unit/screen-utils.test.ts
git commit -m "feat(pet): walk 이동·바닥선 유지·좌우 반전 통합"
```

---

## Task 7: 클릭/드래그 상호작용 + 말풍선 메뉴

**Files:**
- Modify: `src/renderer/pet/main.ts` (클릭·드래그 이벤트)
- Modify: `src/renderer/pet/style.css` (`-webkit-app-region: drag` 영역 설정)
- Modify: `src/preload/index.ts` (`petAction` API)
- Modify: `src/main/index.ts` (bubble window 생성 + notify 라우팅)
- Create: `src/main/bubble-window.ts`
- Modify: `src/renderer/bubble/index.html`, `src/renderer/bubble/main.ts`, `src/renderer/bubble/style.css`

**Interfaces:**
- Consumes: `createPetWindow` (Task 4), `PetController.notify` (Task 5)
- Produces:
  - preload: `window.pet.action(kind: "click" | "dragStart" | "dragEnd"): void`
  - preload: `window.pet.openBubble(anchor: {x,y}): void`, `window.pet.chooseAction(a: "memo" | "launcher" | "sleep"): void`
  - bubble 창은 pet 창 위에 뜨고 3개 버튼 표시

- [ ] **Step 1: preload IPC 확장**

```ts
import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{ manifestPath: string; imagePath: string; scale: number }>,
  onState: (cb: (s: string) => void) => ipcRenderer.on("pet:state", (_, s) => cb(s)),
  onFacing: (cb: (d: number) => void) => ipcRenderer.on("pet:facing", (_, d) => cb(d)),
  action: (kind: "click" | "dragStart" | "dragEnd") => ipcRenderer.send("pet:action", kind),
  openBubble: (anchor: { x: number; y: number }) => ipcRenderer.send("bubble:open", anchor),
  chooseAction: (a: "memo" | "launcher" | "sleep") => ipcRenderer.send("bubble:choose", a)
};

contextBridge.exposeInMainWorld("pet", api);
export type PetApi = typeof api;
```

- [ ] **Step 2: main — action 라우팅 + bubble window**

`src/main/bubble-window.ts`:
```ts
import { BrowserWindow } from "electron";
import { join } from "node:path";

const W = 180, H = 60;

export function createBubbleWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: W, height: H,
    frame: false, transparent: true, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    show: false, focusable: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}

export const bubbleSize = { w: W, h: H };
```

`src/main/index.ts`에 추가/수정 (bootstrap 안):
```ts
import { createBubbleWindow, bubbleSize } from "./bubble-window";
// ...
const bubble = createBubbleWindow();
if (process.env.ELECTRON_RENDERER_URL) bubble.loadURL(`${process.env.ELECTRON_RENDERER_URL}/bubble/index.html`);
else bubble.loadFile(join(__dirname, "../renderer/bubble/index.html"));

ipcMain.on("pet:action", (_, kind: "click" | "dragStart" | "dragEnd") => {
  controller.notify(kind);
});

ipcMain.on("bubble:open", (_, anchor: { x: number; y: number }) => {
  bubble.setBounds({
    x: anchor.x - Math.floor(bubbleSize.w / 2) + Math.floor(petSize / 2),
    y: anchor.y - bubbleSize.h - 8,
    width: bubbleSize.w, height: bubbleSize.h
  });
  bubble.showInactive();
});

ipcMain.on("bubble:choose", (_, a: "memo" | "launcher" | "sleep") => {
  bubble.hide();
  // Task 9/10/11에서 확장. v1 스텁: sleep은 강제 sleep, memo/launcher는 후속 창 오픈.
  if (a === "sleep") controller["enter"]("sleep" as any); // 강제 전환 훅 필요 시 public 메서드로 승격
});

bubble.on("blur", () => bubble.hide());
```

- [ ] **Step 3: pet renderer — 클릭/드래그 이벤트 붙이기**

`src/renderer/pet/style.css`:
```css
html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; -webkit-user-select: none; }
canvas { image-rendering: pixelated; -webkit-app-region: drag; }
```

주: `-webkit-app-region: drag`는 Electron 창 드래그. 클릭 이벤트를 받으려면 dragStart/End를 마우스 이벤트로 감지해야 함. 대안: `no-drag`로 두고 창 자체 drag는 커스텀 (`ipcRenderer` → `win.setPosition`)으로 처리. **v1은 커스텀 드래그 채택** (드래그 상태 알림이 명확).

`src/renderer/pet/style.css` 교체:
```css
html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; -webkit-user-select: none; cursor: pointer; }
canvas { image-rendering: pixelated; }
```

`src/renderer/pet/main.ts` 끝부분에 이벤트 훅 추가:
```ts
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
  if (dragged) window.pet.action("dragEnd");
  else {
    const anchor = { x: e.screenX - e.clientX, y: e.screenY - e.clientY };
    window.pet.action("click");
    window.pet.openBubble(anchor);
  }
  dragStartPt = null; dragged = false;
});
```

preload에 `dragMove` 추가:
```ts
dragMove: (delta: { dx: number; dy: number }) => ipcRenderer.send("pet:dragMove", delta)
```

main에 handler 추가 (drag 시작 시 anchor 저장):
```ts
let dragAnchor: { winX: number; winY: number; startedAt: number } | null = null;
ipcMain.on("pet:action", (_, kind: "click" | "dragStart" | "dragEnd") => {
  if (kind === "dragStart" && !dragAnchor) {
    const b = win.getBounds();
    dragAnchor = { winX: b.x, winY: b.y, startedAt: Date.now() };
  }
  if (kind === "dragEnd") dragAnchor = null;
  controller.notify(kind);
});

ipcMain.on("pet:dragMove", (_, delta: { dx: number; dy: number }) => {
  if (!dragAnchor) return;
  const newDisp = displayContainingElectron(screen, { x: dragAnchor.winX + delta.dx, y: dragAnchor.winY + delta.dy });
  const clamped = clampToWorkArea(
    { x: dragAnchor.winX + delta.dx, y: dragAnchor.winY + delta.dy },
    { w: petSize, h: petSize },
    newDisp
  );
  win.setBounds({ x: clamped.x, y: clamped.y, width: petSize, height: petSize });
});
```

또한 dragEnd 후 fall이 끝나면 새 모니터 바닥에 안착해야 하므로, `displayContainingElectron`으로 walker의 min/max/y를 갱신:
```ts
// controller.onStateChange 안에서:
controller.onStateChange((s) => {
  win.webContents.send("pet:state", s);
  if (s === "idle") {
    const b = win.getBounds();
    const d = displayContainingElectron(screen, { x: b.x, y: b.y });
    Object.assign(walker, { x: b.x, minX: d.x, maxX: d.x + d.width - petSize });
    // 바닥 스냅
    win.setBounds({ x: b.x, y: groundY(d, petSize), width: petSize, height: petSize });
  }
});
```

- [ ] **Step 4: bubble renderer**

`src/renderer/bubble/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8"><link rel="stylesheet" href="./style.css"></head>
  <body>
    <div class="bubble">
      <button data-a="memo" title="메모">📝</button>
      <button data-a="launcher" title="바로가기">🚀</button>
      <button data-a="sleep" title="재우기">💤</button>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/bubble/style.css`:
```css
html, body { margin: 0; padding: 0; background: transparent; }
.bubble {
  display: flex; gap: 8px; padding: 8px 12px;
  background: white; border: 2px solid #8b4513; border-radius: 16px;
  font-size: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
button { background: none; border: none; cursor: pointer; font-size: 22px; }
button:hover { background: #f5deb3; border-radius: 8px; }
```

`src/renderer/bubble/main.ts`:
```ts
document.querySelectorAll<HTMLButtonElement>("button[data-a]").forEach(btn => {
  btn.addEventListener("click", () => {
    window.pet.chooseAction(btn.dataset.a as "memo" | "launcher" | "sleep");
  });
});
```

- [ ] **Step 5: PetController.enter를 public으로 승격 (강제 sleep용)**

`src/main/pet-controller.ts`에 public 메서드 추가:
```ts
forceState(s: PetState) { this.enter(s); }
```

`src/main/index.ts`의 `controller["enter"]` 호출을 `controller.forceState("sleep")`로 교체.

- [ ] **Step 6: 실행 확인**

```powershell
npm run dev
```

Expected:
- 푸들 클릭 → happy(꼬리 흔들기) + 말풍선 3버튼
- 푸들 드래그 → drag 상태, 놓으면 fall → idle
- 다른 모니터로 드래그 이동 가능
- 말풍선 💤 클릭 → sleep

- [ ] **Step 7: 커밋**

```bash
git add src/main/bubble-window.ts src/main/index.ts src/main/pet-controller.ts src/preload/ src/renderer/pet/ src/renderer/bubble/
git commit -m "feat(pet): 클릭/드래그 상호작용 + 말풍선 메뉴 (📝🚀💤)"
```

---

## Task 8: 트레이 + 전체화면 자동 숨김 + 단일 인스턴스

**Files:**
- Create: `src/main/tray.ts`
- Modify: `src/main/index.ts` (초반부 단일 인스턴스, 트레이 부착, 전체화면 감지)

**Interfaces:**
- Consumes: `BrowserWindow` (pet), `app`
- Produces:
  - `createTray(pet: BrowserWindow, onQuit: () => void): Tray`
  - 전체화면 감지: 주 모니터에서 다른 창이 workArea 전체를 덮으면 숨김. 간단히 `powerMonitor`+`screen` 대신 **1초 폴링**으로 `win.getBounds()` 대비 활성 창 크기 비교는 어려우므로, **`electron`의 `screen.getPrimaryDisplay().workAreaSize` vs `screen.getPrimaryDisplay().bounds` 차이가 사라졌는지**로 간이 판정 (작업표시줄 자동 숨김 여부와 겹칠 수 있음). 더 정확한 API가 필요하면 **`electron-fullscreen-detection`**을 v2로 미루고, v1은 **트레이 메뉴 "숨기기/보이기" 수동 토글**을 1순위로, 자동 숨김은 폴링 기반 근사치.

**결정**: v1 자동 숨김은 **Windows `Shell_TrayWnd`가 최상위인지 검사**하는 대신, 단순히 `screen.getPrimaryDisplay().bounds.height === workAreaSize.height`일 때 = 작업표시줄 숨김 상태 = 전체화면 앱이 활성일 가능성이 높다는 신호로 사용. 5초 폴링. 오탐 있으면 트레이에서 수동 복구 가능.

- [ ] **Step 1: tray 구현**

`src/main/tray.ts`:
```ts
import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { join } from "node:path";

export function createTray(pet: BrowserWindow, onQuit: () => void, characterDir: string): Tray {
  // 트레이 아이콘: 스프라이트에서 첫 프레임 잘라 쓸 수도 있으나 v1은 sprite.png 그대로 (32×32 idle 프레임)
  const iconPath = join(characterDir, "sprite.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: "숨기기/보이기", click: () => (pet.isVisible() ? pet.hide() : pet.show()) },
    { label: "설정 (준비 중)", enabled: false },
    { type: "separator" },
    { label: "종료", click: () => { onQuit(); app.quit(); } }
  ]);
  tray.setToolTip("Poodle Pet");
  tray.setContextMenu(menu);
  return tray;
}
```

- [ ] **Step 2: main/index.ts — 단일 인스턴스 + 트레이 + 폴링**

`app.whenReady` 이전에:
```ts
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on("second-instance", () => {
  // 기존 인스턴스가 짧게 happy 반응
  if (currentPetWindow) {
    currentPetWindow.show();
    currentPetWindow.webContents.send("pet:state", "happy");
    setTimeout(() => currentPetWindow?.webContents.send("pet:state", "idle"), 1200);
  }
});
let currentPetWindow: BrowserWindow | null = null;
```

bootstrap 내부 (win 생성 뒤):
```ts
currentPetWindow = win;
const tray = createTray(win, () => clearInterval(loop), characterDir);

if (DEFAULT_SETTINGS.hideOnFullscreen) {
  setInterval(() => {
    const primary = screen.getPrimaryDisplay();
    const isFullscreen =
      primary.bounds.height === primary.workAreaSize.height &&
      primary.bounds.width === primary.workAreaSize.width;
    if (isFullscreen && win.isVisible()) win.hide();
    if (!isFullscreen && !win.isVisible()) win.show();
  }, 5000);
}
```

`createTray` import 추가.

- [ ] **Step 3: 실행 확인**

```powershell
npm run dev
```

Expected:
- 트레이에 아이콘 등장 (16×16), 우클릭 → 메뉴
- "숨기기/보이기" 토글 동작
- 앱을 두 번 실행 시 두 번째는 실행되지 않고 첫 번째 푸들이 happy
- 전체화면 게임/영상 실행 시 5초 이내 자동 숨김 (오탐 시 트레이에서 수동 복구)

- [ ] **Step 4: 커밋**

```bash
git add src/main/tray.ts src/main/index.ts
git commit -m "feat(pet): 트레이 메뉴 + 전체화면 자동 숨김 + 단일 인스턴스"
```

---

## Task 9: 메모 창 (작성·목록·검색·고정)

**Files:**
- Create: `src/main/memo-window.ts`
- Modify: `src/main/index.ts` (memosStore, IPC 채널, bubble "📝" 클릭 → memo 창)
- Modify: `src/preload/index.ts` (memos API)
- Modify: `src/renderer/memo/index.html`, `src/renderer/memo/main.ts`, `src/renderer/memo/style.css`

**Interfaces:**
- Consumes: `Store<Memo[]>` (Task 2), `Memo` 타입 (Task 2), bubble action (Task 7)
- Produces:
  - preload: `window.memos.list(): Promise<Memo[]>`, `add({text}): Promise<Memo>`, `update(id, {text?, pinned?}): Promise<Memo>`, `remove(id): Promise<void>`, `search(q): Promise<Memo[]>`
  - memo 창: 상단 textarea + Enter 저장, 하단 목록(고정 우선 → 최신순), 검색 input
  - IPC: `memos:list`, `memos:add`, `memos:update`, `memos:remove`, `memos:search`

- [ ] **Step 1: memo-window**

`src/main/memo-window.ts`:
```ts
import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createMemoWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360, height: 480,
    frame: true, resizable: true,
    show: false, skipTaskbar: false, title: "메모 - Poodle Pet",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.setMenu(null);
  win.on("close", (e) => { e.preventDefault(); win.hide(); });
  return win;
}
```

- [ ] **Step 2: main — memos IPC + store 연결**

`src/main/index.ts` bootstrap 확장:
```ts
import { Store, runDailyBackup } from "./store";
import { createMemoWindow } from "./memo-window";
import type { Memo } from "../shared/types";
import { randomUUID } from "node:crypto";

// bootstrap 안:
const memosStore = new Store<Memo[]>("memos.json", []);
runDailyBackup(["memos.json", "launchers.json", "settings.json"]);

const memoWin = createMemoWindow();
if (process.env.ELECTRON_RENDERER_URL) memoWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}/memo/index.html`);
else memoWin.loadFile(join(__dirname, "../renderer/memo/index.html"));

ipcMain.handle("memos:list", () => sortMemos(memosStore.load()));
ipcMain.handle("memos:add", (_, payload: { text: string }) => {
  const now = new Date().toISOString();
  const m: Memo = { id: randomUUID(), text: payload.text, pinned: false, createdAt: now, updatedAt: now };
  const arr = memosStore.load(); arr.push(m); memosStore.save(arr);
  return m;
});
ipcMain.handle("memos:update", (_, id: string, patch: Partial<Pick<Memo, "text" | "pinned">>) => {
  const arr = memosStore.load();
  const idx = arr.findIndex(x => x.id === id);
  if (idx < 0) throw new Error("not found");
  arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
  memosStore.save(arr);
  return arr[idx];
});
ipcMain.handle("memos:remove", (_, id: string) => {
  memosStore.save(memosStore.load().filter(x => x.id !== id));
});
ipcMain.handle("memos:search", (_, q: string) => {
  const needle = q.toLowerCase();
  return sortMemos(memosStore.load().filter(m => m.text.toLowerCase().includes(needle)));
});

function sortMemos(arr: Memo[]): Memo[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

// bubble:choose 에서 "memo" 분기:
ipcMain.on("bubble:choose", (_, a: "memo" | "launcher" | "sleep") => {
  bubble.hide();
  if (a === "memo") { memoWin.show(); memoWin.focus(); }
  if (a === "launcher") { /* Task 11 */ }
  if (a === "sleep") controller.forceState("sleep");
});
```

- [ ] **Step 3: preload memos API**

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { Memo } from "../shared/types";

const pet = {
  getSprite: () => ipcRenderer.invoke("sprite:get"),
  onState: (cb: (s: string) => void) => ipcRenderer.on("pet:state", (_, s) => cb(s)),
  onFacing: (cb: (d: number) => void) => ipcRenderer.on("pet:facing", (_, d) => cb(d)),
  action: (kind: "click" | "dragStart" | "dragEnd") => ipcRenderer.send("pet:action", kind),
  dragMove: (delta: { dx: number; dy: number }) => ipcRenderer.send("pet:dragMove", delta),
  openBubble: (anchor: { x: number; y: number }) => ipcRenderer.send("bubble:open", anchor),
  chooseAction: (a: "memo" | "launcher" | "sleep") => ipcRenderer.send("bubble:choose", a)
};

const memos = {
  list: () => ipcRenderer.invoke("memos:list") as Promise<Memo[]>,
  add: (text: string) => ipcRenderer.invoke("memos:add", { text }) as Promise<Memo>,
  update: (id: string, patch: { text?: string; pinned?: boolean }) => ipcRenderer.invoke("memos:update", id, patch) as Promise<Memo>,
  remove: (id: string) => ipcRenderer.invoke("memos:remove", id) as Promise<void>,
  search: (q: string) => ipcRenderer.invoke("memos:search", q) as Promise<Memo[]>
};

contextBridge.exposeInMainWorld("pet", pet);
contextBridge.exposeInMainWorld("memos", memos);
export type PetApi = typeof pet;
export type MemosApi = typeof memos;
```

`src/preload/api.d.ts`:
```ts
import type { PetApi, MemosApi } from "./index";
declare global {
  interface Window { pet: PetApi; memos: MemosApi }
}
export {};
```

- [ ] **Step 4: memo renderer**

`src/renderer/memo/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8"><link rel="stylesheet" href="./style.css"></head>
  <body>
    <div id="wrap">
      <textarea id="input" placeholder="Enter로 저장 · Shift+Enter 줄바꿈"></textarea>
      <input id="search" placeholder="검색" />
      <ul id="list"></ul>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/memo/style.css`:
```css
html, body { margin: 0; padding: 0; font-family: sans-serif; height: 100%; }
#wrap { display: flex; flex-direction: column; height: 100vh; padding: 8px; box-sizing: border-box; gap: 6px; }
#input { height: 80px; resize: none; padding: 6px; }
#search { padding: 4px; }
#list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
#list li { border-bottom: 1px solid #eee; padding: 6px; display: flex; gap: 6px; align-items: flex-start; }
#list .text { flex: 1; white-space: pre-wrap; word-break: break-word; }
#list button { background: none; border: none; cursor: pointer; }
#list li.pinned { background: #fff8dc; }
```

`src/renderer/memo/main.ts`:
```ts
const input = document.getElementById("input") as HTMLTextAreaElement;
const search = document.getElementById("search") as HTMLInputElement;
const list = document.getElementById("list") as HTMLUListElement;

async function refresh() {
  const q = search.value.trim();
  const items = q ? await window.memos.search(q) : await window.memos.list();
  list.innerHTML = "";
  for (const m of items) {
    const li = document.createElement("li");
    if (m.pinned) li.classList.add("pinned");
    li.innerHTML = `
      <span class="text"></span>
      <button data-a="pin">${m.pinned ? "📌" : "📍"}</button>
      <button data-a="copy">📋</button>
      <button data-a="edit">✏️</button>
      <button data-a="del">🗑</button>`;
    (li.querySelector(".text") as HTMLElement).textContent = m.text;
    li.querySelector('[data-a="pin"]')!.addEventListener("click", async () => {
      await window.memos.update(m.id, { pinned: !m.pinned }); refresh();
    });
    li.querySelector('[data-a="copy"]')!.addEventListener("click", () => {
      navigator.clipboard.writeText(m.text);
    });
    li.querySelector('[data-a="edit"]')!.addEventListener("click", async () => {
      const t = prompt("수정", m.text);
      if (t !== null) { await window.memos.update(m.id, { text: t }); refresh(); }
    });
    li.querySelector('[data-a="del"]')!.addEventListener("click", async () => {
      if (confirm("삭제할까요?")) { await window.memos.remove(m.id); refresh(); }
    });
    list.appendChild(li);
  }
}

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    await window.memos.add(text);
    input.value = "";
    refresh();
  }
});
search.addEventListener("input", refresh);
refresh();
```

- [ ] **Step 5: 실행 확인**

```powershell
npm run dev
```

Expected:
- 푸들 클릭 → 📝 클릭 → 메모 창 오픈
- Enter로 메모 저장, 목록에 표시 (고정 우선, 최신순)
- 검색 즉시 반영, 수정·삭제·복사·📌 고정 동작
- 앱 재시작 → 메모 유지

- [ ] **Step 6: 커밋**

```bash
git add src/main/memo-window.ts src/main/index.ts src/preload/ src/renderer/memo/
git commit -m "feat(memo): 메모 CRUD·검색·고정·영구저장"
```

---

## Task 10: 전역 단축키 `Ctrl+Alt+M` + "기억했어요!" 반응

**Files:**
- Create: `src/main/shortcuts.ts`
- Modify: `src/main/index.ts` (등록 + 충돌 시 tray 알림)
- Modify: `src/renderer/pet/main.ts` ("기억했어요!" 말풍선 표시 지원)
- Create: `src/renderer/pet/toast.ts` (간단한 말풍선 오버레이)

**Interfaces:**
- Consumes: `globalShortcut`, `Store<Settings>`
- Produces:
  - `registerQuickMemo(accelerator: string, onFire: () => void): { ok: boolean, error?: string }`
  - preload: `window.pet.showToast(text: string, ms: number): void`
  - 저장 시 pet 창에 "기억했어요!" 오버레이 (1.5s) + happy

- [ ] **Step 1: shortcuts 모듈**

`src/main/shortcuts.ts`:
```ts
import { globalShortcut } from "electron";

export function registerQuickMemo(accelerator: string, onFire: () => void): { ok: boolean; error?: string } {
  try {
    const ok = globalShortcut.register(accelerator, onFire);
    return ok ? { ok: true } : { ok: false, error: "이미 사용 중" };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "실패" };
  }
}
```

- [ ] **Step 2: main — 등록 + 충돌 알림**

`bootstrap` 내:
```ts
import { registerQuickMemo } from "./shortcuts";

const settings = new Store<Settings>("settings.json", DEFAULT_SETTINGS).load();

const res = registerQuickMemo(settings.shortcutQuickMemo, () => {
  memoWin.show(); memoWin.focus();
  win.webContents.send("pet:toast", { text: "빠른 메모 열었어요!", ms: 1200 });
});
if (!res.ok) tray.displayBalloon?.({ title: "단축키 충돌", content: `${settings.shortcutQuickMemo}: ${res.error}` });

app.on("will-quit", () => { require("electron").globalShortcut.unregisterAll(); });
```

**추가**: 메모 저장 시 pet 창에 반응 보내기 — `memos:add` handler를 수정:
```ts
ipcMain.handle("memos:add", (_, payload: { text: string }) => {
  const now = new Date().toISOString();
  const m: Memo = { id: randomUUID(), text: payload.text, pinned: false, createdAt: now, updatedAt: now };
  const arr = memosStore.load(); arr.push(m); memosStore.save(arr);
  win.webContents.send("pet:toast", { text: "기억했어요!", ms: 1500 });
  controller.notify("click"); // happy 반응
  return m;
});
```

- [ ] **Step 3: preload — toast 리시버**

```ts
const pet = {
  // ...기존
  onToast: (cb: (p: { text: string; ms: number }) => void) => ipcRenderer.on("pet:toast", (_, p) => cb(p))
};
```

- [ ] **Step 4: pet renderer — toast 오버레이**

`src/renderer/pet/index.html` body 안에 추가:
```html
<div id="toast"></div>
```

`src/renderer/pet/style.css` 추가:
```css
#toast {
  position: absolute; left: 50%; top: 4px; transform: translateX(-50%);
  background: white; border: 2px solid #8b4513; border-radius: 12px;
  padding: 4px 8px; font: 12px sans-serif; white-space: nowrap;
  opacity: 0; transition: opacity 0.2s; pointer-events: none;
}
#toast.show { opacity: 1; }
```

`src/renderer/pet/main.ts` 아래에 추가:
```ts
const toast = document.getElementById("toast")!;
let toastTimer: number | null = null;
window.pet.onToast(({ text, ms }) => {
  toast.textContent = text;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), ms);
});
```

- [ ] **Step 5: 실행 확인**

```powershell
npm run dev
```

Expected:
- `Ctrl+Alt+M` → 메모 창 오픈, 푸들에 "빠른 메모 열었어요!" 토스트
- 메모 저장 → "기억했어요!" 토스트 + happy
- 이미 사용 중인 단축키면 트레이 풍선 알림

- [ ] **Step 6: 커밋**

```bash
git add src/main/shortcuts.ts src/main/index.ts src/preload/ src/renderer/pet/
git commit -m "feat(shortcut): 전역 Ctrl+Alt+M 빠른 메모 + 반응 토스트"
```

---

## Task 11: 런처 창 + 드래그앤드롭 등록 + 아이콘 추출

**Files:**
- Create: `src/main/launcher.ts`, `src/main/launcher-window.ts`
- Modify: `src/main/index.ts` (launchersStore, IPC, bubble "🚀" → 런처 창, pet 창에 파일 드롭 처리)
- Modify: `src/renderer/pet/main.ts` (dragover/drop 이벤트)
- Modify: `src/preload/index.ts` (launchers API + drop 브릿지)
- Modify: `src/renderer/launcher/*`

**Interfaces:**
- Consumes: `Store<Launcher[]>` (Task 2), `Launcher` (Task 2), `shell` / `app.getFileIcon` (Electron)
- Produces:
  - preload: `window.launchers.list()`, `add({name,type,target})`, `remove(id)`, `reorder(ids: string[])`, `open(id)`, `iconFor(id): Promise<string | null>` (dataURL)
  - preload: `window.pet.dropFiles(paths: string[]): Promise<void>` — pet 창에 파일이 드롭되면 launcher로 자동 등록
  - launcher 창: 목록 + `+ 추가` (파일 선택 또는 URL 입력), 드래그로 순서 변경, 클릭 시 실행

- [ ] **Step 1: launcher main-side 유틸**

`src/main/launcher.ts`:
```ts
import { app, shell, nativeImage } from "electron";
import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { Launcher } from "../shared/types";

export async function iconDataUrl(l: Launcher): Promise<string | null> {
  if (l.type === "url") return null;
  if (!existsSync(l.target)) return null;
  const icon = await app.getFileIcon(l.target, { size: "small" });
  return icon.toDataURL();
}

export function classify(target: string): Launcher["type"] {
  if (/^https?:\/\//i.test(target)) return "url";
  if (!existsSync(target)) return "file"; // 존재는 못 하지만 사용자 의도는 파일
  return statSync(target).isDirectory() ? "folder" : "file";
}

export function inferName(target: string, type: Launcher["type"]): string {
  if (type === "url") return target.replace(/^https?:\/\//i, "").split("/")[0];
  return basename(target);
}

export async function open(l: Launcher): Promise<{ ok: boolean; error?: string }> {
  if (l.type === "url") { await shell.openExternal(l.target); return { ok: true }; }
  if (!existsSync(l.target)) return { ok: false, error: "not found" };
  const err = await shell.openPath(l.target);
  return err ? { ok: false, error: err } : { ok: true };
}
```

- [ ] **Step 2: launcher-window**

`src/main/launcher-window.ts`:
```ts
import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createLauncherWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320, height: 420,
    frame: true, resizable: true, show: false, title: "바로가기 - Poodle Pet",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.setMenu(null);
  win.on("close", (e) => { e.preventDefault(); win.hide(); });
  return win;
}
```

- [ ] **Step 3: main IPC + 드롭 처리**

`bootstrap` 내:
```ts
import { createLauncherWindow } from "./launcher-window";
import { classify, inferName, open as openLauncher, iconDataUrl } from "./launcher";
import type { Launcher } from "../shared/types";
import { dialog } from "electron";

const launchersStore = new Store<Launcher[]>("launchers.json", []);
const launcherWin = createLauncherWindow();
if (process.env.ELECTRON_RENDERER_URL) launcherWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}/launcher/index.html`);
else launcherWin.loadFile(join(__dirname, "../renderer/launcher/index.html"));

function sortLaunchers(a: Launcher[]) { return [...a].sort((x, y) => x.order - y.order); }

ipcMain.handle("launchers:list", () => sortLaunchers(launchersStore.load()));

ipcMain.handle("launchers:add", (_, payload: { name?: string; type?: Launcher["type"]; target: string }) => {
  const type = payload.type ?? classify(payload.target);
  const name = payload.name ?? inferName(payload.target, type);
  const arr = launchersStore.load();
  const order = arr.length ? Math.max(...arr.map(x => x.order)) + 1 : 0;
  const l: Launcher = { id: randomUUID(), name, type, target: payload.target, order };
  arr.push(l); launchersStore.save(arr);
  return l;
});

ipcMain.handle("launchers:remove", (_, id: string) => {
  launchersStore.save(launchersStore.load().filter(x => x.id !== id));
});

ipcMain.handle("launchers:reorder", (_, ids: string[]) => {
  const map = new Map(launchersStore.load().map(x => [x.id, x]));
  const arr = ids.map((id, i) => ({ ...(map.get(id)!), order: i }));
  launchersStore.save(arr);
});

ipcMain.handle("launchers:open", async (_, id: string) => {
  const l = launchersStore.load().find(x => x.id === id);
  if (!l) return { ok: false, error: "not found" };
  const r = await openLauncher(l);
  if (!r.ok) {
    win.webContents.send("pet:toast", { text: "앗, 못 찾겠어요 🥺", ms: 2000 });
  }
  return r;
});

ipcMain.handle("launchers:iconFor", async (_, id: string) => {
  const l = launchersStore.load().find(x => x.id === id);
  if (!l) return null;
  return iconDataUrl(l);
});

ipcMain.handle("launchers:pickFile", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openFile"] });
  return r.canceled ? null : r.filePaths[0];
});

// pet 창에 파일 드롭
ipcMain.handle("pet:dropFiles", (_, paths: string[]) => {
  const now = launchersStore.load();
  let order = now.length ? Math.max(...now.map(x => x.order)) + 1 : 0;
  const added: Launcher[] = [];
  for (const p of paths) {
    const type = classify(p);
    added.push({ id: randomUUID(), name: inferName(p, type), type, target: p, order: order++ });
  }
  launchersStore.save([...now, ...added]);
  win.webContents.send("pet:toast", { text: `바로가기 ${added.length}개 추가!`, ms: 1500 });
  return added.length;
});

// bubble:choose → launcher
ipcMain.on("bubble:choose", (_, a: "memo" | "launcher" | "sleep") => {
  bubble.hide();
  if (a === "memo") { memoWin.show(); memoWin.focus(); }
  if (a === "launcher") { launcherWin.show(); launcherWin.focus(); }
  if (a === "sleep") controller.forceState("sleep");
});
```

- [ ] **Step 4: preload — launchers API + 드롭 브릿지**

```ts
import type { Launcher } from "../shared/types";
const launchers = {
  list: () => ipcRenderer.invoke("launchers:list") as Promise<Launcher[]>,
  add: (payload: { name?: string; type?: Launcher["type"]; target: string }) =>
    ipcRenderer.invoke("launchers:add", payload) as Promise<Launcher>,
  remove: (id: string) => ipcRenderer.invoke("launchers:remove", id) as Promise<void>,
  reorder: (ids: string[]) => ipcRenderer.invoke("launchers:reorder", ids) as Promise<void>,
  open: (id: string) => ipcRenderer.invoke("launchers:open", id) as Promise<{ ok: boolean; error?: string }>,
  iconFor: (id: string) => ipcRenderer.invoke("launchers:iconFor", id) as Promise<string | null>,
  pickFile: () => ipcRenderer.invoke("launchers:pickFile") as Promise<string | null>
};

// pet에 dropFiles 추가:
const pet = { /* ...기존, 아래 추가 */
  dropFiles: (paths: string[]) => ipcRenderer.invoke("pet:dropFiles", paths) as Promise<number>
};

contextBridge.exposeInMainWorld("launchers", launchers);
export type LaunchersApi = typeof launchers;
```

`api.d.ts`에 `Window { launchers: LaunchersApi }` 추가.

- [ ] **Step 5: pet renderer — dragover/drop 처리**

`src/renderer/pet/main.ts` 아래에 추가:
```ts
document.body.addEventListener("dragover", (e) => { e.preventDefault(); });
document.body.addEventListener("drop", (e) => {
  e.preventDefault();
  const paths: string[] = [];
  for (const f of Array.from(e.dataTransfer?.files ?? [])) {
    // Electron이 File 객체에 path 확장 제공
    const p = (f as any).path as string | undefined;
    if (p) paths.push(p);
  }
  if (paths.length) window.pet.dropFiles(paths);
});
```

- [ ] **Step 6: launcher renderer**

`src/renderer/launcher/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8"><link rel="stylesheet" href="./style.css"></head>
  <body>
    <div id="wrap">
      <div class="row">
        <button id="add-file">📁 파일 추가</button>
        <button id="add-url">🌐 URL 추가</button>
      </div>
      <ul id="list"></ul>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/launcher/style.css`:
```css
html, body { margin: 0; padding: 0; font-family: sans-serif; height: 100%; }
#wrap { display: flex; flex-direction: column; height: 100vh; padding: 8px; box-sizing: border-box; gap: 6px; }
.row { display: flex; gap: 6px; }
button { cursor: pointer; padding: 4px 8px; }
#list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
#list li { display: flex; align-items: center; gap: 8px; padding: 6px; border-bottom: 1px solid #eee; cursor: grab; }
#list li.dragging { opacity: 0.4; }
#list img.icon { width: 16px; height: 16px; }
#list .name { flex: 1; }
#list .warn { color: #c00; }
```

`src/renderer/launcher/main.ts`:
```ts
const list = document.getElementById("list") as HTMLUListElement;

async function refresh() {
  const items = await window.launchers.list();
  list.innerHTML = "";
  for (const l of items) {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.id = l.id;
    const icon = l.type === "url" ? null : await window.launchers.iconFor(l.id);
    li.innerHTML = `
      ${icon ? `<img class="icon" src="${icon}"/>` : `<span>${l.type === "url" ? "🌐" : "📄"}</span>`}
      <span class="name"></span>
      <button data-a="open">▶</button>
      <button data-a="del">🗑</button>`;
    (li.querySelector(".name") as HTMLElement).textContent = l.name;
    li.querySelector('[data-a="open"]')!.addEventListener("click", async () => {
      const r = await window.launchers.open(l.id);
      if (!r.ok) (li.querySelector(".name") as HTMLElement).classList.add("warn");
    });
    li.querySelector('[data-a="del"]')!.addEventListener("click", async () => {
      if (confirm("삭제할까요?")) { await window.launchers.remove(l.id); refresh(); }
    });
    // drag reorder
    li.addEventListener("dragstart", () => li.classList.add("dragging"));
    li.addEventListener("dragend", async () => {
      li.classList.remove("dragging");
      const ids = Array.from(list.children).map(x => (x as HTMLElement).dataset.id!);
      await window.launchers.reorder(ids);
    });
    list.appendChild(li);
  }
}
list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = list.querySelector(".dragging");
  const after = getDragAfter(list, (e as DragEvent).clientY);
  if (!dragging) return;
  if (after == null) list.appendChild(dragging);
  else list.insertBefore(dragging, after);
});

function getDragAfter(container: HTMLUListElement, y: number): Element | null {
  const els = [...container.querySelectorAll("li:not(.dragging)")] as HTMLElement[];
  return els.reduce<{ el: Element | null; offset: number }>((acc, el) => {
    const r = el.getBoundingClientRect();
    const offset = y - r.top - r.height / 2;
    return offset < 0 && offset > acc.offset ? { el, offset } : acc;
  }, { el: null, offset: -Infinity }).el;
}

document.getElementById("add-file")!.addEventListener("click", async () => {
  const p = await window.launchers.pickFile();
  if (p) { await window.launchers.add({ target: p }); refresh(); }
});
document.getElementById("add-url")!.addEventListener("click", async () => {
  const u = prompt("URL", "https://");
  if (u) { await window.launchers.add({ target: u, type: "url" }); refresh(); }
});

refresh();
```

- [ ] **Step 7: 실행 확인**

```powershell
npm run dev
```

Expected:
- 푸들에 파일/폴더 드래그앤드롭 → "바로가기 N개 추가!" 토스트, launcher 목록에 등장
- 런처 창 `📁 파일 추가` / `🌐 URL 추가` 동작
- ▶ 클릭 시 실행 (파일 → 기본 앱, URL → 기본 브라우저)
- 존재하지 않는 대상 실행 시 pet에 "앗, 못 찾겠어요 🥺" 토스트 + 항목에 빨간색
- 드래그로 순서 변경, 재시작 후 유지

- [ ] **Step 8: 커밋**

```bash
git add src/main/launcher.ts src/main/launcher-window.ts src/main/index.ts src/preload/ src/renderer/pet/ src/renderer/launcher/
git commit -m "feat(launcher): 파일·폴더·URL 등록·실행·드롭·아이콘"
```

---

## Task 12: 오류 처리 마무리 (화면 밖 복귀·단축키 재등록)

**Files:**
- Modify: `src/main/index.ts` (부팅 시 위치 복구, 설정에서 단축키 변경 훅)
- Modify: `src/main/store.ts` (필요 시 — 이미 Task 2에서 대부분 커버)
- Test: `tests/unit/screen-utils.test.ts` (복귀 로직)

**Interfaces:**
- Consumes: 이전 태스크 산출물 전부
- Produces:
  - `recoverPosition(pos, size, displays): Point` — 어떤 display에도 걸치지 않으면 주 모니터 바닥으로
  - 부팅 시 마지막 위치를 `settings.json`에 저장/복원 (선택적) — v1은 **매번 주 모니터 바닥에서 시작**하고, 런타임 중 화면 구성 바뀌면 복구만 함

- [ ] **Step 1: 복구 함수 실패 테스트**

`tests/unit/screen-utils.test.ts`에 추가:
```ts
import { recoverPosition } from "../../src/main/screen-utils";

describe("recoverPosition", () => {
  const displays = [
    { x: 0, y: 0, width: 1920, height: 1040 },
    { x: 1920, y: 0, width: 1920, height: 1040 }
  ];

  it("keeps position if inside any display", () => {
    expect(recoverPosition({ x: 100, y: 100 }, { w: 128, h: 128 }, displays))
      .toEqual({ x: 100, y: 100 });
  });

  it("returns primary bottom when outside all displays", () => {
    const r = recoverPosition({ x: 9999, y: 9999 }, { w: 128, h: 128 }, displays);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBe(1040 - 128);
  });
});
```

- [ ] **Step 2: 실행 (RED)**

```powershell
npm test -- screen-utils
```
Expected: FAIL

- [ ] **Step 3: recoverPosition 구현**

`src/main/screen-utils.ts` 하단에 추가:
```ts
export function recoverPosition(pos: Point, size: { w: number; h: number }, displays: Rect[]): Point {
  const insideAny = displays.some(d =>
    pos.x + size.w > d.x && pos.x < d.x + d.width &&
    pos.y + size.h > d.y && pos.y < d.y + d.height);
  if (insideAny) return pos;
  const primary = displays[0];
  return { x: primary.x + Math.floor(primary.width / 2 - size.w / 2), y: groundY(primary, size.h) };
}
```

- [ ] **Step 4: GREEN**

```powershell
npm test -- screen-utils
```
Expected: PASS

- [ ] **Step 5: 런타임 훅 — display 변경 시 복구**

`src/main/index.ts` bootstrap 내:
```ts
import { recoverPosition } from "./screen-utils";

screen.on("display-metrics-changed", () => attemptRecover());
screen.on("display-removed", () => attemptRecover());
function attemptRecover() {
  const b = win.getBounds();
  const displays = screen.getAllDisplays().map(d => d.workArea);
  const r = recoverPosition({ x: b.x, y: b.y }, { w: petSize, h: petSize }, displays);
  win.setBounds({ x: r.x, y: r.y, width: petSize, height: petSize });
}
```

- [ ] **Step 6: 커밋**

```bash
git add src/main/screen-utils.ts src/main/index.ts tests/unit/screen-utils.test.ts
git commit -m "feat(recover): 화면 구성 변경 시 푸들 위치 복구"
```

---

## Task 13: Playwright Electron 스모크 테스트

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: 빌드된 `out/main/index.js`
- Produces: `npm run test:e2e` → 3개 스모크 시나리오 통과

- [ ] **Step 1: playwright 설정**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1
});
```

- [ ] **Step 2: 스모크 테스트**

`tests/e2e/smoke.spec.ts`:
```ts
import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let userData: string;

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), "poodle-e2e-"));
});
test.afterEach(() => rmSync(userData, { recursive: true, force: true }));

async function launch() {
  return await electron.launch({
    args: [".", `--user-data-dir=${userData}`],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" }
  });
}

test("pet window opens", async () => {
  const app = await launch();
  const wnd = await app.firstWindow();
  await expect(wnd.locator("#pet")).toBeVisible();
  await app.close();
});

test("memo persists across restart", async () => {
  let app = await launch();
  // memo 창을 IPC로 직접 오픈 (bubble 클릭 대신)
  await app.evaluate(async ({ ipcMain }) => {
    // hack: main-process에서 ipcMain을 통해 memo add
  });
  // 더 안전한 방법: preload API를 이용해 renderer에서 호출
  const wnd = await app.firstWindow();
  await wnd.evaluate(async () => { await (window as any).memos.add("hello e2e"); });
  await app.close();

  app = await launch();
  const wnd2 = await app.firstWindow();
  const items = await wnd2.evaluate(async () => (window as any).memos.list());
  expect(items.some((m: any) => m.text === "hello e2e")).toBe(true);
  await app.close();
});

test("launcher URL opens (mocked)", async () => {
  // shell.openExternal 호출을 감지하기 어려우므로 add + list만 검증
  const app = await launch();
  const wnd = await app.firstWindow();
  await wnd.evaluate(async () => {
    await (window as any).launchers.add({ target: "https://example.com", type: "url" });
  });
  const items = await wnd.evaluate(async () => (window as any).launchers.list());
  expect(items.length).toBe(1);
  expect(items[0].type).toBe("url");
  await app.close();
});
```

- [ ] **Step 3: 빌드 후 실행**

```powershell
npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: 3/3 PASS.

- [ ] **Step 4: 커밋**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "test: Playwright Electron 스모크 (창·메모 영속·런처 등록)"
```

---

## Task 14: electron-builder 인스톨러 + README

**Files:**
- Create: `electron-builder.yml`
- Create: `README.md`

**Interfaces:**
- Produces: `npm run pack` → `dist/Poodle Pet Setup 0.1.0.exe` (NSIS)

- [ ] **Step 1: electron-builder 설정**

`electron-builder.yml`:
```yaml
appId: com.sylph.poodle-pet
productName: Poodle Pet
directories:
  output: dist
files:
  - "out/**/*"
  - "characters/**/*"
  - "package.json"
win:
  target:
    - nsis
  icon: characters/poodle/sprite.png
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  shortcutName: Poodle Pet
```

- [ ] **Step 2: README (SmartScreen 경고 안내 포함)**

`README.md`:
```markdown
# Poodle Pet 🐩

Windows 바탕화면을 돌아다니는 픽셀아트 푸들 데스크톱 펫.
메모와 바로가기 기능이 함께 딸려 있습니다.

## 실행

```powershell
npm install
npm run gen:sprite     # 임시 스프라이트 생성 (첫 실행 시)
npm run dev
```

## 설치파일 만들기

```powershell
npm run pack
# dist/Poodle Pet Setup 0.1.0.exe
```

**SmartScreen 경고**: 코드 서명이 되어있지 않아 처음 실행 시 "Windows에서 PC를 보호했습니다" 경고가 나옵니다. **추가 정보 → 실행**을 눌러 진행하세요.

## 개발

- `npm test` — 단위 테스트 (Vitest)
- `npm run test:e2e` — 스모크 테스트 (Playwright Electron)

## 스프라이트 교체

`characters/poodle/sprite.png`와 `manifest.json`을 교체하면 됩니다. 프레임은 32×32, 행 순서는 idle/walk/sit/sleep/drag/happy.

## 데이터 위치

`%APPDATA%\poodle-pet\`
- memos.json / launchers.json / settings.json
- backup/YYYY-MM-DD/ (최근 7일)
```

- [ ] **Step 3: 패키징 확인**

```powershell
npm run pack
```

Expected: `dist/Poodle Pet Setup 0.1.0.exe` 생성. 실행 시 NSIS 설치 마법사 표시.

- [ ] **Step 4: 커밋**

```bash
git add electron-builder.yml README.md
git commit -m "chore: NSIS 패키징 설정 + README (SmartScreen 안내)"
```

---

## 검토 체크리스트 (spec ↔ plan 매핑)

| Spec 요구사항 | 담당 Task |
|---|---|
| Electron+TS+electron-vite 부트 | 1 |
| 데이터 저장 위치 `%APPDATA%/poodle-pet/` | 2 |
| atomic write + 일 1회 백업(7일) + 깨진 파일 복구 | 2 |
| 캐릭터 교체 구조 (sprite.png + manifest.json) | 3 |
| 32×32 프레임 · 4배 확대 (3~5 설정) | 3, 4 |
| 투명 창 (frame=false, transparent, alwaysOnTop, skipTaskbar) | 4 |
| contextIsolation + preload IPC | 4 |
| 상태 머신 idle/walk/sit/sleep/drag/fall/happy | 5 |
| idle 3~8s 후 walk50/idle30/sit20, 30s→sleep, click→깨움 | 5 |
| walk 40px/s, 화면 끝 방향전환, 오른쪽만 그리고 좌우 반전 | 6 |
| 클릭→happy+말풍선(📝🚀💤), 드래그→drag→fall | 7 |
| 멀티 모니터 (드래그로 이동, 기본은 현 모니터 안) | 6, 7 |
| 전체화면 자동 숨김 | 8 |
| 트레이 메뉴 (숨기기/보이기, 설정, 종료) | 8 |
| 단일 인스턴스 | 8 |
| 메모: 작성/목록/검색/수정/삭제/복사/📌 | 9 |
| 전역 단축키 Ctrl+Alt+M + "기억했어요!" | 10 |
| 단축키 충돌 시 트레이 알림 | 10 |
| 바로가기: 파일/폴더/URL, 드롭 등록, 아이콘, 순서 변경 | 11 |
| 바로가기 실행 실패 시 "앗, 못 찾겠어요 🥺" | 11 |
| 화면 밖 푸들 복귀 | 12 |
| Vitest 단위 테스트 (상태·경계·저장) | 2, 5, 6, 12 |
| Playwright Electron 스모크 | 13 |
| 폴더 구조 (spec §6) | 전체 |
| NSIS 인스톨러 + SmartScreen 안내 | 14 |

전 요구사항 커버 확인.

---

## Plan 완료

Plan complete and saved to `docs/superpowers/plans/2026-09-29-poodle-pet.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Task마다 fresh subagent 파견, 사이사이 리뷰, 빠른 반복
**2. Inline Execution** — 이 세션에서 이어서 실행, 체크포인트마다 검토

어느 방식으로 갈까요?
