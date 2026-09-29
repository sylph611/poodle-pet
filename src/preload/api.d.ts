import type { PetApi, MemosApi, LaunchersApi } from "./index";
declare global {
  interface Window { pet: PetApi; memos: MemosApi; launchers: LaunchersApi }
}
export {};
