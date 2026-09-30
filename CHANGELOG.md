# Changelog

All notable changes to 뽁이 (BOKKI) will be documented in this file. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning [SemVer](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/sylph611/poodle-pet/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sylph611/poodle-pet/releases/tag/v0.1.0
