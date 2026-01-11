# P-ACA UI/UX 통합 수정 계획

> **작성일**: 2026-01-11
> **배경**: 4명의 디자이너(민지, 다크, 채린, 글래스) 평가 결과 절충
> **목표**: 학원관리 시스템에 맞는 실용적이고 깔끔한 UI/UX

---

## 📐 디자인 시스템 정의 (4명 합의)

### 채택 방향
| 디자이너 | 채택 여부 | 적용 범위 |
|----------|-----------|-----------|
| **민지 (미니멀)** | ✅ 메인 채택 | 여백 정리, 타이포 통일, 색상 단순화 |
| **다크 (다크모드)** | ✅ 채택 | 다크모드 기본값 변경, 대비 개선 |
| **채린 (컬러풀)** | ⚠️ 부분 채택 | 주요 CTA 버튼에만 미세한 그라데이션 (이모지 X, 과한 컬러 X) |
| **글래스 (글래스모피즘)** | ❌ 대부분 거절 | glass orbs X, subtle hover 효과만 유지 |

### 색상 팔레트
```css
/* Primary (Blue 기반) */
--primary: 221.2 83.2% 53.3%;  /* #3B82F6 */
--primary-foreground: 210 40% 98%;

/* Grayscale - 미니멀 */
--background: 0 0% 100%;        /* Light */
--background-dark: 224 71% 4%;  /* Dark */
--foreground: 222.2 84% 4.9%;   /* Light */
--foreground-dark: 210 40% 98%; /* Dark */

/* Muted - 덜 강조 */
--muted: 210 40% 96.1%;
--muted-foreground: 215.4 16.3% 46.9%;

/* Border - 얇고 투명 */
--border: 214.3 31.8% 91.4%;    /* Light */
--border-dark: 217 32% 17%;     /* Dark */

/* Accent Colors (최소한으로) */
--accent-cyan: 186 100% 42%;
--accent-violet: 263 70% 58%;
--accent-emerald: 160 84% 39%;
--accent-amber: 38 92% 50%;
--accent-red: 0 84.2% 60.2%;
```

**규칙:**
- 한 화면에 3가지 색 이하
- Primary는 강조에만 사용
- Muted는 보조 정보에 사용

### 타이포그래피 스케일
```css
/* Pretendard Variable 유지 */
--font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, sans-serif;

/* 크기 */
--text-xs: 12px;    /* 보조 정보 */
--text-sm: 14px;    /* Body 기본 */
--text-base: 16px;  /* 강조 Body */
--text-lg: 18px;    /* Subheading */
--text-xl: 24px;    /* Heading */
--text-2xl: 32px;   /* Page Title */
--text-3xl: 48px;   /* Hero (거의 안 씀) */

/* 자간/행간 */
letter-spacing: -0.02em;  /* 제목 */
line-height: 1.6;         /* 본문 */
```

**규칙:**
- Body는 14px (text-sm) 기본
- 제목은 font-bold, tracking-tight
- 보조 정보는 text-muted-foreground

### 간격 시스템 (8px 그리드)
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;   /* 기본 gap */
--space-6: 24px;   /* 기본 padding */
--space-8: 32px;
--space-12: 48px;  /* 섹션 간격 */
--space-16: 64px;
```

**규칙:**
- 모달 패딩: `py-6 px-6` (24px) 필수
- 카드 내부: `p-6` 표준
- 요소 간격: `gap-6` 표준
- 섹션 간격: `space-y-8` (32px)

### 그림자/효과
```css
/* Shadow - 최소화 */
--shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.02);
--shadow-md: 0 2px 4px 0 rgba(0,0,0,0.04);
--shadow-lg: 0 4px 8px 0 rgba(0,0,0,0.06);

/* Hover 효과 - Subtle */
transform: translateY(-2px);
transition: all 0.2s ease;

/* Border Radius */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

**규칙:**
- ❌ Glass effect 제거 (backdrop-blur)
- ❌ Glow 효과 제거
- ✅ Hover는 -2px 이동 + subtle shadow
- ✅ Border radius는 8-12px

---

## 🚀 Phase 1: 전역 스타일 (Critical)

### 1.1 `src/app/globals.css`

#### 수정 사항
- [ ] ❌ **제거**: glass, glow, gradient 관련 유틸리티 클래스
- [ ] ✅ **수정**: 그림자를 더 subtle하게 변경
- [ ] ✅ **수정**: 다크모드 기본값 변경 (현재: light → 변경: dark)
- [ ] ✅ **수정**: 스크롤바 더 얇게 (6px → 4px)

#### 구체적 코드 변경
```css
/* 제거할 것 */
- .glass, .dark .glass (line 166-173)
- .glow (line 184-186)
- .text-gradient (line 176-181)
- --gradient-card (line 41, 84)
- --gradient-primary (line 40)
- --shadow-glow (line 47, 85)

/* 수정할 것 */
:root {
  /* 그림자 더 연하게 */
  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.02);
  --shadow-md: 0 2px 4px 0 rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 8px 0 rgba(0,0,0,0.06);
}

/* 스크롤바 */
::-webkit-scrollbar {
  width: 4px;    /* 6px → 4px */
  height: 4px;
}
```

### 1.2 `tailwind.config.ts`

#### 수정 사항
- [ ] ❌ **제거**: 불필요한 애니메이션 (glow, shimmer, bounce-in)
- [ ] ✅ **유지**: fade-in, slide-up만 유지
- [ ] ✅ **수정**: Primary 색상 팔레트 단순화

#### 구체적 코드 변경
```ts
// 제거할 것
- 'bounce-in' keyframes (line 70-74)
- 'shimmer' keyframes (line 79-82)
- 'glow' keyframes (line 87-90)
- animation 관련 (line 94, 96, 98)

// Primary 색상 단순화 (기본 HSL로 통일)
primary: {
  DEFAULT: 'hsl(var(--primary))',
  foreground: 'hsl(var(--primary-foreground))',
  // 50~900 제거 (사용 안 함)
}
```

### 1.3 다크모드 기본값 변경

#### 수정 사항
- [ ] `src/components/providers.tsx` - defaultTheme="dark"
- [ ] localStorage 기본값 체크

---

## 🎨 Phase 2: 공통 컴포넌트 (High)

### 2.1 `src/components/ui/button.tsx`

#### 현재 문제점
- ✅ 깔끔함 (큰 수정 불필요)
- ⚠️ Primary 색상이 `bg-primary-500` 직접 참조 → HSL 변수로 통일

#### 수정 사항
```tsx
// 변경 전
default: 'bg-primary-500 text-white hover:bg-primary-600'

// 변경 후
default: 'bg-primary text-primary-foreground hover:bg-primary/90'
```

- [ ] variant="default" → `bg-primary`로 변경
- [ ] hover 효과는 유지 (opacity 90%)

### 2.2 `src/components/ui/card.tsx`

#### 현재 문제점
- ✅ 대체로 깔끔함
- ⚠️ 그림자가 약간 강함
- ⚠️ border opacity가 불일치 (60% vs 40%)

#### 수정 사항
```tsx
// 변경 전
'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.04)]'

// 변경 후
'shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]'  // 더 subtle

// Border opacity 통일
'border border-border/50'  // 60/40 → 50으로 통일
```

- [ ] 그림자 더 연하게
- [ ] border opacity 통일 (50%)

### 2.3 `src/components/ui/input.tsx`

#### 수정 사항
```tsx
// focus ring을 더 subtle하게
'focus-visible:ring-2 focus-visible:ring-primary/50'  // 색상 투명도 추가
```

- [ ] focus-visible:ring-primary → ring-primary/50

### 2.4 `src/components/ui/badge.tsx`

- [ ] 읽고 평가 필요 (아직 확인 안 함)

### 2.5 `src/components/ui/dialog.tsx`

- [ ] 모달 패딩 `py-6 px-6` 일관성 체크

### 2.6 기타 UI 컴포넌트

| 컴포넌트 | 체크 항목 |
|----------|-----------|
| select.tsx | ✅ border, shadow 일관성 |
| textarea.tsx | ✅ input과 동일한 스타일 |
| checkbox.tsx | ✅ primary 색상 일관성 |
| switch.tsx | ✅ primary 색상 일관성 |
| dropdown-menu.tsx | ✅ border, shadow 일관성 |
| tabs.tsx | ✅ active 색상 일관성 |

---

## 📄 Phase 3: 페이지별 수정 (Medium)

### 3.1 `src/app/page.tsx` (대시보드)

#### 현재 문제점
- ⚠️ `StatsCard` 컴포넌트에서 glow 효과 사용
- ⚠️ gradient 색상 과다 사용
- ⚠️ "오늘의 할 일" 카드들이 컬러풀함 (from-red-50 to-orange-50)

#### 수정 사항
- [ ] `StatsCard`에서 glow 효과 제거
- [ ] "오늘의 할 일" 카드들 색상 단순화
  - ❌ `bg-gradient-to-r from-red-50 to-orange-50`
  - ✅ `bg-red-50/50 dark:bg-red-950/30` (단일 색상)
- [ ] 아이콘 배경도 gradient 제거
  - ❌ `bg-gradient-to-br from-red-500 to-orange-500`
  - ✅ `bg-red-500`

### 3.2 `src/components/dashboard/stats-card.tsx`

#### 현재 문제점
- ⚠️ hover시 glow 효과 (line 68)
- ⚠️ 상단 컬러 바 gradient (line 72)
- ⚠️ group-hover:scale-110 (과함)

#### 수정 사항
```tsx
// 제거
- {accent.glow} (line 68)
- accent.bar gradient → 단일 색상
- group-hover:scale-110 → scale-105 (미세하게)

// 유지
- hover:-translate-y-1 (좋음)
- iconBg, iconColor (좋음)
```

- [ ] glow 효과 제거
- [ ] gradient → 단일 색상
- [ ] scale 효과 줄이기 (110 → 105)

### 3.3 `src/components/layout/sidebar.tsx`

#### 현재 문제점
- ✅ 대체로 깔끔함
- ⚠️ 알림 버튼 색상 (green-100)이 과함
- ⚠️ P-EAK 바로가기 버튼이 gradient

#### 수정 사항
```tsx
// 알림 버튼 (line 336-338)
// 변경 전: bg-green-100 dark:bg-green-900/30
// 변경 후: bg-green-500/10 dark:bg-green-500/20

// P-EAK 버튼 (line 522)
// 변경 전: bg-gradient-to-r from-orange-500/10 to-amber-500/10
// 변경 후: bg-orange-500/10 border-orange-500/30
```

- [ ] 알림 버튼 색상 연하게
- [ ] P-EAK 버튼 gradient 제거

### 3.4 주요 페이지별 체크리스트

| 페이지 | 파일 경로 | 주요 체크 항목 |
|--------|-----------|----------------|
| **학생 목록** | `src/app/students/page.tsx` | 테이블, 필터, 검색 일관성 |
| **학생 상세** | `src/app/students/[id]/page.tsx` | 탭, 카드 레이아웃 |
| **강사 목록** | `src/app/instructors/page.tsx` | StatsCard, 필터 |
| **수업스케줄** | `src/app/schedules/page.tsx` | 캘린더, 카드 |
| **학원비** | `src/app/payments/page.tsx` | 테이블, 필터 |
| **급여** | `src/app/salaries/page.tsx` | 리스트, 계산기 |
| **상담** | `src/app/consultations/page.tsx` | 탭, 배지 |
| **설정** | `src/app/settings/page.tsx` | Form, Switch |

#### 공통 체크 항목 (모든 페이지)
- [ ] 페이지 제목: `text-3xl font-bold tracking-tight`
- [ ] 섹션 간격: `space-y-8`
- [ ] 카드 패딩: `p-6`
- [ ] 버튼 간격: `gap-4`
- [ ] 여백 충분한지 확인

---

## 🔄 Phase 4: 복잡한 컴포넌트 (Medium)

### 4.1 `src/components/students/*`

| 컴포넌트 | 주요 체크 |
|----------|-----------|
| student-card.tsx | 카드 스타일 일관성 |
| student-form.tsx | Input, Select 일관성 |
| student-filters.tsx | 필터 버튼 스타일 |
| student-list-table.tsx | 테이블 행 간격, 폰트 크기 |
| student-stats-cards.tsx | StatsCard와 동일하게 수정 |

### 4.2 `src/components/schedules/*`

| 컴포넌트 | 주요 체크 |
|----------|-----------|
| schedule-calendar.tsx | 날짜 셀 스타일 |
| schedule-card.tsx | 카드 스타일 일관성 |
| schedule-form.tsx | Input, Select 일관성 |
| attendance-checker.tsx | 체크박스 스타일 |

### 4.3 `src/components/payments/*`

| 컴포넌트 | 주요 체크 |
|----------|-----------|
| payment-card.tsx | 카드 스타일 일관성 |
| payment-form.tsx | Input, Select 일관성 |
| payment-list.tsx | 테이블/리스트 일관성 |

---

## ✅ 우선순위 요약

### 즉시 (Critical) - 1-2일
1. **globals.css** - glass, glow, gradient 제거
2. **tailwind.config.ts** - 애니메이션 정리
3. **button.tsx, card.tsx** - primary 색상 통일
4. **다크모드 기본값 변경** - providers.tsx

### 단기 (High) - 3-5일
1. **stats-card.tsx** - glow, gradient 제거
2. **dashboard/page.tsx** - 색상 단순화
3. **sidebar.tsx** - 버튼 색상 정리
4. **input, select, textarea** - focus ring 일관성

### 중기 (Medium) - 1-2주
1. **학생 관련 페이지** - 레이아웃, 타이포 통일
2. **스케줄 관련 페이지** - 캘린더, 카드 스타일
3. **재무 관련 페이지** - 테이블, 폼 일관성
4. **상담 관련 페이지** - 탭, 배지 스타일

---

## 🎯 성공 지표

### Before → After

| 항목 | 현재 (Before) | 목표 (After) |
|------|---------------|--------------|
| **색상 수** | 7-10가지 | 3-4가지 |
| **그림자 강도** | 중간 | Subtle (거의 안 보임) |
| **그라데이션** | 많음 | 최소 (CTA만) |
| **여백** | 부족 | 충분 (24px+) |
| **타이포** | 불일치 | 통일 (14px 기본) |
| **다크모드** | Light 기본 | Dark 기본 |
| **애니메이션** | 과함 | Subtle (hover만) |

### 테스트 체크리스트
- [ ] 다크모드에서 모든 텍스트 읽힘
- [ ] 라이트모드에서도 괜찮음
- [ ] 한 화면에 3가지 색 이하
- [ ] 모달 패딩 일관성 (24px)
- [ ] 버튼 크기 일관성 (h-10)
- [ ] 폰트 크기 일관성 (14px 기본)

---

## 📝 작업 노트

### 민지의 체크포인트
1. ...여백이 충분한가? (24px 이상)
2. ...색이 3가지 이하인가?
3. ...타이포그래피가 일관적인가?
4. ...불필요한 효과는 없는가?

### 예상 소요 시간
- **Phase 1**: 2-3시간
- **Phase 2**: 3-4시간
- **Phase 3**: 5-8시간
- **Phase 4**: 8-12시간
- **총**: 18-27시간 (3-5일)

---

**작성자**: 민지 (Designer-Minimal)
**최종 업데이트**: 2026-01-11
