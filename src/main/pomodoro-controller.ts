export type Phase = "idle" | "focus" | "break";

type Opts = {
  focusMs: number;
  breakMs: number;
  now?: () => number;
};

export class PomodoroController {
  private _phase: Phase = "idle";
  private phaseStartMs = 0;
  private lastNowMs = 0;
  private focusMs: number;
  private breakMs: number;
  private nowFn: () => number;
  private listeners: Array<(phase: Phase, remainingMs: number) => void> = [];
  private currentPhaseDurationMs = 0; // snapshot of duration when phase started

  constructor(opts: Opts) {
    this.focusMs = opts.focusMs;
    this.breakMs = opts.breakMs;
    this.nowFn = opts.now ?? (() => performance.now());
    this.lastNowMs = this.nowFn();
  }

  get phase(): Phase { return this._phase; }

  get remainingMs(): number {
    if (this._phase === "idle") return 0;
    // clamp는 defensive — tick()의 자동 transition으로 현재 음수 경로 없음
    return Math.max(0, this.currentPhaseDurationMs - (this.lastNowMs - this.phaseStartMs));
  }

  start(): void {
    if (this._phase !== "idle") return;
    this.transitionTo("focus");
  }

  stop(): void {
    if (this._phase === "idle") return;
    this.transitionTo("idle");
  }

  tick(nowMs: number): void {
    this.lastNowMs = nowMs;
    if (this._phase === "idle") return;
    if (nowMs - this.phaseStartMs >= this.currentPhaseDurationMs) {
      if (this._phase === "focus") this.transitionTo("break");
      else if (this._phase === "break") this.transitionTo("idle");
    }
  }

  updateDurations(focusMs: number, breakMs: number): void {
    this.focusMs = focusMs;
    this.breakMs = breakMs;
    // current session 유지 — 다음 전환부터 자연히 새 값 사용
  }

  onPhaseChange(cb: (phase: Phase, remainingMs: number) => void): void {
    this.listeners.push(cb);
  }

  private transitionTo(phase: Phase): void {
    if (phase === this._phase) return;
    this._phase = phase;
    this.phaseStartMs = this.lastNowMs;
    const remaining =
      phase === "focus" ? this.focusMs :
      phase === "break" ? this.breakMs : 0;
    this.currentPhaseDurationMs = remaining;
    this.listeners.forEach(cb => cb(phase, remaining));
  }
}
