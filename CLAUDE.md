# CLAUDE.md - P-ACA 빌드업

## 프로젝트 개요

**P-ACA** = **P**hysical **A**cademy **C**omprehensive **A**dministration
체대입시 학원 종합관리 시스템

### 자매 시스템
| 시스템 | 발음 | 풀네임 | 역할 |
|--------|------|--------|------|
| **P-ACA** | 파카 | Physical Academy Comprehensive Administration | 학원 종합관리 |
| **P-EAK** | 피크 | Physical Excellence Achievement Keeper | 실기 훈련관리 |

> "파카로 학원 관리, 피크로 기록 정점!"

---

## 기술 스택

- **프론트**: Next.js 15 (App Router) + TailwindCSS + shadcn/ui
- **백엔드**: Express.js + MySQL
- **배포**: Vercel (프론트) + 로컬 서버 (백엔드)
- **URL**: pacapro.vercel.app / chejump.com:8320

---

## 문서 목록

| 문서 | 설명 |
|------|------|
| **[DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md)** | DB 스키마 전체 명세 (46개 테이블) |
| **[API-ROUTES.md](docs/API-ROUTES.md)** | API 엔드포인트 전체 명세 (200+ 엔드포인트) |
| [PACA-RULES.md](docs/PACA-RULES.md) | 학원 운영 규정집 |
| [CONSULTATION-ALIMTALK.md](docs/CONSULTATION-ALIMTALK.md) | 상담 알림톡 설정 가이드 |
| [SERVER-MIGRATION.md](docs/SERVER-MIGRATION.md) | 서버 이전 가이드 |
| [SECURITY-ENCRYPTION.md](docs/SECURITY-ENCRYPTION.md) | AES-256-GCM 암호화 설계 |
| [EXCUSED-CREDIT-FEATURE.md](docs/EXCUSED-CREDIT-FEATURE.md) | 공결 크레딧 자동화 |
| [시즌전환로직분석.md](docs/시즌전환로직분석.md) | 시즌 전환 로직 분석 |

---

## 배포

### 프론트엔드 (Vercel)
```bash
git add . && git commit -m "메시지" && git push  # 자동 배포
```

### 백엔드 (로컬 서버)
```bash
# 재시작
echo 'q141171616!' | sudo -S systemctl restart paca

# 로그 확인
echo 'q141171616!' | sudo -S journalctl -u paca -f
```

### 개발 서버
```bash
npm run dev -- -H 0.0.0.0
# 접속: https://dev.sean8320.dedyn.io
```

**테스트 계정:** `admin@paca.com` / `0000`

---

## 버전 업데이트 (배포 시 4곳 수정)

```
1. package.json                        → "version": "x.x.x"
2. src/components/version-checker.tsx  → APP_VERSION = 'x.x.x'
3. src/components/layout/sidebar.tsx   → P-ACA vx.x.x + 날짜
4. src/app/settings/page.tsx           → vx.x.x + 날짜
```

**태블릿 버전 별도 관리:**
```
5. src/app/tablet/layout.tsx           → APP_VERSION = 'vx.x.x'
6. src/app/tablet/settings/page.tsx    → P-ACA Tablet vx.x.x
```

---

## 핵심 규칙

### 학생 상태 (status)
| 상태 | 스케줄 | 학원비 | 진급 |
|------|--------|--------|------|
| active | O | O | O |
| paused | X | X | O |
| withdrawn | X | X | X |
| graduated | X | X | X |
| trial | O | X | X |
| pending | X | X | X |

### time_slot 변환
DB: `morning/afternoon/evening` ↔ 프론트: `오전/오후/저녁`

### Dialog 패딩
모달 본문에 `py-6 px-6` 필수

### 암호화 필드
`name`, `phone`, `parent_phone`, `address` 등 민감정보는 AES-256-GCM 암호화
- SQL LIKE 검색 불가 → 메모리 필터링 필요

---

## 자동화 (스케줄러)

### n8n 워크플로우
| 워크플로우 | 트리거 | 설명 |
|------------|--------|------|
| P-ACA 솔라피 자동발송 | 매시간 | 납부안내/미납자 알림톡 |
| P-ACA 체험수업 자동발송 | 매시간 | 체험수업 알림톡 |
| P-ACA SENS 자동발송 | 매시간 | SENS 납부안내/미납자 알림톡 |
| P-ACA SENS 체험수업 자동발송 | 매시간 | SENS 체험수업 알림톡 |
| PACA Backend Auto Deploy | GitHub push | 백엔드 자동 배포 |

### 백엔드 스케줄러 (node-cron)
| 파일 | 트리거 | 설명 |
|------|--------|------|
| paymentScheduler.js | 매월 1일 | 월별 학원비 자동 생성 |
| gradePromotionScheduler.js | 매년 3/1 01:00 | 학년 자동 진급 |
| pushScheduler.js | 매일 18:00, 21:00 | PWA 푸시 알림 |

---

## 현재 버전: v3.1.16 (2026-01-02)

### 버전 규칙
- **Major (x.0.0)**: 대규모 시스템 변경
- **Minor (0.x.0)**: 새 기능 추가
- **Patch (0.0.x)**: 버그 수정, 자잘한 개선
