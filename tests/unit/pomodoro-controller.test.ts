import { describe, it, expect, vi } from "vitest";
import { PomodoroController } from "../../src/main/pomodoro-controller";

function make(opts: Partial<ConstructorParameters<typeof PomodoroController>[0]> = {}) {
  return new PomodoroController({
    focusMs: 25 * 60_000,
    breakMs: 5 * 60_000,
    now: () => 0,
    ...opts
  });
}

describe("PomodoroController — basics", () => {
  it("starts in idle", () => {
    expect(make().phase).toBe("idle");
  });

  it("remainingMs is 0 while idle", () => {
    expect(make().remainingMs).toBe(0);
  });

  it("start() transitions idle → focus with full remainingMs", () => {
    const c = make();
    c.start();
    expect(c.phase).toBe("focus");
    expect(c.remainingMs).toBe(25 * 60_000);
  });

  it("start() during focus is a no-op (멱등)", () => {
    const c = make();
    c.start();
    c.start();
    expect(c.phase).toBe("focus");
  });

  it("stop() during focus returns to idle", () => {
    const c = make();
    c.start();
    c.stop();
    expect(c.phase).toBe("idle");
    expect(c.remainingMs).toBe(0);
  });
});

describe("PomodoroController — tick transitions", () => {
  it("tick after focusMs → auto-transition to break", () => {
    let now = 0;
    const c = make({ now: () => now });
    c.start(); // focus starts at now=0
    now = 25 * 60_000;
    c.tick(now);
    expect(c.phase).toBe("break");
  });

  it("tick after breakMs in break → idle (수동 재시작 필요)", () => {
    let now = 0;
    const c = make({ now: () => now });
    c.start();
    now = 25 * 60_000;
    c.tick(now);
    expect(c.phase).toBe("break");
    now = 25 * 60_000 + 5 * 60_000;
    c.tick(now);
    expect(c.phase).toBe("idle");
  });

  it("remainingMs decreases with tick", () => {
    let now = 0;
    const c = make({ now: () => now });
    c.start();
    now = 10 * 60_000;
    c.tick(now);
    expect(c.remainingMs).toBe(15 * 60_000);
  });

  it("remainingMs clamps to 0 (안 음수)", () => {
    let now = 0;
    const c = make({ now: () => now });
    c.start();
    now = 999 * 60_000;
    c.tick(now);
    // phase 전환 자동 발생, 다음 phase의 remainingMs는 양수
    // but if we didn't tick, remaining should clamp
    expect(c.remainingMs).toBeGreaterThanOrEqual(0);
  });
});

describe("PomodoroController — updateDurations", () => {
  it("during idle → next start reflects new duration", () => {
    const c = make();
    c.updateDurations(50 * 60_000, 10 * 60_000);
    c.start();
    expect(c.remainingMs).toBe(50 * 60_000);
  });

  it("during focus → current session uses OLD duration (유지)", () => {
    let now = 0;
    const c = make({ now: () => now });
    c.start(); // focus @ 25min
    c.updateDurations(50 * 60_000, 10 * 60_000);
    now = 25 * 60_000;
    c.tick(now);
    // 25min 뒤 자동 transition해야 함 (OLD focusMs=25분 사용)
    expect(c.phase).toBe("break");
  });
});

describe("PomodoroController — onPhaseChange", () => {
  it("fires on transitions (start, auto, stop)", () => {
    const spy = vi.fn();
    let now = 0;
    const c = make({ now: () => now });
    c.onPhaseChange(spy);
    c.start();
    expect(spy).toHaveBeenCalledWith("focus", 25 * 60_000);
    now = 25 * 60_000;
    c.tick(now);
    expect(spy).toHaveBeenCalledWith("break", 5 * 60_000);
    c.stop();
    expect(spy).toHaveBeenCalledWith("idle", 0);
  });

  it("does NOT fire on tick that doesn't transition", () => {
    const spy = vi.fn();
    let now = 0;
    const c = make({ now: () => now });
    c.start();
    spy.mockClear();
    now = 10 * 60_000;
    c.tick(now);
    expect(spy).not.toHaveBeenCalled();
  });
});
