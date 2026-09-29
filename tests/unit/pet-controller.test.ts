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
