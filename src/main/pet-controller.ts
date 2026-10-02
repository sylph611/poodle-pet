import type { PetState } from "../shared/types";

type Opts = {
  rng?: () => number;
  now?: () => number;
};

const HAPPY_MS = 1200;
// FALL_MS는 물리 낙하가 끝나기 전에 강제 종료되지 않도록 넉넉히. 실제 착지는
// main tick 루프가 중력 물리로 판단해 forceState("idle")로 조기 전환.
const FALL_MS = 3000;
const IDLE_MIN_WAIT_MS = 3000;
const IDLE_MAX_WAIT_MS = 8000;
const IDLE_TO_SLEEP_MS = 30_000;

export class PetController {
  private _state: PetState = "idle";
  private listeners: Array<(s: PetState) => void> = [];
  private stateEnteredAt = 0;
  private idleWaitMs = 0;
  private idleAccumMs = 0; // idle에서 누적 시간 (sleep 판정용)
  private focusLock = false;
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
        if (inState >= HAPPY_MS) this.enter(this.focusLock ? "sit" : "idle");
        break;
      case "fall":
        if (inState >= FALL_MS) this.enter(this.focusLock ? "sit" : "idle");
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

  forceState(s: PetState) { this.enter(s); }

  setFocusLock(locked: boolean): void {
    this.focusLock = locked;
    if (locked) this.enter("sit");
  }

  private rollIdleBranch() {
    if (this.focusLock) { this.enter("sit"); return; }
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
