# 일산 입학원서 로직 검증 결과 — 2026-10-16

상태: **로컬 구현 및 검증 완료. 운영 배포, 운영 migration, 실제 학생 등록은 하지 않음.**
작업 브랜치: `codex/ilsan-admission`, 기준 `30f0ffb`.
작업 폴더: `/Users/etlab/worktrees/pacapro-ilsan-admission`.

## 구현

- 일산 교육원 고정 공개 접수, 6자리 생년월일 검증, 학생/양 부모 연락처 수집 및 암호화 저장.
- 공개 접수에는 UUID idempotency key를 적용. 같은 내용 재전송은 날짜가 지난 뒤에도 기존 접수 결과를 반환한다.
- 일산 학생 수정 권한 담당자만 원서를 읽고 승인/취소 가능. 타 교육원 403, 비로그인401, 교육원 식별 불일치503.
- 등록일·월 학원비·요일·시간대·할인율에 따른 서버 견적. 입력/원서 revision 변경 시 이전 견적 승인 차단.
- 등록일 전 학생/청구/배정 미생성. 당일 승인 또는 한국시간 예약 작업에서 한 transaction으로 생성.
- 등록 예약 변경/취소, 중복 학생 보류, 장애 시 rollback, 예정월이 지난 건 담당자 재확인 처리.
- 기본 담당자 화면 `/admissions` 및 일산 전용 메뉴 연결. 공개 `/admissions/ilsan`의 마크업·스타일은 사용자 분담 지시 이후 수정하지 않음.

## 검증

| 검증 | 결과 |
|---|---|
| 모델 단위 테스트 | 5/5 통과 (`backend-model-tests.log`) |
| 임시 MySQL 실제 HTTP/SQL 통합 테스트 | 9/9 통과 (`backend-native-tests.log`) |
| 담당자 브라우저 기능 시험 | 금액 확인 → 날짜 수정 → 재계산 → 예약 승인 → 취소 통과 (`staff-smoke.log`) |
| TypeScript | `tsc --noEmit --incremental false` 통과 |
| 변경 로직/담당자 페이지 ESLint | 오류·경고 0 |
| 격리된 프론트 production build | 성공; 기존 관련 없는 파일의 lint 경고만 존재 (`frontend-build.log`) |
| runtime 크기 / 공백 오류 | 변경 runtime 500줄 이내 / `git diff --check` 통과 |

실제 MySQL 시험은 매번 새로운 `paca-ilsan-test-*` 데이터 디렉터리와 임의 loopback 포트를 생성한다. DB 서버 경로 확인 후 합성 데이터만 만들고 종료/삭제한다. API 인증 middleware도 실제 사용하며 운영 환경 파일은 읽지 않는다. 프론트 브라우저 시험은 모든 외부 통신을 가로채 합성 응답을 사용한다. 운영 API로 요청을 보내지 않았다.

초기 같은 작업 폴더의 build는 별도 Opus `next dev`와 `.next`를 공유해 prerender 오류가 났다. 해당 dev를 종료하거나 변경하지 않고 별도 소스 사본으로 build를 분리하여 성공했다. 검증된 담당자 화면/API/hook/middleware 소스는 현재 작업 소스와 해시가 일치한다 (`source-sha256.json`). 공개 디자인 작업의 후속 변경 검증은 화면 담당 범위다.

브라우저 fixture는 서비스워커를 차단하므로 기존 PWA의 `waiting` 접근 오류가 한 건 발생한다. 프로젝트 기존 smoke 정책대로 그 오류만 서비스워커 관련 결과로 별도 기록했다. 업무 화면 예외나 기능 실패는 없었다. native HTTP 테스트의 내부 자동화 키 미설정 경고는 실제 JWT 사용자 인증 시험에서 사용하지 않는 자동화 계정에 대한 경고다.

## 재현

```sh
cd /Users/etlab/worktrees/pacapro-ilsan-admission/backend
node node_modules/jest/bin/jest.js --runInBand __tests__/models/ilsanAdmission.test.js
cd ..
python3 scripts/test-ilsan-admission-mysql.py
PACA_SMOKE_BASE_URL=http://127.0.0.1:3117 node scripts/smoke/ilsan-admission-review-smoke.mjs
```

마지막 명령은 로컬 프론트 서버가 준비된 경우에만 실행한다. 다른 `next dev`가 같은 `.next`를 사용 중이면 production build는 별도 소스 사본에서 수행한다. 실제 배포에는 최신 운영 소스/schema 비교, migration, 암호화 설정, 버전업, 화면 최종 확인이 필요하다. 세부 API/화면 연결 계약은 `docs/ilsan-admission-contract.md`.
