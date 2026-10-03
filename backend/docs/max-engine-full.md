# max-engine PACA·PEAK 업무 위임 API (D-117)

2026-09-27 KST. 기존 명단/기록 연동 위에 전체 업무 조회와 8개 확인 쓰기를 추가한다. 코드만 준비했으며 운영 배포·마이그레이션은 별도다.

## 경로와 권한

기본 경로 `/paca/integrations/max-engine/full`:

- `POST /token`: email/password로 승인된 활성 원장·관리자의 30일(2,592,000초) 위임 발급. `purpose=mcp`도 기존과 같은 30일이다.
- `GET /identity`: 현재 계정·교육원 재검증.
- `GET /{paca|peak}/catalog`: 원본 resource·필드·필터·쓰기 스키마.
- `GET /{paca|peak}/resources/{resource}?cursor=0&filters={"id":1}`: 내 교육원 원본 JSON 100개씩. `next_cursor`가 null까지 반복.
- `POST /{paca|peak}/preview`: operation/resource_id/changes. 원본 변경 없음.
- `POST /{paca|peak}/confirm`: preview_token/idempotency_key/confirm=true. 잠금·변경 전 값 확인 후 원자적 반영.

전용 `MAX_ENGINE_LINK_SECRET`만 사용한다. 기존 서비스 키·JWT_SECRET와 같으면 비활성화된다. 기존 read audience 토큰의 범위를 올리지 않는다. 매 요청에 사용자 승인/활성/역할/교육원/비밀번호 fingerprint를 검사한다. `nc_*`는 접근하지 않는다.

2026-10-01부터 일반 업무 위임도 30일이다. 이미 발급된 토큰의 만료 시각은 바뀌지 않으며, 재발급부터 적용된다. 계정 비활성·승인 취소·권한/교육원 변경·비밀번호 변경은 기존과 같이 다음 요청부터 무효화된다. 이 API에는 개별 토큰 폐기/로그아웃/연결 해제 경로와 폐기 원장이 없다. 클라이언트에서 연결만 해제해도 복사된 토큰은 만료 또는 위 계정 변경 전까지 유효할 수 있다. 기간 연장에 따른 이 위험을 운영 결과에 명시한다. 미리보기 10분·확인·멱등 원장·감사 로그는 그대로다.

## 데이터와 쓰기

PACA 38·PEAK 33 원본 resource + PEAK의 PACA id 검색용 8개 별칭을 제공한다. 반환 컬럼과 필터는 `constants/maxEngineReadCatalog.json`에서 고정한다. 비밀번호·인증/결제 키·주민번호·불투명 인증 JSON은 반환하지 않는다. PEAK 학생 캐시는 현재 PACA 소속을 재검사한다.

쓰기 명령은 `constants/maxEngineCommands.js`의 8개만 허용한다.

- 학생 기본 등록/수정: 이름·전화·학교·학년·부모·주소·메모. 기본 등록은 정식 재원생, 정시, 수강료 0, 요일 없음이며, 2026-09-30부터 최초 연동용 `registration_source=max_engine`은 예비생이다. 학번은 현재 KST 연도 기준이며 삭제 학생 번호를 재사용하지 않는다. 체험 전환·학적 상태·요일·수강료 수정·청구 생성은 제공하지 않는다.
- 재원생 상담 생성/메모 수정, 성적·실기·목표 대학 상담 기록 생성/부분 수정. 연결 상담 완료는 같은 트랜잭션이다.
- 기존 attendance 행 출결 정정: 기존 체험 잔여횟수/상태 서비스 사용. 문자 발송 없음.
- 기존 청구 납부: 누적 수납·부분납/완납·수입 장부를 같은 트랜잭션으로 기록. 환불·할인·취소·급여 지급·외부 결제는 제공하지 않는다.

PEAK 경로의 쓰기도 PACA 원본을 다룬다. PEAK students.id를 전달하지 말고 catalog의 `paca_*` 별칭에서 PACA id를 찾는다.

미리보기는 10분, 계정·교육원·제공자·입력·원본 hash와 묶인 암호화 영수증이다. confirm은 변경 전 hash 검사와 업무 변경·멱등 원장 기록을 한 트랜잭션에서 수행한다. 같은 확인 재시도는 같은 결과, 원본 변경은 409다. 로그는 id·명령·KST 시각만 남긴다. 요청 로거와 JSON 파싱 오류가 연동 원문을 기록하지 않도록 `paca.js`의 privacy middleware 변경도 같이 배포해야 한다.

## 설정과 검증

필수 환경 키 이름: `MAX_ENGINE_LINK_SECRET`, `DATA_ENCRYPTION_KEY`, 기존 `DB_*`, `PEAK_DB_*`. 실제 값은 문서/저장소에 넣지 않는다. `migrations/20260927_max_engine_commands.sql`을 PACA DB에 먼저 적용해야 한다. 런타임 DDL은 없다. 롤백은 새 mount를 이전 코드로 되돌리며 이미 반영된 업무·멱등 원장을 지우지 않는다.

전체 테스트: 141 suites / 1,192 passed, skip 없음. 신규 MySQL 11 + 단위 3 + 원문 오류 보호 1 통과. 실제 MySQL schema 컬럼을 복제한 합성 두 교육원으로 조회 격리, 79개 resource SQL, 재시도·동시 확인, 수납 rollback, 체험 lifecycle, 토큰 즉시 무효화를 검사했다. 운영 행은 사용하지 않는다.

```sh
# 테스트가 해당 접두어 표를 재생성한다. 운영·개발 인스턴스 사용 금지.
# 별도 loopback MySQL, root 무암호, 전용 port >=10000
# 기존 별도 통합용 빈 DB: maxai_operations_fixture, paca_parent_names_fixture
RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<isolated-port> MAXAI_NATIVE_MYSQL_SOCKET=<isolated-socket> PACA_PARENT_NAMES_MYSQL_SOCKET=<isolated-socket> npm run test:ci -- --runInBand
```

max-engine 저장소의 `docs/analysis/paca-peak-full/IMPLEMENTATION.md`, `ROUTES.md`, `ops/deploy/mcp/VERIFY.md`에 세 저장소 전체 검증·배포 인계를 기록한다.

## 2026-09-30 예비생 최초 연동 증분

교육원이 엔진을 처음 연결할 때 엔진에만 있는 학생을 PACA에 등록하려면 `student_create`의 `changes`에 `registration_source: "max_engine"`를 보낸다. 이 값은 학생 행에 저장하지 않고 `status=prospect`, `memo` 첫 줄 `엔진등록`으로 고정한다. 제공한 메모는 다음 줄에 보존한다. 이름+전화번호 중복 확인과 미리보기→확정 절차는 동일하다. 전화번호가 없으면 422이며 엔진에서 입력받은 뒤 재시도해야 한다. 옵션을 생략한 기존 등록은 `active`다.

```json
{"operation":"student_create","changes":{"name":"홍예비","phone":"01012345678","enrollment_date":"2026-09-30","registration_source":"max_engine","memo":"첫 연동"}}
```

예비생은 학생 목록의 별도 탭과 배지로 표시된다. 원장은 학생 수정 화면에서 `active`로 전환하고 수업 요일·수강료를 설정할 수 있다. 예비생 상태에서는 재원 총원·출결·청구 생성·2월 자동 진급·학생 대상 문자/알림을 제외한다. 엔진 읽기 명단에는 포함해 PACA 원본으로 계속 동기화한다. 운영 반영 전에는 `migrations/20260930_add_student_prospect_status.mysql`을 검증된 백업 후 적용해야 한다. 앱 롤백은 예비생 값을 포함하는 ENUM을 유지하며, 값 제거는 예비생 행을 별도로 보존·재분류한 다음 수동으로 수행한다.

## 2026-09-27 업무 조회 효율화 증분

`read_resource` 원본 조회에 JSON 배열 `ids`(1~200개), `expand`(catalog의 표시용 관계, 최대 5개)를 추가했다. 교육원·삭제·현재 PACA 소속 검사를 유지하며 관련 학생 id/이름/학년/학교, 수업·강사·종목 표시 필드만 일괄 결합한다. PEAK의 paca_* 별칭도 실제 PACA 관계를 사용한다.

`GET /{provider}/workflows/{workflow}?params=<JSON>`는 PACA 9개(수업 명단, 출결 요약, 학생 요약/검색, 미납/수납, 상담 일정, 체험 학생, 오늘 현황)와 PEAK 3개(최근 기록, 순위, 학생 향상도)를 제공한다. 기간·학생 조건을 원본 서버에서 적용하고 결과를 결합한다. 이름·전화는 교육원 범위 안에서 복호화 검색한다. 정확한 이름의 동명이인은 후보 id를 반환한다. PEAK 업무 표시 필드·상태·성별은 현재 PACA 기준, 학생 id는 PEAK 원본을 유지한다. 순위는 기존 PEAK의 재원생 최신 기록·higher/lower·순번 기준이다.

집계 상한은 10,000행(초과 오류), 상세 최대 200건은 total/truncated로 명시한다. 수업은 출결 배정표 기준이며 명단 미생성은 학생 0명, 시간 범위는 교육원 설정과 겹치는 수업이다. 돈은 센트 단위 BigInt로 합산하고 소수 문자열로 반환한다. 쓰기 계약과 preview→confirm은 그대로다.

이번 증분에서는 **paca.js 변경·복사 금지**: 운영에만 있는 bridgePacaReadAdapter 3줄을 보존한다. 신규 서비스·상수와 full 라우트/읽기 서비스/읽기 저장소만 검토한다. 새 DB migration·환경 키는 없다. 기존 위의 paca.js 배포 설명은 최초 D-117 구축 당시의 기록이다.

최종 143 suites / 1,202 tests passed, skip 0. 신규 단위·실제 MySQL 업무 통합 10건, 조회 변경 코드 statements 92.81%·branches 81.93%. 실제 OAuth MCP 10개 질문 전후 결과 일치와 상세 증분 목록은 max-engine `docs/analysis/mcp-efficient/`, `ops/deploy/mcp/VERIFY.md`에 기록한다. 이번 작업에서 운영 쓰기·배포·push·main 병합은 수행하지 않았다.

## 2026-10-03 GPT MCP 업무 확장

최신 후보 계약은 [mcp-business-20261003.md](mcp-business-20261003.md)를 따른다. 양쪽 71종 조회와 24종 확인 쓰기, PACA 퇴원/재원 복귀·PEAK 기록/훈련/계획을 추가했다. PEAK의 별도 멱등 ledger migration이 필요하다. 로컬 검증 완료이며 운영 미배포다. 이전 절의 리소스 수와 쓰기 제한은 각 날짜의 역사적 결과다.
