# pacapro BUSINESS-LOGIC

## 핵심 도메인
체대입시 학원 운영 SaaS. 학원 = tenant, 학생 = 고객.

## Multi-tenant 규칙
- 모든 요청은 `academy_id` 컨텍스트로 격리
- JWT payload 에 `academy_id` 포함 → 미들웨어에서 추출
- DB 쿼리 WHERE 절에 반드시 `academy_id = ?` 필터

## 역할 (role)
- `owner` — 학원 원장 (전체 권한)
- `instructor` — 강사 (자기 반만)
- `staff` — 사무직
- `parent` — 학부모 (자기 자녀만)
- `student` — 학생 (추정, 확인 필요)

## 결제
- **Toss Payments** 연동 (`TOSS_ACCESS_KEY` env)
- 구독형 / 단건 결제 (플랜별)
- 결제 실패 시 학부모 알림 (N8N 알림톡)

## 상담 예약
- 강사별 `consultation_weekly_hours` 로 가용 시간 설정
- `consultation_blocked_slots` 로 차단 슬롯
- 학부모가 예약 → `consultations` 테이블에 기록
- 겹침 체크: 동일 instructor_id + 시간대 겹치면 거부

## 출결
- 등원/하원 체크 → `attendance` 테이블
- 학부모에게 알림톡 발송 (N8N 웹훅)
- 월별 출석률 통계

## 알림 파이프라인
앱 → N8N 웹훅 (`N8N_API_KEY` 인증) → 알림톡/SMS/이메일

## 데이터 암호화 (Phase 1)
- 민감 필드 (주소, 전화 등) `DATA_ENCRYPTION_KEY` 로 AES 암호화
- 암호화 키는 peak 과 동일 — **회전 시 두 서버 동시 재시작 필수**

## 웹푸시
- VAPID 키 쌍 존재 (`.env` VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
- `push_subscriptions` 테이블에 구독 저장
- 서버에서 push 호출

## 페일오버 동작 시 주의
- 페일오버 중에는 **vultr 에서 DML 발생** → n100 복구 후 데이터 분기 위험
- 복구 시 vultr → n100 역동기화 필요 (스크립트 확인 필요)
- **장기 페일오버 (1시간+) 면 sync 방향 주의**

## 자주 틀리는 함정
- `academy_id` 필터 누락 → 다른 학원 데이터 노출 (치명적)
- 출결 체크 때 시간대 혼동 (KST vs UTC) — DB 는 DATETIME KST 기록
- NocoDB 가 같은 DB 에 있어서 DDL 자제 (nc_* 빼면 대부분 pacapro 소유)
