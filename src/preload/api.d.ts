import type { PetApi, MemosApi } from "./index";
declare global {
  interface Window { pet: PetApi; memos: MemosApi }
}
export {};
