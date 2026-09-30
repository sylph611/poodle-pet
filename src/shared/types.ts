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
  walkSpeedPxPerSec: number; // 20~100
  shortcutQuickMemo: string; // Electron accelerator string
  hideOnFullscreen: boolean;
  autoStart: boolean;        // Windows 로그인 시 자동 실행
};

export const DEFAULT_SETTINGS: Settings = {
  spriteScale: 4,
  walkSpeedPxPerSec: 40,
  shortcutQuickMemo: "CommandOrControl+Alt+M",
  hideOnFullscreen: true,
  autoStart: false
};

export type PetState = "idle" | "walk" | "sit" | "sleep" | "drag" | "fall" | "happy";
