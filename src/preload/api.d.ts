import type { PetApi, MemosApi, LaunchersApi, SettingsApi, InfoApi } from "./index";
declare global {
  interface Window {
    pet: PetApi;
    memos: MemosApi;
    launchers: LaunchersApi;
    settings: SettingsApi;
    info: InfoApi;
  }
}
export {};
