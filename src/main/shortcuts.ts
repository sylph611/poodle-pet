import { globalShortcut } from "electron";

export function registerQuickMemo(accelerator: string, onFire: () => void): { ok: boolean; error?: string } {
  try {
    const ok = globalShortcut.register(accelerator, onFire);
    return ok ? { ok: true } : { ok: false, error: "이미 사용 중" };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "실패" };
  }
}
