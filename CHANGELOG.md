# Changelog

All notable changes to 뽁이 (BOKKI) will be documented in this file. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning [SemVer](https://semver.org/).

## [Unreleased]

## [0.4.0] — 2026-10-02

### Added
- **포모도로 타이머** — 25분 집중 / 5분 휴식 기본값
  - 집중 중 뽁이는 sit 자세 고정 (focus lock)
  - 휴식 중 뽁이는 평소대로 움직임
  - 뽁이 머리 위 작은 타이머 배지 (집중: 빨강, 휴식: 초록)
  - 트레이 "⏱ 포모도로 시작/중지 (XX:XX)" 동적 메뉴
  - 세션 전환 시 뽁이 토스트 알림 ("집중 끝! 5분 쉬어요 🍵")
  - 설정에서 집중 15~60분, 휴식 3~15분 조정 가능
- **메모리 측정 스크립트** — `npm run measure:memory`

### Changed
- **메모리 다이어트** — memo·launcher·settings·info 4개 창을 lazy 생성
  - 상시 메모리 ~757 MB → ~520 MB (-31%)
  - 창 처음 열 때 300~500ms 로딩 (수용 가능)
  - 창 닫기(X 버튼) 동작 변경: hide → destroy (데이터는 Store에 영속)
- 트레이 메뉴 열릴 때마다 동적 rebuild (포모도로 상태 반영)

## [0.3.0] — 2026-09-30

### Added
- **자동 업데이트** (electron-updater + GitHub Releases 연동)
  - 시작 5초 후 자동 체크 (조용히)
  - 새 버전 발견 시 백그라운드 다운로드 → 완료되면 "지금 재시작 / 나중에" 다이얼로그
  - 트레이 메뉴 "업데이트 확인"에서 수동 체크 가능
- README 스크린샷 그리드 + shields.io 배지 (release / platform / license / coffee)
- `scripts/capture-screenshots.mjs`: Playwright Electron으로 각 창 자동 캡처

### Changed
- 트레이 메뉴에 "업데이트 확인" 항목 추가

### Fixed
- 런처 URL 추가 · 메모 편집: `window.prompt()` Electron 미지원 → 인라인 모달로 교체

## [0.2.0] — 2026-09-30

배포 준비 라운드. 이름 변경 + 설정 창 + 사용성 개선.

### Added
- **이름 변경**: Poodle Pet → **뽁이 (BOKKI)**. 데이터 위치도 `%APPDATA%\BOKKI\`로 이동 (신규 설치)
- **설정 창**: 스프라이트 크기 · 걷기 속도 · 빠른 메모 단축키 · 전체화면 자동 숨김 · Windows 시작 시 자동 실행
- **단축키 실시간 변경**: 설정 창에서 새 조합 녹음. 이미 사용 중이면 자동 롤백
- **첫 실행 안내 다이얼로그**: 트레이 위치 · 종료 방법 · 주요 단축키 안내
- **트레이 "도움말" 메뉴**: 같은 안내를 언제든 다시 볼 수 있음
- **메모·바로가기 Export/Import** (JSON): PC 이사할 때 데이터 옮기기
- **데이터 폴더 열기** 버튼 (설정 창): `%APPDATA%\BOKKI\` 바로 열림
- **LICENSE (MIT)** + CHANGELOG.md

### Fixed
- **다중 모니터 드래그**: `screen.getCursorScreenPoint()` 기반으로 재작성, 클램프 제거 → 여러 모니터로 자유롭게 이동
- **드래그 시 강아지가 커서에서 도망가는 버그**: Pointer Events + `setPointerCapture` + `display.bounds` 클램프 완화
- **말풍선 UX**: 재클릭 토글 · 외부 클릭 자동 닫힘 · 드래그 중 창 따라오기
- **패키징**: `signAndEditExecutable:false`로 winCodeSign 다운로드 스킵 → NSIS 인스톨러 정상 생성

### Changed
- **UI 리디자인**: 메모·런처·말풍선·설정 카라멜/초콜릿 톤 통일. 카드형 리스트, hover lift
- **CPU 최적화**: 상태별 adaptive tick (walk/fall/drag 33ms, idle 120ms, sleep 500ms)
- **낙하 물리**: 잡았다 놓으면 중력으로 부드럽게 착지 (기존 순간이동 대신)
- **애니메이션 fps 조정**: idle 3, walk 5, happy 6, drag 5 — AI 프레임 미세 어긋남 완화

## [0.1.0] — 2026-09-30

첫 배포 가능한 빌드. Windows 데스크톱 갈색 푸들 펫 v1.

### Added — 기능
- **돌아다니기**: idle / walk / sit / sleep / drag / fall / happy 7상태 머신, 30초 방치 시 sleep, 화면 끝에서 방향 전환
- **클릭**: 말풍선 메뉴 (📝 메모 / 🚀 바로가기 / 💤 재우기). 재클릭 토글, 외부 클릭 자동 닫힘, 드래그 중 창 따라오기
- **드래그**: 다중 모니터 지원 (OS 커서 기반). 놓으면 중력 물리로 부드럽게 착지
- **메모**: 작성(Enter 저장, Shift+Enter 줄바꿈), 검색, 고정, 복사, 수정, 삭제. `%APPDATA%\BOKKI\memos.json`에 atomic write + 일 1회 백업(7일 보관)
- **바로가기 런처**: 파일/폴더/URL 등록·실행. 실제 파일 아이콘 표시. 푸들에 드래그앤드롭으로 자동 등록. 드래그 순서 변경
- **전역 단축키** `Ctrl+Alt+M`으로 빠른 메모 열기
- **트레이 아이콘** + 숨기기/보이기 · 종료
- **전체화면 자동 숨김**: 게임/영상 방해 방지
- **단일 인스턴스 락**: 중복 실행 방지
- **화면 구성 변경 시 자동 위치 복구**

### Design
- 갈색 카라멜/초콜릿 톤 UI (메모·런처·말풍선 통일)
- 실제 반려견 사진 기반 AI 스프라이트 (192×192 시트, 21 프레임)
- 각 프레임 자동 검출·중앙정렬로 부드러운 애니메이션

### Tech
- Electron 32 + TypeScript 5 + electron-vite
- 26 Vitest unit tests + 3 Playwright Electron smoke tests
- NSIS 인스톨러 + 포터블 zip 배포
- Context isolation, preload IPC only (보안)

### Known Issues
- **SmartScreen 경고**: 코드 서명 없어서 첫 실행 시 경고 → "추가 정보 → 실행"
- **트레이 아이콘 뭉개짐**: 현재 sprite.png 전체 축소 → 개선 예정
- **캐릭터 스프라이트 빨간 테두리**: AI 생성 특성. 재생성 예정

[Unreleased]: https://github.com/sylph611/poodle-pet/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.4.0
[0.3.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.3.0
[0.2.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.2.0
[0.1.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.1.0
