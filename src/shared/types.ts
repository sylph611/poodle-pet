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
  pomodoroFocusMin: number;  // 15~60, 기본 25
  pomodoroBreakMin: number;  // 3~15, 기본 5
  clipboardCaptureEnabled: boolean;
  clipboardMaxEntries: number;  // 20 ~ 200
};

export const DEFAULT_SETTINGS: Settings = {
  spriteScale: 4,
  walkSpeedPxPerSec: 40,
  shortcutQuickMemo: "CommandOrControl+Alt+M",
  hideOnFullscreen: true,
  autoStart: false,
  pomodoroFocusMin: 25,
  pomodoroBreakMin: 5,
  clipboardCaptureEnabled: true,
  clipboardMaxEntries: 50
};

export type ClipboardEntry = {
  id: string;
  text: string;
  copiedAt: string;  // ISO 8601
};

export type PetState = "idle" | "walk" | "sit" | "sleep" | "drag" | "fall" | "happy";
