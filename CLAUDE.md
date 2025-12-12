# CLAUDE.md - P-ACA 개발 가이드

## 프로젝트 개요

P-ACA(Papa Academy) - 체대입시 학원관리시스템
- **프론트**: Next.js 15 + TailwindCSS (Vercel: pacapro.vercel.app)
- **백엔드**: Express.js + MySQL (로컬: chejump.com:8320)

## 배포

### 프론트엔드 (Vercel)
```bash
git add . && git commit -m "메시지" && git push  # 자동 배포
```

### 백엔드 (로컬 서버)
```bash
# Git 불필요! 코드 수정 후 재시작만
echo 'q141171616!' | sudo -S systemctl restart paca
sudo journalctl -u paca -f  # 로그
```

### DB
```bash
mysql -u paca -pq141171616! paca
```

---

## 🚨 버전 업데이트 필수! (배포 시 4곳 수정)

```
1. package.json                        → "version": "x.x.x"
2. src/components/version-checker.tsx  → APP_VERSION = 'x.x.x'
3. src/components/layout/sidebar.tsx   → P-ACA vx.x.x + 날짜
4. src/app/settings/page.tsx           → vx.x.x + 날짜
```

**버전 안 올리면 브라우저에 새 버전 적용 안 됨!**

---

## 주의사항

### 기존 코드 수정 금지
```
✅ 허용: 새 파일 생성, 새 라우트 추가, 새 컬럼 추가
❌ 금지: 기존 API 수정, 기존 컴포넌트 변경, 컬럼 삭제
```

### 학생 상태 (status)
| 상태 | 스케줄 | 학원비 | 진급 |
|------|--------|--------|------|
| active | O | O | O |
| paused | X | X | O |
| withdrawn | X | X | X |
| graduated | X | X | X |
| trial | O | X | X |

### time_slot 변환
DB는 영어(`morning/afternoon/evening`), 프론트는 한글(`오전/오후/저녁`)

### Dialog 패딩
모달 본문에 `py-6 px-6` 필수

---

## 보안 (Phase 1 완료)

민감정보 AES-256-GCM 암호화:
- students: name, phone, parent_phone, address
- instructors: name, phone, address, resident_number, account_number, account_holder
- users: name, phone

상세: `docs/SECURITY-ENCRYPTION.md`

---

## 주요 파일

| 기능 | 백엔드 | 프론트 |
|------|--------|--------|
| 학생 | routes/students.js | app/students/ |
| 강사 | routes/instructors.js | app/instructors/ |
| 학원비 | routes/payments.js | app/payments/ |
| 급여 | routes/salaries.js | app/salaries/ |
| 스케줄 | routes/schedules.js | app/schedules/ |
| 시즌 | routes/seasons.js | app/seasons/ |
| 상담 | routes/consultations.js | app/consultations/ |
| 암호화 | utils/encryption.js | - |

---

## 자동화 (스케줄러)

### n8n 워크플로우
| 워크플로우 | 트리거 | 설명 |
|------------|--------|------|
| P-ACA 학생 동기화 | 매일 9시 | Google Sheets 동기화 |
| p-aca미납자알림 | 매일 9시 | 카카오톡 미납 알림 |
| P-ACA 솔라피 자동발송 | 매시간 | 솔라피 알림톡 (설정 시간에 발송) |
| PACA Backend Auto Deploy | GitHub push | 백엔드 자동 배포 |

### 백엔드 스케줄러 (node-cron)
| 파일 | 트리거 | 설명 |
|------|--------|------|
| paymentScheduler.js | 매월 1일 | 월별 학원비 자동 생성 |
| notificationScheduler.js | 매시간 | SENS 알림톡 자동발송 |
| gradePromotionScheduler.js | 매년 3/1 01:00 | 학년 자동 진급 |

---

## 현재 버전: v2.9.16 (2025-12-12)

### 최근 변경
- **v2.9.16**: 강사출결 복호화, 학생검색 메모리필터링, 출결 사유 인라인UI, 체험생 회차 표시 수정
- **v2.9.15**: 결석/공결 사유 입력 UI, 공결 설명 추가
- **v2.9.14**: 비밀번호 찾기/재설정 기능
- **v2.9.13**: 모달 닫기 개선, 시스템 규정집
- **v2.9.12**: 배지 색상 다크모드
- **v2.9.0~11**: 다크모드 전체 적용
- **v2.8.x**: 급여 비밀번호 확인, 재계산
- **v2.7.x**: 시즌 환불, 할인 시스템
- **v2.6.0**: 모바일 PWA
- **v2.5.x**: 상담 예약 시스템
- **v2.0.0**: 알림톡 멀티 서비스 (SENS + 솔라피)

### 버전 규칙
- Major: 대규모 기능/아키텍처 변경
- Minor: 새 기능 추가
- Patch: 버그 수정, 작은 개선

---

## 문서

| 문서 | 설명 |
|------|------|
| docs/PACA-RULES.md | 학원 운영 규정집 |
| docs/SECURITY-ENCRYPTION.md | 암호화 설계 |
| docs/SERVER-MIGRATION.md | 서버 이전 가이드 |
| docs/EXCUSED-CREDIT-FEATURE.md | 공결 크레딧 자동화 (TODO: 사유 입력 UI) |
