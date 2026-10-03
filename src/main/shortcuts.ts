import { globalShortcut } from "electron";

/** 단축키 등록. accelerator가 이미 쓰이면 false 반환. */
export function registerPalette(accelerator: string, onInvoke: () => void): boolean {
  try {
    const ok = globalShortcut.register(accelerator, onInvoke);
    return ok;
  } catch {
    return false;
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll();
}
