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
  speedPxPerSec: number;
  minX: number;
  maxX: number;

  constructor(opts: WalkOpts) {
    this.x = opts.x;
    this.direction = opts.direction;
    this.speedPxPerSec = opts.speedPxPerSec;
    this.minX = opts.minX;
    this.maxX = opts.maxX;
  }

  tick(dtMs: number) {
    this.x += this.direction * this.speedPxPerSec * (dtMs / 1000);
    if (this.x >= this.maxX) { this.x = this.maxX; this.direction = -1; }
    if (this.x <= this.minX) { this.x = this.minX; this.direction = 1; }
  }
}

export function recoverPosition(pos: Point, size: { w: number; h: number }, displays: Rect[]): Point {
  const insideAny = displays.some(d =>
    pos.x + size.w > d.x && pos.x < d.x + d.width &&
    pos.y + size.h > d.y && pos.y < d.y + d.height);
  if (insideAny) return pos;
  const primary = displays[0];
  return { x: primary.x + Math.floor(primary.width / 2 - size.w / 2), y: groundY(primary, size.h) };
}

// Electron screen helper — not covered by unit tests
export function displayContainingElectron(screen: import("electron").Screen, pos: Point): Rect {
  const d = screen.getDisplayNearestPoint(pos);
  return { x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height };
}

// Full display bounds (workArea가 아닌 물리 화면 전체) — 드래그 중에는 태스크바 영역까지 이동 허용
export function displayBoundsContainingElectron(screen: import("electron").Screen, pos: Point): Rect {
  const d = screen.getDisplayNearestPoint(pos);
  return { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height };
}
