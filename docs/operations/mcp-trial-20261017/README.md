# PACA MCP 체험 등록·일정 변경

2026-10-17. 운영 MCP 백엔드와 해시가 일치하는 `96c20ca` 기준의 `codex/paca-mcp-trial`.
최근 main의 원서·휴원 복귀 작업과 별개인 운영 MCP 분기를 기준으로, 아래 파일만 배포한다.

## 계약

기존 미등록관리 학생을 체험으로 등록한다. 학생을 새로 생성하지 않아 기존 학생 ID·상담 연결을 유지한다.

- `trial_register`: `resource_id`는 기존 pending/prospect 학생 ID. `changes.trial_dates`에 `{date,time_slot}` 1~50건.
- `trial_schedule_add`: `resource_id`는 학생 ID. `changes.date`, `changes.time_slot`.
- `trial_schedule_update`: `resource_id`는 학생 ID. `previous_date`, `previous_time_slot`, `date`, `time_slot`.
- 시간대: morning/afternoon/evening. 날짜는 KST. 실제 시간 표시는 해당 교육원 academy_settings를 조회한다.
- `trial_students`에 `student_id` 필터 추가. 이력 없는 미등록 학생은 기존 `student_search`/`read_resource students`로 찾는다.

모든 변경은 `preview_change` → 원장에게 before/after 및 related 출결 영향 표시 → 명시적 확인 → `confirm_change` 순서다.
지점 입력을 받지 않고 기존 위임 계정의 academy_id를 적용한다. 다른 지점·삭제 학생은 조회/변경하지 못한다.
미리보기는 쓰기 0건. 확인은 학생 상태·일정·출결 배정·멱등 원장을 한 트랜잭션에서 적용한다.
출결 기록된 일정·지난 일정 이동, 중복·휴강·휴일·잘못된 날짜, 기존 불완전 일정은 거부한다.
기존 출석/과거 이력은 보존하며 재등록 시 앞으로의 미체크 예약만 새 일정으로 교체한다.
청구·수납·문자·PEAK 데이터는 변경하지 않는다. 원본이나 KST 날짜가 바뀌면 새 미리보기를 요구한다.

## 검증

- MCP OAuth + 실제 PACA HTTP + 격리 MySQL 통합: 등록·추가·이동·조회, 미리보기 무반영, 동일 확인 재시도.
- MySQL HTTP: 지점·삭제·임의 상태 입력 차단, 출결 완료 이동 차단, 원본 충돌, 트랜잭션 롤백, 동시 확인 1회 반영.
- `test-results/mcp-trial/final-feature-tests.log`: 새 단위 4건 + 통합 6건.
- 기존 전체 Jest: 169 suites / 1,384 tests 통과, 130개 opt-in 통합 skip(별도 새 통합 6건 실행).
  첫 실행의 무관한 2건 실패는 개별 재시도와 최종 전체 실행에서 모두 통과했다.
- lint 오류 0, 기존 경고 86; TypeScript 및 production build 통과. 배포 scope gate 100/100.
- MCP 테스트 12건 통과. 서버 배포와 ChatGPT 검수 기록은 MCP 허브의 `docs/operations/paca-trial-20261017/`에서 관리한다.

재현:

```sh
RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<전용 격리 포트> \
PACA_MCP_TEST_ROOT=/Users/etlab/projects/mcp/max-business-mcp \
NODE_OPTIONS=--experimental-vm-modules npm run test:ci --prefix backend -- --runInBand \
  __tests__/integration/max-engine-trial-mysql.test.js __tests__/services/maxEngineTrialCommands.test.js
```

## 배포 범위

기존 4개: constants/maxEngineCommands.js, constants/maxEngineWorkflows.js,
services/maxEngineFullCommands.js, services/maxEngineWorkflowStudents.js.
신규 3개: constants/maxEngineTrialCommands.js, repositories/maxEngineTrialRepository.js,
services/maxEngineTrialCommands.js. 모두 backend/ 하위.
DB migration, 환경 변경, 프런트엔드 배포 없음. backend 패키지 4.0.26 유지, 코드 commit/manifest로 식별.
운영 파일 baseline SHA-256을 재확인하고 백업 후 7개 파일만 교체, paca-failover만 재시작한다.
MCP는 공용 릴리스 0.5.4를 배포하므로 paca-mcp와 peak-mcp가 함께 재시작된다. PEAK 도구 범위는 그대로다.
