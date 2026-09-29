export type Memo = {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Launcher = {
  id: string;
  name: string;
  type: "file" | "folder" | "url";
  target: string;
  order: number;
};

export type Settings = {
  spriteScale: number;       // 3~5
  walkSpeedPxPerSec: number; // 기본 40
  shortcutQuickMemo: string; // 기본 "CommandOrControl+Alt+M"
  hideOnFullscreen: boolean; // 기본 true
};

export const DEFAULT_SETTINGS: Settings = {
  spriteScale: 4,
  walkSpeedPxPerSec: 40,
  shortcutQuickMemo: "CommandOrControl+Alt+M",
  hideOnFullscreen: true
};

export type PetState = "idle" | "walk" | "sit" | "sleep" | "drag" | "fall" | "happy";
