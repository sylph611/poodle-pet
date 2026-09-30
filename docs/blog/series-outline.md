# 뽁이(BOKKI) 개발 블로그 3편 시리즈 구성

> 티스토리 "SI 개발자의 AI 에이전트 실전 노트" 연재 시작 시리즈.
> 원본 자료: [dev-journal.md](./dev-journal.md).

## 시리즈 관통 컨셉

**"Claude Code 하나로 데스크톱 앱 하나를 만들었다 — 설계부터 배포·자동업데이트까지"**

- 대상 독자: AI 코딩 도구에 관심 있는 개발자, 특히 SI/실무자
- 총 3편으로 완결. 각 편 독립적으로 읽혀도 되지만 순서대로 읽으면 시너지
- 각 편 8~15분 읽는 분량. 주제별 명확한 take-away

---

## 1편: 설계부터 배포까지 — Claude Code로 데스크톱 앱 만들기

**한 줄**: 브레인스토밍 → 스펙 → 14 태스크 계획 → SDD로 fresh subagent 실행 → NSIS 인스톨러까지 하루 만에.

**대상**: AI 코딩 워크플로우 궁금한 개발자. 코드보다 프로세스가 중심.

### 목차
1. **왜 데스크톱 펫?**
   - 개인 도구 + 블로그 연재 소재 + 검증 실험
   - Windows 바탕화면에 갈색 픽셀아트 푸들
2. **Superpowers 스킬 체인**: brainstorming → writing-plans → SDD
   - 각 스킬이 뭘 하는지 (한 문단씩)
   - "간단해도 스펙 무조건 쓰기" 원칙
3. **14 태스크 계획을 어떻게 쪼갰나** (Ch 1)
   - 태스크 right-sizing: 자기완결 · 인터페이스 명시 · 스텝 2~5분
4. **SDD 실행: fresh subagent 패턴** (Ch 2)
   - Task마다 새 subagent 파견 → context pollution 없음
   - 리뷰 subagent가 spec 준수·품질 검증
   - Fix loop (최대 5라운드)
   - 모델 선택 가이드 (haiku vs sonnet)
5. **결과 스냅샷**
   - 커밋 수, 태스크 통계, 소요 시간
   - Task 13(e2e)에서 발견된 3개 프로덕션 버그를 SDD가 잡아낸 순간
6. **다음 편 예고**: 캐릭터 아트

**Take-away**: 개인 도구 정도는 "AI로 하루" 가능. 핵심은 프로세스 규율 (스펙·계획·fresh subagent).

**저널 참조**: Chapter 1, 2 + 부록 C (커밋 히스토리)

**추천 이미지**:
- 스크린샷: `docs/media/pet.png`, `docs/media/settings.png`
- 다이어그램: 스킬 체인 흐름 (spec.md → plan.md → SDD)
- 커밋 그래프 (git log --oneline)

---

## 2편: 실 반려견 사진에서 픽셀아트 스프라이트로 — AI 아트 후처리 파이프라인

**한 줄**: AI 그림 도구는 32×32 정확도가 약하다. 원본을 어떻게 앱에 붙일 수 있는 상태로 만들었나.

**대상**: AI 이미지 생성 결과를 실 프로덕션 자산으로 쓰려는 개발자·기획자.

### 목차
1. **Placeholder → 실 캐릭터로 가는 여정**
   - 색 사각형 placeholder (Ch 4.1)
   - "야임마.. 그냥 사각형인데..?" 유저 반응
2. **프롬프트 진화**
   - v1: 스프라이트 시트 통짜 (일반 요구사항)
   - v2: 실 반려견 사진 참조 → 훨씬 개성 있는 결과 (**이 프롬프트 공개**)
3. **크기 문제: 1374×1145 → 192×192**
   - AI는 32px 정확도 약함
   - `scripts/resize-sprite.mjs` — 알파-가중 다운샘플
4. **정렬 문제: idle이 뒤로 흐르고 walk에 위 그림이 잘림**
   - AI 프레임이 6×6 그리드에 안 맞음
   - `scripts/extract-frames.mjs` — 연결 성분 자동 검출 + 셀 중앙 정렬
5. **트레이 아이콘: 정면 얼굴로 교체**
   - "옆면"→ "정면"으로 바꾸는 프롬프트
   - bbox 자동 검출 + cover 모드 crop
6. **자동 스크린샷 캡처 (덤)**
   - Playwright Electron으로 각 창 자동 캡처
   - 임시 userData + 샘플 데이터로 예쁘게 렌더링
7. **재사용 가능한 프롬프트 모음** (부록)

**Take-away**: AI 이미지 결과물을 앱에 바로 못 쓴다. 다운샘플·정렬·bbox crop 같은 **후처리 파이프라인이 실은 개발자의 일**. 스크립트화 해두면 재사용 가능.

**저널 참조**: Chapter 4 전체 + 부록 A (프롬프트)

**추천 이미지**:
- Before/After: AI 원본 vs 후처리된 스프라이트 시트
- `docs/media/about.png` (스프라이트 hero)
- `docs/media/pet.png` (실제 앱에서 렌더된 모습)

---

## 3편: Electron 실전 삽질기 — 프로덕션 크래시, UX 튜닝, 자동 업데이트까지

**한 줄**: 구현이 끝났다고 끝난 게 아니었다. e2e부터 실사용, 자동업데이트 배포까지의 6가지 삽질.

**대상**: Electron 앱 만드는 개발자. 특히 "일단 실행되는데 어딘가 이상한" 상태에서 발돋움하려는 사람.

### 목차
1. **e2e가 유닛 100개보다 나은 순간** (Ch 2)
   - Task 13에서 발견된 3개 프로덕션 버그:
     - preload `.mjs vs .js` — packaged 앱 완전 파괴
     - `app.quit()` 60초 hang — memo/launcher 창의 `close: preventDefault`
     - Single-instance 락이 e2e 재시작을 막음
2. **셧다운 크래시: `Object has been destroyed`** (Ch 3.1)
   - Playwright teardown 중 `app.emit(second-instance)` → destroyed 창 접근
   - `isDestroyed` guard 11곳 추가
3. **투명 창에서 `file://` fetch 차단** (Ch 3.2)
   - dev 서버(http)에서 파일 URL 못 읽음 → 스프라이트 안 뜸
   - IPC로 콘텐츠(파싱된 JSON + dataURL) 직접 반환
4. **드래그 UX 3콤보 fix**
   - 커서에서 도망가는 강아지 (Ch 7.1): Pointer Events + `setPointerCapture` + display.bounds
   - 다중 모니터 크로스 (Ch 7.2): `screen.getCursorScreenPoint()` 사용
   - 낙하 물리 (Ch 5.1): setInterval + 중력 상수
5. **말풍선 popover UX 3종세트** (Ch 6.1)
   - 재클릭 토글 · 외부 클릭 자동 닫힘 · 드래그 유지
   - focus + blur + ignore-window 패턴
6. **`window.prompt`이 안 됩니다** — 인라인 모달 우회
7. **자동 업데이트 도입 (v0.3.0)**
   - electron-updater + GitHub Releases 연동
   - `latest.yml`이 필수
   - 트레이 "업데이트 확인" + 백그라운드 다운로드 + 재시작 확인
8. **마무리**: v0.3.0 배포까지 총 몇 개의 fix가 있었나

**Take-away**: 데스크톱 앱 완성도는 "얼마나 세심하게 실행-발견-fix 루프를 돌았나"에 달림. AI 코딩은 이 루프를 빠르게 반복하기에 유리.

**저널 참조**: Chapter 3, 5, 6, 7 + 부록 B (스크립트) + 자동 업데이트 (신규)

**추천 이미지**:
- 크래시 다이얼로그 스크린샷 (Ch 3.1)
- DevTools의 에러 메시지 (Ch 3.2)
- `docs/media/help.png` (도움말 창 UI)
- 자동 업데이트 다이얼로그 (배포 후 캡처)

---

## 각 편 예상 소요·순서 팁

| 편 | 초안 작성 | 다듬기 | 총 |
|---|---|---|---|
| 1편 (프로세스) | 2-3h | 1h | 3-4h |
| 2편 (스프라이트) | 2h | 1h | 3h |
| 3편 (Electron 삽질) | 3h | 1-2h | 4-5h |

**추천 발행 순서**:
1. **1편** 먼저 → 반응 보기. 에이전트/AI 코딩 관심 있는 분들 잡히면 시리즈 완성 동기 강함
2. **3편** 두 번째 → 실용적 Electron 팁 많아서 SEO/북마크 잘 됨
3. **2편** 마지막 → 이미지 위주라 시각적으로 강하지만 독자층이 좁을 수 있음 (게임/디자인 관심층)

또는 **1 → 2 → 3** 순서대로 (서사 자연스러움)도 가능.

---

## 각 편 공통 요소

- **문제 → Before/After → 방법 (프롬프트/코드 공개) → 삽질 포인트 → 결과 → 다음 편 안내**
- 시리즈 배너 이미지 (뽁이 스프라이트 시트)
- 하단에 GitHub 링크 · 인스톨러 링크
- Buy me a coffee 링크
- 다음 편 CTA
