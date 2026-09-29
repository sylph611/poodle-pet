import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSprite: () => ipcRenderer.invoke("sprite:get") as Promise<{
    manifestPath: string; imagePath: string; scale: number;
  }>
};

contextBridge.exposeInMainWorld("pet", api);
export type PetApi = typeof api;
