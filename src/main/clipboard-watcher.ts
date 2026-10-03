import { isSensitive } from "./sensitive-detector";

export type ClipboardStoreMinimal = {
  moveToFront: (text: string) => boolean;
  addEntry: (text: string) => void;
};

const MAX_TEXT_LENGTH = 10_000;
const DEFAULT_INTERVAL_MS = 500;

export class ClipboardWatcher {
  private lastText = "";
  private paused = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;

  constructor(
    private store: ClipboardStoreMinimal,
    private opts: { readText: () => string; intervalMs?: number }
  ) {
    this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  setPaused(p: boolean): void { this.paused = p; }
  isPaused(): boolean { return this.paused; }

  tick(): void {
    if (this.paused) return;
    const text = this.opts.readText();
    if (!text) return;
    if (text === this.lastText) return;
    this.lastText = text;
    if (text.length > MAX_TEXT_LENGTH) return;
    if (isSensitive(text)) return;
    const existed = this.store.moveToFront(text);
    if (!existed) this.store.addEntry(text);
  }
}
