# P-ACA Redesign — 3 Directions and Recommendation

대상 독자: P-ACA 운영자·디자이너·엔지니어. 본 문서는 [paca-redesign-llm-prompt.md](./paca-redesign-llm-prompt.md) 의 산출물 (3개 방향 + 각 스케치 + 추천 + 트레이드오프) 을 정리한 결과 보고다.

원본 산출물 위치: [DESIGN.md](../DESIGN.md) · 격리 스펙: [redesign-isolation-spec.md](./redesign-isolation-spec.md)

---

## 1. 세 방향 요약

| | A · Operations Desk | B · Branch Control | C · Field Console |
|---|---|---|---|
| **포지셔닝** | 조용한 라이트 콘솔 · 테이블 우선 | 웜 뉴트럴 · 지점·요일 헤더 · 3-panel 스캔 | 고대비 그래픽 · 큰 터치 · 액션 레일 |
| **타깃 사용자** | 데스크에서 학생 명단/결제/상담을 자주 보는 운영자 | 하루 전체를 훑어보는 매니저·점장 | 태블릿/데스크 혼합 · 현장 동선 |
| **셸 형태** | 56px 아이콘 레일 + 56px 커맨드바 + 좌 큐 + 메인 | 240px 라벨 레일 + 강한 day 헤더 + 3-panel | 96px 검정 액션 레일 + 큰 헤더 + 일정(좌) + 현황(우) |
| **컬러** | cool gray + deep teal `#0F766E` | warm ivory + olive/sage `#4A6741` + brass | ink + golden yellow `#F5B800` |
| **배지** | 5종 pastel + dot | 3종 패널 단위 색상 | 두꺼운 2px 보더 배지 |
| **테이블** | sticky 헤더, 학생 행 + 액션 | 타임라인 도트 + 카드 | 슬롯 카드 (44px 정사각 액션) |
| **태블릿 적응** | 큐 숨김, KPI 3열 압축 | 사이드바 라벨 숨김, 1열 스택 | 이미 태블릿 우선, 우측 strip 2열 |
| **러닝커브** | 낮음 | 중간 | 중간 |
| **파일** | [a-operations-desk.html](../prototypes/a-operations-desk.html) | [b-branch-control.html](../prototypes/b-branch-control.html) | [c-field-console.html](../prototypes/c-field-console.html) |

---

## 2. 방향별 상세

### 2.1 Direction A — Operations Desk

**포지셔닝**
PC 기반 운영자에게 "지금 해야 할 일"이 가장 빠르게 보이도록 한 정통 운영 콘솔. 작은 아이콘 레일로 메뉴 밀도를 높이고, 상단 커맨드바(⌘K)로 학생·강사·메모 검색을 마찰 0으로 만든다. 좌측 큐(오늘의 할 일)는 시간순, 우측 메인은 KPI → 테이블 위계로 흐른다.

**레이아웃**
- 56px 아이콘 레일 (8개 항목, 활성 상태는 teal tint 배경)
- 56px topbar (브레드크럼 + ⌘K 검색 + 오늘 날짜 + 알림 + primary CTA)
- 본문: 360px 좌측 큐 + 메인 그리드
- 메인: 6-셀 KPI 스트립 (compact, hero 아님) → 학생 명단 패널(탭 + sticky 헤더 테이블 + row actions)

**컬러 전략**
- 표면: 거의 흰색 (`#FAFAF9` / `#FFFFFF`) — calm 사무실 톤
- 보더: 매우 옅은 warm gray (`#E7E5E4`)
- 액센트: deep teal `#0F766E` (one-note 청보라/네이비 회피)
- 상태 색: green `#15803D`, amber `#B45309`, red `#B91C1C`
- KPI 스트립: 1px 보더로 셀 구분, hero-metric 카드형 ❌

**타이포그래피**
- Pretendard Variable 14px 본문
- 라벨/숫자는 11px uppercase + tracking 0.05em
- 숫자는 tabular-nums (`mono` 클래스)

**테이블 처리**
- sticky 헤더, 10×12 padding, 보더는 행 사이 1px
- 학생 행 = avatar + 이름/메타 + 학년 + 전공 + 출석 배지 + 다음 상담 시간(우측 정렬, mono) + 결제 배지 + row actions
- 호버 시 `#F5F5F4` 배경
- 탭은 sticky 헤더 위 인라인 — 페이지 새로고침 없이 카테고리 전환

**상태/배지 언어**
- 출석: 출석(green) · 지각(red) · 결석(red dark) · 미체크(gray)
- 결제: 완납(green) · 분납 중(amber) · 미납(red)
- 상담: 예약(teal) · 대기(gray)
- dot + 라벨 + 색상 배경 3요소로 색맹 사용자에게도 라벨로 구분 가능

**모바일/태블릿 적응**
- 1024–1180px: 좌측 큐 숨김, KPI 3열로 압축, 검색바 유지, 상단에 태블릿 안내 배너 표시
- 모바일(<768px) 미정의 — 추후 작업 (현재 운영자는 PC 우선)

**빈/로딩/에러**
- 선택된 학생이 없음: 점선 보더 패널 + "왼쪽 명단에서 학생을 선택하면 …" 한국어 안내
- 로딩/에러는 동일 패턴 (점선 → 솔리드 + 색상)으로 일관 처리 가능

---

### 2.2 Direction B — Branch Control

**포지셔닝**
매니저·점장이 "오늘 일산교육원이 어떻게 굴러가는가"를 5초 안에 파악하도록 한 스캔 우선 콘솔. 사이드바에 지점 라벨을 노출하고, day header를 큰 글씨로 올려 시간 인식을 강화한다. 본문은 일정/상담/금일 결제 3-panel로 동시에 흐른다.

**레이아웃**
- 240px 라벨 사이드바 (그룹: 운영 / 학생·강사 / 재무·리포트)
- 사이드바 하단: 현재 지점 셀렉터 (점 색상 + 이름 + 학생/강사 수)
- 상단 day header: 일시/지점 + 점장명 + 액션 3종
- 5-스캔 KPI 가로 띠 (출석률/신규/상담/입금/미납)
- 본문 3-panel: 일정(타임라인) + 상담 큐 + 금일 결제

**컬러 전략**
- 표면: warm ivory `#F8F4ED` / cream `#FFFDF7`
- 보더: warm taupe `#E6DDC9`
- 액센트: deep olive/sage `#4A6741` (warm + 자연, beige 팔레트 회피)
- 보조 액센트: brass `#B89643` (gold 톤, orange/brown 회피)
- 상태: forest `#2D5F2D`, amber `#C2862A`, terracotta-red `#B84A3C`
- 사이드바 활성: 액센트 fill + 흰색 텍스트 (heavy)

**타이포그래피**
- Pretendard 14px 본문
- day header 26px 700 weight
- panel title 14px 700 + count chip

**테이블 처리**
- 일정 패널: 세로 타임라인 (도트 + 시간 + 제목 + 보조 텍스트 + 태그)
- 상담 큐: avatar + 이름/주제 + 시간/배지 행
- 금일 결제: 이름/메타 + 금액 (ok=green, bad=red) 행

**상태/배지 언어**
- 패널 단위로 색상 의미 분리: 상담 패널은 teal-warm, 결제는 ok/bad 톤
- 같은 "지각"이 A에서는 row badge, B에서는 panel 단위 색으로 압축 표현
- 3-tier: up / soon / late (단순화)

**모바일/태블릿 적응**
- 1024–1180px: 사이드바 64px (라벨 숨김), 본문 1열로 스택, KPI 3열로 압축
- 모바일: 1열 풀 스택 + KPI는 가로 스크롤 또는 더보기

**빈/로딩/에러**
- 각 패널 하단 또는 별도 상태 카드에 한국어 안내
- "아직 등록된 상담이 없습니다 — 첫 상담을 등록해 보세요" 같은 액션 유도형 카피

---

### 2.3 Direction C — Field Console

**포지셔닝**
태블릿과 데스크를 오가는 현장 운영자(코치·데스크 보조·점장 순찰)를 위한 고대비 그래픽 셸. 검정 액션 레일에 큰 아이콘과 라벨을 배치해 동선 중에도 빠르게 누를 수 있다. 일정이 1차 뷰이고, 현재 진행 중인 슬롯은 노란 강조 + 검정 드롭 섀도우로 즉시 인식.

**레이아웃**
- 96px 검정 액션 레일: 메인 3개 + 빠른 액션 3개 + 시계
- 72px 상단 헤더: 큰 날짜(`6.21`) + 검색 + primary CTA
- 본문 2분할: 좌측 일정 슬롯 카드(약 60% 너비) + 우측 현황 카드(약 320px)
- 슬롯은 sticky/stack 형태로 위→아래 시간 흐름

**컬러 전략**
- 표면: warm off-white `#F4F2EC` / pure white
- ink: `#0A0A0A` (텍스트 + 액션 레일 + 보더)
- 액센트: golden yellow `#F5B800` (현재 진행 슬롯 / 큰 액션 버튼)
- 보조: ink 단색, 거의 무채색 셸에 색 한 방울
- 상태: green `#00863A`, amber `#E89B0E`, red `#D62828`
- 모든 카드/배지에 2px 검정 보더 (브루탈 + 그래픽)

**타이포그래피**
- Pretendard 800 weight가 기본 (action-heavy 톤)
- 시간은 22px 800, 카드 제목 16px 800, 본문 13px 500
- 시각적 무게가 높아 정보 밀도는 낮지만 즉시 스캔 가능

**테이블 처리**
- 테이블 대신 슬롯 카드 — 시간 + 제목 + 부제 + 태그 + 44px 정사각 액션
- "진행 중" 슬롯: 노란 배경 + 검정 6px 드롭 섀도우 + 살짝 들뜬 효과
- 과거 슬롯: 55% opacity로 가라앉힘

**상태/배지 언어**
- 두꺼운 2px 보더 + 의미 색 배경
- 진행 중 / 완료 / 지각 / 미납 / 준비 완료
- 단어보다 색·보더로 즉시 구분 — 동선 중 시인성 우선

**모바일/태블릿 적응**
- 태블릿 우선 — 1024–1180px에서 우측 strip이 2열 grid로 압축
- 모바일(<768px): 액션 레일 유지(터치 필수), 일정 카드 폭 100%
- 1024px 이상에서는 풀 레이아웃

**빈/로딩/에러**
- 점선 보더 상태 카드 (info) + 솔리드 빨강 보더 에러 카드 (즉시 시선 집중)
- 한국어 카피: "결제 동기화 실패 · 3건의 카드 결제가 PG사에서 보류"

---

## 3. 추천 (Recommendation)

### 3.1 1차 추천: **Direction A — Operations Desk**

**추천 이유**

1. **사용 빈도와 일치**: P-ACA 운영 시간의 대부분은 "학생 한 명 검색 → 출결·결제·상담 메모 조회"다. A는 그 동선에 가장 짧은 경로를 제공한다. 큐(왼쪽) → 검색(⌘K) → 테이블 행 → row action까지 마우스 이동이 0에 가깝다.

2. **밀도가 곧 신뢰**: 한국 운영 도구는 데이터를 많이 보여줘야 신뢰받는다. A의 KPI 6-셀 스트립 + sticky 학생 테이블은 "이 학원이 정밀하게 굴러간다"는 인상. B는 너무 안락해 보이고, C는 정보가 너무 적어 보인다.

3. **러닝커브 최소**: 운영자가 이미 어드민 패턴에 익숙 — 좁은 레일 + 상단 검색 + 좌측 패널 + 우측 테이블. 새 패턴 학습 없이 진입.

4. **엔지니어링 비용 최소**: A는 기존 Next.js 라우팅과 테이블 컴포넌트를 그대로 활용 가능. B는 3-panel grid 레이아웃을 새로 짜야 하고, C는 큰 액션 컴포넌트와 ink-on-yellow 조합이 새 디자인 시스템 작업이다.

5. **확장성**: A 위에 B의 3-panel 헤더와 C의 액션 모드를 모두 더할 수 있다. (역으로 B/C에서 A의 테이블 밀도를 끌어오기는 어렵다.)

### 3.2 A의 약점과 보완책

| 약점 | 보완 |
|---|---|
| "오늘을 훑는" 매니저 뷰가 약함 | B의 5-스캔 KPI 띠를 A 헤더 아래 보조 row로 차용 (A 메인 KPI와 다른 톤) |
| 태블릿에서 좌측 큐 사라짐 | 큐를 하단 sheet 또는 별도 라우트로 살리는 v2 작업 |
| 현장 동선(체육관) 약함 | 운동장 진입 시 `/field` 라우트로 C의 큰 액션 모드를 토글 (별도 셸) |
| 한국 운영자에게 너무 정통 → 차별 약함 | OKLCH 토큰 + 미세 인터랙션(검색 자동완성, 키보드 단축키)으로 "현대판"임을 강조 |

### 3.3 차선책 (상황별)

- **학원장이 출석률·매출을 매일 점검한다면**: A 헤더 + B의 day-header 강조 + B의 5-스캨 KPI 결합
- **태블릿 거치형 데스크에서 운영한다면**: C의 큰 액션 + A의 테이블 모드를 환경에 따라 토글
- **단일 지점이 아닌 본사/지점 통합 화면이라면**: B의 warm-neutral이 지점 라벨링에 유리

---

## 4. 트레이드오프 정리

### 4.1 A 선택 시 잃는 것

- "오늘을 한눈에" 매니저 시점 → B에서만 가능. 헤더에 추가 row를 더해 보완.
- 터치 큰 UI → 모바일/태블릿 사용성 약화. 별도 필드 모드로 분리.
- 디자인 임팩트(차별성) 약함 → OKLCH 토큰 + 키보드 인터랙션으로 승부.

### 4.2 A 선택 시 얻는 것

- 운영 시간 절감 (검색·테이블 동선이 가장 짧음)
- 학습 비용 0 → 교육/온보딩 시간 절약
- 기존 컴포넌트 재사용률 최대 → 개발 비용 최소
- 데이터 밀도 유지 → 운영자가 "이 도구를 신뢰한다"

### 4.3 거부되는 옵션

- **B 단독 채택**: 학습 비용 + 본문 사이즈 감소로 운영자가 불편해할 가능성. 차선책으로 A 위에 부분 차용.
- **C 단독 채택**: PC 운영자에게 너무 평면적이고 정보가 부족함. 현장 동선 전용 라우트로 격리.

---

## 5. 다음 단계 (Next Steps)

1. **A를 Next.js 시드 라우트로 옮김**: `prototypes/a-operations-desk.html` → `src/app/(console)/dashboard/page.tsx` + Tailwind 토큰화 (`tailwind.config.ts` 업데이트).
2. **테이블 컴포넌트 추출**: `<StudentsTable>` (sticky 헤더 + row action + status badge) 재사용 가능 모듈로 분리.
3. **OKLCH 토큰 정의**: `DESIGN.md` 의 토큰을 Tailwind theme로 매핑. `--accent` 등 CSS variable → `theme.extend.colors`.
4. **백-포트 정책 수립**: lab에서 검증된 컴포넌트를 production repo로 옮길 때의 PR 리뷰 기준 작성 (`/docs/backport-policy.md`).
5. **Playwright 스모크**: `dashboard`, `students`, `consultations`, `schedules`, `payments`, `tablet-attendance` 6개 라우트에 대해 시각 회귀 테스트 베이스라인.
6. **B·C의 장점 부분 차용**: A 빌드 후 헤더에 매니저 KPI row(차용 B) + 현장 라우트(차용 C)를 v1.1로 백로그.

---

## 6. 부록 · 파일 트리

```
projects/redesign-labs/paca-redesign-lab/
├── DESIGN.md                          ← 디자인 토큰 + 3 후보 방향 정의
├── docs/
│   ├── paca-redesign-llm-prompt.md    ← 본 작업의 입력 프롬프트
│   ├── redesign-isolation-spec.md     ← 격리 + 백-포트 정책
│   └── directions-and-recommendation.md  ← 본 문서
└── prototypes/
    ├── index.html                     ← 3방향 비교 캔버스
    ├── a-operations-desk.html         ← Direction A 풀 프로토타입
    ├── b-branch-control.html          ← Direction B 풀 프로토타입
    └── c-field-console.html           ← Direction C 풀 프로토타입
```

브라우저에서 `prototypes/index.html` 을 열면 세 방향이 한 화면에 스케일되어 보이고, 각 파일을 직접 열면 1280px 풀 프로토타입으로 확인 가능.
