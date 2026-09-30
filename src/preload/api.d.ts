import type { PetApi, MemosApi, LaunchersApi, SettingsApi } from "./index";
declare global {
  interface Window { pet: PetApi; memos: MemosApi; launchers: LaunchersApi; settings: SettingsApi }
}
export {};
