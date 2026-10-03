import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setUserDataRootForTest } from "../../src/main/paths";
import { Store, runDailyBackup, ClipboardHistoryStore } from "../../src/main/store";

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
    expect(brokenFiles[0]).toMatch(/^broken\.broken-\d{8}-\d{6}\.json$/);
  });

  it("keeps only 7 most recent backup dirs", () => {
    const s = new Store<{ n: number }>("memos.json", { n: 0 });
    s.save({ n: 1 });
    const root = join(tmp, "backup");
    require("fs").mkdirSync(root, { recursive: true });
    // 10일치 더미 백업 폴더 (오늘보다 과거)
    for (let i = 1; i <= 10; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      require("fs").mkdirSync(join(root, d.toISOString().slice(0, 10)));
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
});

describe("ClipboardHistoryStore", () => {
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bokki-clip-"));
    setUserDataRootForTest(tmp);
  });

  afterEach(() => {
    setUserDataRootForTest(null);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("빈 상태에서 list()는 []", () => {
    const s = new ClipboardHistoryStore(() => 50);
    expect(s.list()).toEqual([]);
  });

  it("addEntry → list 맨 앞", () => {
    const s = new ClipboardHistoryStore(() => 50);
    s.addEntry("a");
    s.addEntry("b");
    const list = s.list();
    expect(list[0].text).toBe("b");
    expect(list[1].text).toBe("a");
  });

  it("max 초과 → 오래된 것 drop", () => {
    const s = new ClipboardHistoryStore(() => 3);
    s.addEntry("a");
    s.addEntry("b");
    s.addEntry("c");
    s.addEntry("d");
    const list = s.list();
    expect(list.length).toBe(3);
    expect(list.map(e => e.text)).toEqual(["d", "c", "b"]);
  });

  it("moveToFront: 존재하면 true + 맨 앞 이동", () => {
    const s = new ClipboardHistoryStore(() => 50);
    s.addEntry("a");
    s.addEntry("b");
    const r = s.moveToFront("a");
    expect(r).toBe(true);
    expect(s.list()[0].text).toBe("a");
  });

  it("moveToFront: 없으면 false + 변화 없음", () => {
    const s = new ClipboardHistoryStore(() => 50);
    s.addEntry("a");
    const r = s.moveToFront("missing");
    expect(r).toBe(false);
    expect(s.list().length).toBe(1);
  });

  it("deleteEntry 제거", () => {
    const s = new ClipboardHistoryStore(() => 50);
    const e = s.addEntry("a");
    s.deleteEntry(e.id);
    expect(s.list()).toEqual([]);
  });

  it("clear 전체 삭제", () => {
    const s = new ClipboardHistoryStore(() => 50);
    s.addEntry("a");
    s.addEntry("b");
    s.clear();
    expect(s.list()).toEqual([]);
  });
});
