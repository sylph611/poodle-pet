import { describe, it, expect, vi } from "vitest";
import { ClipboardWatcher } from "../../src/main/clipboard-watcher";

function makeStore() {
  const added: string[] = [];
  const moved: string[] = [];
  const existing = new Set<string>();
  return {
    added, moved, existing,
    moveToFront(text: string) {
      if (existing.has(text)) { moved.push(text); return true; }
      return false;
    },
    addEntry(text: string) { added.push(text); existing.add(text); }
  };
}

describe("ClipboardWatcher — 기본 캡처", () => {
  it("새 텍스트 → addEntry 호출", () => {
    const store = makeStore();
    let clip = "hello";
    const w = new ClipboardWatcher(store, { readText: () => clip });
    w.tick();
    expect(store.added).toEqual(["hello"]);
  });

  it("같은 텍스트 연속 → skip", () => {
    const store = makeStore();
    let clip = "hello";
    const w = new ClipboardWatcher(store, { readText: () => clip });
    w.tick();
    w.tick();
    w.tick();
    expect(store.added).toEqual(["hello"]);
  });

  it("빈 문자열 → skip", () => {
    const store = makeStore();
    const w = new ClipboardWatcher(store, { readText: () => "" });
    w.tick();
    expect(store.added).toEqual([]);
  });
});

describe("ClipboardWatcher — 중복", () => {
  it("과거에 있던 텍스트 다시 복사 → moveToFront", () => {
    const store = makeStore();
    store.existing.add("old-item");
    let clip = "old-item";
    const w = new ClipboardWatcher(store, { readText: () => clip });
    w.tick();
    expect(store.moved).toEqual(["old-item"]);
    expect(store.added).toEqual([]);
  });
});

describe("ClipboardWatcher — pause", () => {
  it("paused 상태에선 tick이 아무것도 안 함", () => {
    const store = makeStore();
    const w = new ClipboardWatcher(store, { readText: () => "x" });
    w.setPaused(true);
    w.tick();
    expect(store.added).toEqual([]);
  });

  it("pause → resume 후 캡처 재개", () => {
    const store = makeStore();
    let clip = "x";
    const w = new ClipboardWatcher(store, { readText: () => clip });
    w.setPaused(true);
    w.tick();
    w.setPaused(false);
    w.tick();
    expect(store.added).toEqual(["x"]);
  });

  it("isPaused() 상태 반영", () => {
    const store = makeStore();
    const w = new ClipboardWatcher(store, { readText: () => "" });
    expect(w.isPaused()).toBe(false);
    w.setPaused(true);
    expect(w.isPaused()).toBe(true);
  });
});

describe("ClipboardWatcher — 민감 패턴 제외", () => {
  it("6자리 숫자(2FA) → skip + lastText 업데이트는 함", () => {
    const store = makeStore();
    let clip = "123456";
    const w = new ClipboardWatcher(store, { readText: () => clip });
    w.tick();
    expect(store.added).toEqual([]);
    // 다시 같은 민감 텍스트 와도 또 skip
    w.tick();
    expect(store.added).toEqual([]);
  });
});

describe("ClipboardWatcher — 10,000자 상한", () => {
  it("10,000자 초과 → skip", () => {
    const store = makeStore();
    const longText = "a".repeat(10001);
    const w = new ClipboardWatcher(store, { readText: () => longText });
    w.tick();
    expect(store.added).toEqual([]);
  });

  it("정확히 10,000자 → 저장", () => {
    const store = makeStore();
    const text = "a".repeat(10000);
    const w = new ClipboardWatcher(store, { readText: () => text });
    w.tick();
    expect(store.added).toEqual([text]);
  });
});

describe("ClipboardWatcher — start/stop", () => {
  it("start → setInterval 등록, stop → 해제", () => {
    vi.useFakeTimers();
    const store = makeStore();
    let clip = "a";
    const w = new ClipboardWatcher(store, { readText: () => clip, intervalMs: 100 });
    w.start();
    vi.advanceTimersByTime(300);  // 3 ticks
    expect(store.added.length).toBeGreaterThan(0);
    const countAtStop = store.added.length;
    w.stop();
    vi.advanceTimersByTime(500);
    expect(store.added.length).toBe(countAtStop);  // 더 늘지 않음
    vi.useRealTimers();
  });
});
