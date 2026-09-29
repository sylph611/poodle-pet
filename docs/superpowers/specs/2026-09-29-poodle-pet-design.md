# Poodle Pet — 설계서 (v1)

- 작성일: 2026-09-29
- 상태: 브레인스토밍 승인 완료 → 구현 계획 대기

## 1. 프로젝트 개요

Windows 바탕화면을 돌아다니는 **갈색 픽셀아트 푸들** 데스크톱 펫. 블로그 연재용 겸 개인 도구로, 소스와 설치파일을 공개한다. 캐릭터는 AI 이미지 생성으로 만든 **오리지널**이며 기존 IP는 사용하지 않는다. 갈색 톤(초콜릿 / 카라멜·애프리콧)은 캐릭터 제작 단계에서 확정한다.

### 기술 스택

- **Electron + TypeScript + electron-vite**
- 패키징: **electron-builder** (NSIS 인스톨러)
- UI: **바닐라 HTML/CSS/TS** (React 없음)
- 테스트: **Vitest** + **Playwright Electron** (스모크)

## 2. v1 범위

**포함**
- 돌아다니기 (idle / walk / sit / sleep / drag / fall / happy)
- 메모 (텍스트만)
- 바로가기 런처 (파일·폴더·URL)

**v2로 미룸**
- 알림 / 리마인더
- Claude API 대화

**제외**
- 클립보드 기록

## 3. 설계 1/4 — 전체 구조

푸들 크기(약 128×128)의 **작은 투명 창을 움직이는 방식**. 화면 전체를 덮는 오버레이가 아니라 필요한 만큼만 창을 잡는다.

### 창 옵션

- 투명 배경, 테두리 없음, 항상 위, 작업표시줄에서 숨김
- `contextIsolation: true`, `nodeIntegration: false`, preload 스크립트로 IPC 노출

### Main 프로세스 구성

- **PetController** — 창 위치 계산, 상태 머신 구동, 경계 판정
- **Store** — JSON 파일 저장/로드 (atomic write + backup)
- **Launcher** — 파일/URL 실행, 아이콘 추출 (`app.getFileIcon`)
- **Tray** — 트레이 아이콘 + 컨텍스트 메뉴 (숨기기/보이기, 설정, 종료)

### Renderer 창 구성

- **pet** — 스프라이트 애니메이션, 클릭·드래그 이벤트
- **bubble** — 말풍선 메뉴 (📝메모 🚀바로가기 💤재우기)
- **memo** — 메모 작성/목록 창
- **launcher** — 바로가기 목록/추가 창

Renderer ↔ Main 통신은 preload에서 노출한 좁은 IPC API로만 (예: `pet.moveTo`, `store.saveMemo`).

### 캐릭터 교체 가능한 구조

```
characters/
  poodle/
    sprite.png       # 스프라이트 시트 (32×32 프레임)
    manifest.json    # 동작별 프레임 좌표, fps, 총 프레임 수
```

`manifest.json` 예시:
```json
{
  "frameSize": 32,
  "animations": {
    "idle":  { "row": 0, "frames": 4, "fps": 4 },
    "walk":  { "row": 1, "frames": 6, "fps": 8 },
    "sit":   { "row": 2, "frames": 2, "fps": 2 },
    "sleep": { "row": 3, "frames": 3, "fps": 2 },
    "drag":  { "row": 4, "frames": 2, "fps": 6 },
    "happy": { "row": 5, "frames": 4, "fps": 8 }
  }
}
```

### 데이터 저장 위치

`%APPDATA%/poodle-pet/`
- `memos.json`
- `launchers.json`
- `settings.json`
- `backup/` (일 1회, 최근 7개)

## 4. 설계 2/4 — 행동

### 상태 머신

`idle · walk · sit · sleep · drag · fall · happy`

### idle 전환 규칙

- idle 진입 후 3~8초 랜덤 대기
- 다음 전환 확률: **walk 50% / idle 유지 30% / sit 20%**
- **30초 이상 방치 → sit → sleep**, 클릭하면 깨어남

### 클릭 / 드래그

- 클릭 → **happy** (꼬리 흔들기 애니메이션) + 말풍선 메뉴 표시
- 드래그 중 → **drag** (버둥버둥)
- 드래그 놓음 → **fall** → 바닥 착지 후 idle

### 걷기

- 작업표시줄 위 **바닥선**을 따라 이동
- 속도 약 **40 px/s** (설정 가능)
- 화면 끝 도달 시 방향 전환
- 스프라이트는 **오른쪽만 그리고 좌우 반전**으로 왼쪽 이동 처리

### 멀티 모니터

- 기본적으로 **현재 모니터 안에서만** 이동
- 사용자가 **드래그로 다른 모니터로 이동** 가능 (놓으면 해당 모니터 바닥으로 fall)

### 전체화면 자동 숨김

전체화면 앱이 켜지면 자동으로 창을 숨긴다 (게임·영상 방해 방지). Windows API 폴링 또는 electron `screen` 이벤트 활용.

### 스프라이트 규격

- 기본 프레임: **32×32**
- 화면 표시: **4배 확대** (설정에서 3~5배 조정 가능)
- 프레임 수:
  - idle 2~4 / walk 4~6 (오른쪽만) / sit 2 / sleep 2~3 / drag 2 / happy 3~4

## 5. 설계 3/4 — 메모와 바로가기

### 메모

**작성**
- Enter 저장, Shift+Enter 줄바꿈
- 텍스트 전용 (이미지·리치텍스트 없음)

**목록**
- 📌 **고정 우선**, 그다음 최신순
- 검색 (부분 문자열)
- 수정 / 삭제 / 복사 / 고정 토글

**전역 단축키**
- `Ctrl+Alt+M` → 빠른 메모 팝업
- 저장 시 푸들이 "**기억했어요!**" 말풍선 + 꼬리 흔들기

**데이터 형식**
```ts
type Memo = {
  id: string;         // uuid
  text: string;
  pinned: boolean;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
};
```

### 바로가기 (Launcher)

**등록 경로**
1. 파일 / 폴더 / `.lnk`를 **푸들 창에 드래그앤드롭**
2. 런처 창의 **`+ 추가`** 버튼 → 파일 선택 다이얼로그 또는 URL 입력

**표시**
- 파일·폴더: `app.getFileIcon`으로 **실제 아이콘** 추출
- URL: 🌐 이모지 (v1은 favicon 추출 안 함, YAGNI)
- 드래그로 **순서 변경** 가능

**실행**
- 파일·폴더 → `shell.openPath` (기본 연결 프로그램)
- URL → `shell.openExternal` (기본 브라우저)

**데이터 형식**
```ts
type Launcher = {
  id: string;
  name: string;
  type: "file" | "folder" | "url";
  target: string;   // 절대 경로 또는 URL
  order: number;
};
```

### 저장 안정성

- **Atomic write**: 임시 파일에 쓰고 `rename`으로 바꿔치기
- **일 1회 백업**: `backup/YYYY-MM-DD/`에 그날 첫 실행 시 `memos.json`·`launchers.json`을 복사. 최근 7일치만 보관 (초과 시 오래된 폴더부터 삭제)

## 6. 설계 4/4 — 오류 처리, 테스트, 구조

### 오류 처리

| 상황 | 처리 |
|---|---|
| 바로가기 대상 없음 (파일 삭제됨) | 말풍선 "앗, 못 찾겠어요 🥺" + 목록에 ⚠️ 표시 |
| 메모 파일 깨짐 | `memos.broken-YYYYMMDD-HHmmss.json`으로 이동 후 빈 파일로 시작 |
| 푸들이 화면 밖에 있음 (모니터 해제 등) | 주 모니터 바닥으로 복귀 |
| 전역 단축키 충돌 | 트레이 알림 표시, 설정에서 변경 가능 |
| 중복 실행 | `app.requestSingleInstanceLock()` — 기존 인스턴스가 짧게 happy 애니메이션으로 반응 |

### 테스트

**Vitest (단위)**
- 상태 전환 규칙 (idle → walk 확률, 30s 방치 → sleep 등)
- 경계 계산 (화면 끝 방향 전환, 멀티 모니터 이동)
- Store (atomic write, 백업 로테이션, 깨진 파일 복구)

**Playwright Electron (스모크)**
- 앱 실행 → 푸들 창이 뜬다
- 메모 저장 → 앱 재시작 → 메모가 유지된다
- 바로가기 추가 → 클릭 시 대상이 열린다 (모의 실행)

### 폴더 구조

```
poodle-pet/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── pet-controller.ts
│   │   ├── store.ts
│   │   ├── launcher.ts
│   │   ├── screen-utils.ts
│   │   └── tray.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── pet/         # 스프라이트 애니메이션
│       ├── bubble/      # 말풍선 메뉴
│       ├── memo/        # 메모 창
│       └── launcher/    # 런처 창
├── characters/
│   └── poodle/
│       ├── sprite.png
│       └── manifest.json
├── tests/
│   ├── unit/            # Vitest
│   └── e2e/             # Playwright Electron
├── docs/
│   └── superpowers/
│       └── specs/
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
└── tsconfig.json
```

### 배포

- **electron-builder**로 NSIS 인스톨러 생성
- **코드 서명 없음** (v1) → SmartScreen 경고 발생. README에 "추가 정보 → 실행" 안내 명시

## 부록 A. 블로그 연재 계획

이 앱 제작 과정을 티스토리 "SI 개발자의 AI 에이전트 실전 노트" 연재의 시작 콘텐츠로 활용:

1. **캐릭터 AI 생성기** — 픽셀아트 스프라이트 시트를 프롬프트로 뽑은 삽질기
2. **v1 제작기** — Electron + Claude Code로 데스크톱 펫을 만드는 과정
3. **Tauri 이식기** — 크기·리소스 비교 (v1 릴리스 이후)

각 글 구조: 문제 → Before/After → 방법(프롬프트 공개) → 삽질 포인트 → 결과 → 다음 글.
