# Poodle Pet 🐩

Windows 바탕화면을 돌아다니는 픽셀아트 푸들 데스크톱 펫.
메모와 바로가기 기능이 함께 딸려 있습니다.

## 실행

```powershell
npm install
npm run gen:sprite     # 임시 스프라이트 생성 (첫 실행 시)
npm run dev
```

## 설치파일 만들기

```powershell
npm run pack
# dist/Poodle Pet Setup 0.1.0.exe
```

**SmartScreen 경고**: 코드 서명이 되어있지 않아 처음 실행 시 "Windows에서 PC를 보호했습니다" 경고가 나옵니다. **추가 정보 → 실행**을 눌러 진행하세요.

## 개발

- `npm test` — 단위 테스트 (Vitest)
- `npm run test:e2e` — 스모크 테스트 (Playwright Electron)

## 스프라이트 교체

`characters/poodle/sprite.png`와 `manifest.json`을 교체하면 됩니다. 프레임은 32×32, 행 순서는 idle/walk/sit/sleep/drag/happy.

## 데이터 위치

`%APPDATA%\poodle-pet\`
- memos.json / launchers.json / settings.json
- backup/YYYY-MM-DD/ (최근 7일)
