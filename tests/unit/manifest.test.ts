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
