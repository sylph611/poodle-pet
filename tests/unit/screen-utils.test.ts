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
