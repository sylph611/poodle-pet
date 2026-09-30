import { contextBridge, ipcRenderer } from "electron";
import type { Memo, Launcher, Settings } from "../shared/types";

const pet = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{
    manifest: { frameSize: number; animations: Record<string, { row: number; frames: number; fps: number }> };
    imageDataUrl: string;
    scale: number;
  }>,
  onState: (cb: (s: string) => void) => ipcRenderer.on("pet:state", (_, s) => cb(s)),
  onFacing: (cb: (d: number) => void) => ipcRenderer.on("pet:facing", (_, d) => cb(d)),
  onToast: (cb: (p: { text: string; ms: number }) => void) => ipcRenderer.on("pet:toast", (_, p) => cb(p)),
  onRescale: (cb: (p: { scale: number; size: number }) => void) => ipcRenderer.on("pet:rescale", (_, p) => cb(p)),
  action: (kind: "click" | "dragStart" | "dragEnd") => ipcRenderer.send("pet:action", kind),
  dragMove: (delta: { dx: number; dy: number }) => ipcRenderer.send("pet:dragMove", delta),
  openBubble: (anchor: { x: number; y: number }) => ipcRenderer.send("bubble:open", anchor),
  chooseAction: (a: "memo" | "launcher" | "sleep") => ipcRenderer.send("bubble:choose", a),
  dropFiles: (paths: string[]) => ipcRenderer.invoke("pet:dropFiles", paths) as Promise<number>
};

const memos = {
  list: () => ipcRenderer.invoke("memos:list") as Promise<Memo[]>,
  add: (text: string) => ipcRenderer.invoke("memos:add", { text }) as Promise<Memo>,
  update: (id: string, patch: { text?: string; pinned?: boolean }) => ipcRenderer.invoke("memos:update", id, patch) as Promise<Memo>,
  remove: (id: string) => ipcRenderer.invoke("memos:remove", id) as Promise<void>,
  search: (q: string) => ipcRenderer.invoke("memos:search", q) as Promise<Memo[]>
};

const launchers = {
  list: () => ipcRenderer.invoke("launchers:list") as Promise<Launcher[]>,
  add: (payload: { name?: string; type?: Launcher["type"]; target: string }) =>
    ipcRenderer.invoke("launchers:add", payload) as Promise<Launcher>,
  remove: (id: string) => ipcRenderer.invoke("launchers:remove", id) as Promise<void>,
  reorder: (ids: string[]) => ipcRenderer.invoke("launchers:reorder", ids) as Promise<void>,
  open: (id: string) => ipcRenderer.invoke("launchers:open", id) as Promise<{ ok: boolean; error?: string }>,
  iconFor: (id: string) => ipcRenderer.invoke("launchers:iconFor", id) as Promise<string | null>,
  pickFile: () => ipcRenderer.invoke("launchers:pickFile") as Promise<string | null>
};

const settings = {
  get: () => ipcRenderer.invoke("settings:get") as Promise<Settings>,
  update: (patch: Partial<Settings>) =>
    ipcRenderer.invoke("settings:update", patch) as Promise<{ shortcutOk?: boolean }>,
  exportMemos: () => ipcRenderer.invoke("settings:exportMemos") as Promise<{ ok: boolean; path?: string; error?: string }>,
  importMemos: () => ipcRenderer.invoke("settings:importMemos") as Promise<{ ok: boolean; count?: number; error?: string }>,
  exportLaunchers: () => ipcRenderer.invoke("settings:exportLaunchers") as Promise<{ ok: boolean; path?: string; error?: string }>,
  importLaunchers: () => ipcRenderer.invoke("settings:importLaunchers") as Promise<{ ok: boolean; count?: number; error?: string }>,
  openDataFolder: () => ipcRenderer.send("settings:openDataFolder"),
  showHelp: () => ipcRenderer.send("settings:showHelp"),
  showAbout: () => ipcRenderer.send("settings:showAbout")
};

contextBridge.exposeInMainWorld("pet", pet);
contextBridge.exposeInMainWorld("memos", memos);
contextBridge.exposeInMainWorld("launchers", launchers);
contextBridge.exposeInMainWorld("settings", settings);
export type PetApi = typeof pet;
export type MemosApi = typeof memos;
export type LaunchersApi = typeof launchers;
export type SettingsApi = typeof settings;
