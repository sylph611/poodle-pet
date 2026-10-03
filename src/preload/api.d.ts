import type { PetApi, MemosApi, LaunchersApi, SettingsApi, InfoApi, PaletteApi, ClipboardApi } from "./index";
declare global {
  interface Window {
    pet: PetApi;
    memos: MemosApi;
    launchers: LaunchersApi;
    settings: SettingsApi;
    info: InfoApi;
    palette: PaletteApi;
    clipboard: ClipboardApi;
  }
}
export {};
