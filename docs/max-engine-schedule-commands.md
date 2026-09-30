# 학원관리 MCP 일정 수정 — 2026-09-30

수업·행사·강사 근무·상담 예약의 **기존 일정 한 건**을 `preview` → 원장 확인 → `confirm`으로 수정한다. 학생·출결·수납과 같은 원장 위임 인증, 교육원 범위, 10분 미리보기, 원본 변경 검사, 멱등 확인·감사 트랜잭션을 사용한다. 등록·삭제나 목록 전체 교체는 추가하지 않는다.

| operation | resource_id | 허용 changes |
|---|---|---|
| `class_schedule_update` | `class_schedules.id` | `class_date`, `time_slot`, `instructor_id`, `title`, `content`, `notes` |
| `academy_event_update` | `academy_events.id` | `title`, `description`, `event_type`, `event_date`, `start_time`, `end_time`, `is_all_day`, `is_holiday`, `block_consultation`, `color` |
| `instructor_schedule_update` | `instructor_schedules.id` | `work_date`, `time_slot`, `scheduled_start_time`, `scheduled_end_time` |
| `consultation_reschedule` | `consultations.id` | `preferred_date`, `preferred_time` |

날짜는 실제 달력의 `YYYY-MM-DD`, 시간은 `HH:MM`, 시간대는 `morning`/`afternoon`/`evening`, 선택 항목은 JSON boolean이다. 강사 근무 시간은 두 값을 함께 비우거나 시작 < 종료여야 한다. 부분 시간 수정도 기존 반대쪽 시간과 대조한다. 다른 필드나 빈 changes는 거부한다. 강사 일정의 강사 자체는 바꾸지 않는다.

## 연관 자료와 충돌 처리

- 수업 이동: 같은 날짜·시간대의 수업, 휴강/휴일, 학생 출결/알림 이력, 체험·보강 예약을 검사한다. 연결된 강사 출근 기록이 있으면 날짜·시간·담당 강사를 바꾸지 않는다. 기록을 먼저 정리하도록 구체적인 오류를 반환한다. 제목·수업 내용·메모 수정은 유지한다.
- 강사 근무: 같은 강사의 날짜·시간대 중복, 기존/새 시간대의 실제 출근 기록을 검사한다. 다른 근무 행과 출퇴근·급여 기록을 건드리지 않는다.
- 상담: 대기/확정 예약만 이동하며 연결 학생도 현재 교육원 소속이어야 한다. 종일/시간대/구간 차단과 기존 `max_reservations_per_slot`을 검사한다. 상담 기록의 작성일, 예약 상태·메모·알림 발송 상태는 보존한다. 관리자 일정 수정이므로 공개 예약의 사전 신청 시간 제한은 적용하지 않는다.
- 행사: 기존 `academyEventService`를 같은 트랜잭션에서 호출한다. 소유한 상담 차단을 새 날짜로 이동하고, 기존 휴강을 해제한 뒤 새 날짜 수업을 휴강한다. 다른 행사/수동 차단과 별도 휴강의 소유권을 덮어쓰지 않는다. 이미 잡힌 상담 예약은 이동/취소하지 않으며 새 차단과 겹치는 예약 id·시간을 미리보기에 표시한다.
- `before.related` / `after.related`의 수업 휴강 및 상담 차단 변경도 반드시 원장에게 함께 보여준다. 관련 행이 미리보기 이후 달라졌으면 확인을 거부하고 새 미리보기를 요청한다.
- 모든 쓰기와 확인 영수증은 원자적으로 저장한다. 중간 실패는 전체 롤백하며, 응답 유실은 같은 미리보기 id로 재시도한다. 문자/알림톡을 발송하거나 출결 알림을 큐에 넣지 않는다.

PACA와 PEAK의 기존 공통 위임 catalog에 함께 노출하되 원본은 PACA다. PEAK catalog의 `paca_` 리소스 접두사는 기존 규칙을 따른다.

## 검증과 배포 범위

- 소스 기준: `a0804cf`(기존 MAX Engine 원장 위임 통합). 운영의 변경 대상 기존 파일 및 행사 서비스 의존 파일 SHA-256이 이 기준과 일치함을 읽기 전용으로 확인했다.
- 검증 완료: backend 1,226개 통과(별도 fixture를 요구하는 기존 무관 테스트 12개 제외), 일정 기능 검사는 모두 실행. MCP 11개·FastAPI 8개·SDK 실제 왕복 1개 통과. lint 오류 0(기존 경고 83), TypeScript, production build, 행사 PC/모바일 브라우저 smoke 통과. hotfix scope 100/100 및 gate 단위 22개 통과. 합성 데이터만 사용했다.
- MySQL 테스트는 `RUN_MAX_ENGINE_MYSQL=1`, 별도 `TEST_MYSQL_PORT >= 10000` 필수. 테스트는 해당 격리 인스턴스의 `max_engine_eff_test_*`/`max_engine_full_test_*` 테이블을 재생성하므로 운영·공유 개발 DB에 실행하면 안 된다.
- 운영 반영 파일: `constants/academyEvents.js`, `constants/maxEngineCommands.js`, `constants/maxEngineScheduleCommands.js`, `repositories/academyEventRepository.js`, `repositories/maxEngineScheduleRepository.js`, `services/academyEventService.js`, `services/maxEngineFullCommands.js`, `services/maxEngineScheduleCommands.js`, `services/maxEngineScheduleValidation.js`, `services/maxEngineEventCommand.js`(모두 `backend/` 아래).
- MCP 측은 MAX Engine 저장소의 `mcp/shared/tools.js`, `mcp/shared/client.js`, `mcp/shared/constants/commands.js`가 짝이다. 원본 PACA를 먼저 반영한 뒤 MCP를 반영한다.
- DB 변경·migration·환경변수·의존성 변경 없음. 현재 운영 로그인은 이 체크아웃보다 새 위임 기간을 지원하므로 `routes/integrations/full.js`, 인증 서비스, `paca.js`, `.env`를 덮어쓰지 않는다.
- 2026-09-30 사용자 명시 승인 후 운영 반영 완료: 이 문서의 native 10파일과 MCP 3파일만 적용했다. `paca-failover`, `paca-mcp`, `peak-mcp` 재시작 후 public health 200, CORS, OAuth PKCE S256, 무인증 MCP 401, 연결 계정의 새 일정 작업 4개 노출을 확인했다. PACA 프로세스 1개, 변경 파일 체크섬 13/13 일치.
- 백업 `/root/backups/paca-mcp-schedule-20260930-909ff643`, 소스 태그 `rollback/paca-mcp-schedule-20260930`, MCP 이전 릴리스 `13727bfd` 보존. 새 MCP 릴리스 `schedule-20260930-909ff643`.
- 실제 일정 데이터 변경·DB migration·환경변수·로그인 파일 변경 없음. 별도 MAX Engine API/프론트엔드는 이번 배포 대상에 포함하지 않았다.
