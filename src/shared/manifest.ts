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
