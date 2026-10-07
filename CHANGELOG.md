# Changelog

All notable changes to 뽁이 (BOKKI) will be documented in this file. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning [SemVer](https://semver.org/).

## [Unreleased]

## [0.5.1] — 2026-10-07

### Added
- **바로가기 별칭** — 바로가기 창에서 ✏️ 버튼으로 별칭 설정. 팔레트 검색에서 별칭·원래 이름·경로 모두 매칭. 리스트/팔레트는 별칭 우선 표시 + 원래 이름 작게.

### Changed
- **팔레트 ✏️ 편집** — 메모 창이 뜰 때 해당 메모를 자동 스크롤 + 하이라이트. 기존엔 창만 뜨고 메모가 안 보이던 문제 해결.

### Chore
- `test-output.txt` 등 vitest 임시 출력 파일 `.gitignore` 반영

## [0.5.0] — 2026-10-04

### Added
- **커맨드 팔레트** — `Ctrl+Alt+M` 한 번에 메모·스니펫·클립보드·바로가기 통합 검색
  - 결과 Enter: 메모·스니펫·클립보드는 **클립보드에 복사**, 바로가기는 실행
  - Ctrl+Enter: 입력 텍스트를 새 메모로 저장 (빈 입력이면 메모 창 바로 열기)
  - 우클릭 또는 ⋯ 아이콘: 아이템별 컨텍스트 메뉴
- **클립보드 히스토리** — 복사한 텍스트 자동 저장 (기본 50개, 20~200 설정)
- **민감 패턴 자동 제외** — 카드번호·2FA·토큰·비밀번호 heuristic
- **트레이 "📋 클립보드 캡처 일시정지"** 체크 메뉴
- **스니펫 = 핀 메모** — 자주 쓰는 메모를 핀 꽂으면 팔레트에서 📎 아이콘으로 노출
- **설정 창 📋 클립보드 섹션** — 캡처 토글 + 보관 수량 슬라이더
- **팔레트 우클릭/⋯ 컨텍스트 메뉴** — 아이템별 액션
  - 메모 → 📎 스니펫으로 꽂기 · ✏️ 편집 · 🗑 삭제
  - 스니펫 → 📝 일반 메모로 (핀 해제) · ✏️ 편집 · 🗑 삭제
  - 클립보드 → 📝 메모로 저장 · 📎 스니펫으로 저장 · 🗑 삭제
  - 바로가기 → 🗑 삭제

### Changed
- **단축키 `Ctrl+Alt+M`** 역할 변경: 빠른 메모 → 팔레트 소환
  - 기존 멘탈 유지: 열자마자 Ctrl+Enter로 입력 텍스트 메모 저장 (빈 상태면 메모 창 바로 열기)
- **Bubble 메뉴에서 ⏱ 포모도로 버튼 제거** (유저 미사용 피드백 반영. 트레이·배지는 유지)

### Fixed
- (해당 없음)

## [0.4.1] — 2026-10-03

### Fixed
- **트레이 메뉴 포모도로 상태 반영 안 되던 버그** — Windows에서 `setContextMenu`로 등록된 캐시 메뉴가 우클릭에 자동으로 뜨면서 동적 rebuild가 가려지던 문제. 캐시 등록을 제거하고 좌/우클릭 때 매번 fresh 메뉴를 띄우도록 수정.

### Added
- **뽁이 클릭 bubble에 ⏱ 포모도로 버튼** — 트레이 외에 bubble에서도 포모도로 토글 가능. 상태(idle/focus/break)에 따라 배경색과 툴팁이 바뀜.

### Changed
- 내부 정리: v0.4.0 deferred minors 4개 (export/import 핸들러 shutdown 가드, remainingMs clamp 의도 주석, suppressIdleToast 동기 의존 주석, unused import 제거).

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

[Unreleased]: https://github.com/sylph611/poodle-pet/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/sylph611/poodle-pet/releases/tag/v0.5.1
[0.5.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.5.0
[0.4.1]: https://github.com/sylph611/poodle-pet/releases/tag/v0.4.1
[0.4.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.4.0
[0.3.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.3.0
[0.2.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.2.0
[0.1.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.1.0
