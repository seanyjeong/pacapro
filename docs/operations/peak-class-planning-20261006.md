# GPT PEAK 수업 준비·운동 항목 편집 — 2026-10-06

수업계획을 설명문에만 쓰지 않고 운동관리 항목의 실제 id·순서·횟수·무게/개수·메모를 저장한다. 기존 운동 추가·실기 기록 입력은 이미 운영0.3.0에 있으므로 새 구현이라고 보고하지 않는다. 새 기능은 빈 반의 선생님/선택 학생 배정과 구조화된 계획의 원자 적용, 운동 등록, 지정 운동의 추가/부분 수정/순서 변경/제거, 실제 후보를 한 번에 읽는 수업 준비 조회다. 선생님 근무 일정이 없으면 먼저 명시한 날짜·시각으로 PACA 근무 일정만 확인 등록한다. 이후 수업 준비를 다시 읽어 반과 계획을 별도로 미리본다.

MCP 후보0.4.0: PEAK18/PACA27 도구, 조회72종·확인 변경30종. `teaching_context`, `preview_class_setup`, `preview_instructor_assignment`, `preview_lesson_plan`, `preview_plan_exercises`, `preview_exercise_create`, `preview_instructor_work_schedule`, `preview_student_record`를 제공한다. 실기 측정은 기존 한 건별 등록을 사용하는 전용 도구이며 여러 학생 일괄 등록 또는 월말테스트 기록 쓰기가 아니다.

교육원/현재 학생 소속·재직 강사·원장 확인, 실제 PACA 근무 일정, 휴강/휴일, 결석, 이미 배치된 학생, 겹치는 강사 배치를 검사한다. 주강사와 보조강사는 중복될 수 없다. 기존 반·계획을 통째로 바꾸지 않으며 학생 배정은 선택한 기존 PEAK daily_assignment만 이동한다. 미리보기 후 확인할 때 academy lock/원본 해시/행 잠금으로 재검증하고 선생님·선택 학생·계획·audit ledger를 함께 적용한다. 일반 강사 근무 등록은 PACA 연결에서 처리하며 PEAK backend에서 PACA DB에 쓰지 않는다.

기존 계획의 설명/태그/추가운동/환경 체크와 다른 운동·완료 이력은 보존한다. 운동 제거는 지정한 항목의 완료 표시/시간만 정리한다. 배열을 전체 교체하는 입력은 금지한다. 운동 이름·기본 세트/횟수는 실제 운동관리 자료에서 가져오며 임의 id나 운동 이름을 저장하지 않는다. PC 기존 화면의 운동 항목 순서·개수·weight/reps/note 형식과 일치한다. 세트는 구조화 값으로 보관하며 현재 PC 화면에서 안내할 세트·휴식은 운동 note에 짧게 넣을 수 있다. 프론트 소스 변경 없음.

검증: backend 전체 Node22 1,273건 통과(옵트인78건 별도), Node18/격리 MySQL8.4 관련69건 통과, MCP 실제 OAuth/프로토콜18건, PEAK gateway HTTP7건 통과. 신규 핵심 코드 statements92.59%, branches81.96%, lines98.84%. lint 오류0·기존 경고86. 시험 process에서 ephemeral HTTP fixture의 keepalive를 끄고 전체 검사했으며 운영 HTTP 설정은 변경하지 않았다. 초기 합성 fixture의 활성 상태 누락/남은 command ledger와 단위 시험 DB mock 누락을 수정했다. 운영 DB·실학생 확인은0회다.

실제 MCP→PEAK gateway→PACA HTTP→격리 MySQL 연결 시험에서 근무 등록, 운동2종 등록, 반/학생/계획 저장, 운동 순서 변경, 해당 날짜 실기값 입력과 동일 확인 재시도를 검증했다. 모두 합성 자료6건 확인이며 운영 행을 바꾼 것이 아니다. MCP 단독 모의 upstream 시험만으로 전체 연결 성공을 주장하지 않는다. PEAK gateway의 workflow 허용 목록에도 teaching_context가 필요해 실제 라우트를 함께 보완했다.

운영 반영 절차: 현재 26개 대상 원본 해시/신규 파일 부재 확인 → 제한 권한 서버 백업(양 backend, paca/peak consistent dump, MCP 릴리스/포인터, OAuth online backup, env) → 교체 직전 동일 해시 재확인 → PACA17파일·PEAK1파일 교체 → 기존 MCP 릴리스/의존성을 복사한 새0.4.0 릴리스에 MCP8파일만 적용 → PACA·PEAK backend와 양 MCP 재시작 → 공개 health/인증 catalog/도구 목록 확인. 스키마 migration, env/key/의존성 변경 또는 실학생 confirm은 없다.

되돌리기 기준은 각 저장소의 `rollback/peak-mcp-class-planning-20261006` 태그와 서버 backup manifest다. 후보 runtime 파일만 복원하고 신규 경로는 제거하며 이전 MCP 포인터로 되돌려 네 서비스만 재시작한다. 실제 업무·OAuth 자료를 덤프로 덮어쓰지 않는다. 실제 운영 결과는 검증 JSON과 이 문서에 추가한다.

## 실제 운영 반영

2026-10-06 **20:25:10 KST** MCP0.4.0 운영 반영·검증 완료. PACA17/PEAK1/MCP8파일만 적용, 네 서비스 재시작 및 공개 health200 확인. 백업 `/root/backups/peak-mcp-class-planning-20261006T112456Z`, 새 릴리스 `/opt/max-business-mcp/releases/teaching-20261006-6e73b9fe`, 이전 릴리스 `settlement-20261004-e4c2adf5`. 세 저장소 브랜치와 rollback 태그 푸시 완료. env·키·의존성 그대로, schema migration0, 운영 실학생/선생 confirm0회.

기존 GPT 실기관리 연결에서 실제 인증 catalog72/30 및 teaching_context/신규 작업5종 응답을 확인했다. 학원관리 연결은 connector의 link_id 인자 요구 때문에 별도 검증하지 않았으며 성공으로 보고하지 않는다. 양 MCP 서버 health0.4.0과 합성 OAuth/프로토콜 시험은 통과했다. 사진의 실제 원장 계획/학생/선생 배정은 이번 배포에서 변경하지 않았다. GPT 도구 목록이 예전 상태이면 연결의 도구 목록을 갱신해야 신규 전용 도구가 보인다.

현재 원본26개 해시와 신규 경로 부재를 백업 전·교체 직전 두 번 확인했고 최종 설치26개 해시도 후보와 일치한다. backup tar/gzip/SHA-256 및 양 OAuth online snapshot integrity 검증 통과. 반영 후보: PACA90b878e, PEAK3bfd719, MCP6e73b9fe. 프론트 소스는 바꾸지 않아 PACA4.0.57/PEAK5.9.6을 별도 재배포하지 않았다.
