import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{
    manifestPath: string; imagePath: string; scale: number;
  }>,
  onState: (cb: (s: string) => void) => ipcRenderer.on("pet:state", (_, s) => cb(s)),
  onFacing: (cb: (d: number) => void) => ipcRenderer.on("pet:facing", (_, d) => cb(d))
};

contextBridge.exposeInMainWorld("pet", api);
export type PetApi = typeof api;
