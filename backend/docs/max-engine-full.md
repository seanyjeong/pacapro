# max-engine PACA·PEAK 업무 위임 API (D-117)

2026-09-27 KST. 기존 명단/기록 연동 위에 전체 업무 조회와 8개 확인 쓰기를 추가한다. 코드만 준비했으며 운영 배포·마이그레이션은 별도다.

## 경로와 권한

기본 경로 `/paca/integrations/max-engine/full`:

- `POST /token`: email/password로 승인된 활성 원장·관리자의 1시간 위임 발급.
- `GET /identity`: 현재 계정·교육원 재검증.
- `GET /{paca|peak}/catalog`: 원본 resource·필드·필터·쓰기 스키마.
- `GET /{paca|peak}/resources/{resource}?cursor=0&filters={"id":1}`: 내 교육원 원본 JSON 100개씩. `next_cursor`가 null까지 반복.
- `POST /{paca|peak}/preview`: operation/resource_id/changes. 원본 변경 없음.
- `POST /{paca|peak}/confirm`: preview_token/idempotency_key/confirm=true. 잠금·변경 전 값 확인 후 원자적 반영.

전용 `MAX_ENGINE_LINK_SECRET`만 사용한다. 기존 서비스 키·JWT_SECRET와 같으면 비활성화된다. 기존 read audience 토큰의 범위를 올리지 않는다. 매 요청에 사용자 승인/활성/역할/교육원/비밀번호 fingerprint를 검사한다. `nc_*`는 접근하지 않는다.

## 데이터와 쓰기

PACA 38·PEAK 33 원본 resource + PEAK의 PACA id 검색용 8개 별칭을 제공한다. 반환 컬럼과 필터는 `constants/maxEngineReadCatalog.json`에서 고정한다. 비밀번호·인증/결제 키·주민번호·불투명 인증 JSON은 반환하지 않는다. PEAK 학생 캐시는 현재 PACA 소속을 재검사한다.

쓰기 명령은 `constants/maxEngineCommands.js`의 8개만 허용한다.

- 학생 기본 등록/수정: 이름·전화·학교·학년·부모·주소·메모. 등록은 정식 재원생, 정시, 수강료 0, 요일 없음. 학번은 현재 KST 연도 기준이며 삭제 학생 번호를 재사용하지 않는다. 체험 전환·학적 상태·요일·수강료 수정·청구 생성은 제공하지 않는다.
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
