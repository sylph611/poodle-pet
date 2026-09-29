import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{ manifestPath: string; imagePath: string; scale: number }>,
  onState: (cb: (s: string) => void) => ipcRenderer.on("pet:state", (_, s) => cb(s)),
  onFacing: (cb: (d: number) => void) => ipcRenderer.on("pet:facing", (_, d) => cb(d)),
  action: (kind: "click" | "dragStart" | "dragEnd") => ipcRenderer.send("pet:action", kind),
  dragMove: (delta: { dx: number; dy: number }) => ipcRenderer.send("pet:dragMove", delta),
  openBubble: (anchor: { x: number; y: number }) => ipcRenderer.send("bubble:open", anchor),
  chooseAction: (a: "memo" | "launcher" | "sleep") => ipcRenderer.send("bubble:choose", a)
};

contextBridge.exposeInMainWorld("pet", api);
export type PetApi = typeof api;
