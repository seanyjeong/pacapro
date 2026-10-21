# 교육원 Google 연동

## 구현과 저장 경로

설정의 **구글 연동하기**에서 원장이 교육원 구글 계정을 연결하고 Calendar/Drive/Sheets를 각각 켜고 끈다. Calendar만 실제 동기화를 수행한다. Drive/Sheets는 권한 및 사용 여부만 저장하며 파일·시트를 처리하지 않는다. 기존 상담 및 MCP 명령의 업무 로직은 변경하지 않았다.

- API: `routes/google-integration.js` → `services/google/connection.js` → `repositories/google/connection.js`.
- OAuth: 일회용 state + PKCE S256, 교육원·요청 원장·브라우저 쿠키 결합, 완료 시 원장 권한 재검증. 외부 프론트에서 API로 이동하는 `/start`가 first-party HttpOnly/Secure/Lax 쿠키를 설정한다.
- 토큰: 교육원 ID를 AAD로 사용하는 AES-256-GCM 암호화. 만료 전 갱신, 401에서 한 번 강제 갱신. 재연결은 서비스 사용 설정을 모두 끈다. 응답과 앱 로그에 코드·토큰 원문을 노출하지 않는다. 리버스 프록시에서도 OAuth 쿼리 문자열을 로그에 남기지 않아야 한다.
- 공통 저장 지점: InnoDB AFTER INSERT/UPDATE/DELETE 트리거. 원본 저장과 버전·outbox가 같은 트랜잭션에 들어간다. Google API 실패는 이미 저장한 상담을 취소하지 않는다.
- `consultations`: 신규/재원생(`learning`)/기타 종류를 필터링하지 않는다. 공개 예약, 상담 화면, 재원생 예약, 관리자 수정, MCP 확정이 실행한 DML을 모두 잡는다. 연계 `student_consultations` 기록 수정도 부모 상담을 무효화한다. 예약과 연결되지 않은 과거 상담 기록은 별도 예약 일정이 아니므로 중복 일정을 만들지 않는다.
- `academy_events`: 업무/학원/휴일/기타 종류와 관계없이 전체 DML. 화면과 MCP `academy_event_create`/`academy_event_update`가 이 테이블에 저장하면 동일하게 처리한다. MCP 자체는 수정할 필요가 없다.
- 식별자 이동: 교육원 ID 변경 시 이전 교육원과 새 교육원 모두 큐를 남겨 기존 일정 삭제와 새 일정 생성을 처리한다.

## 큐와 중복 방지

`google_calendar_outbox`의 변경 신호는 `resource_id`, `version`이다. `academy_id`, `resource_type`은 라우팅 열이고 `attempts`, `available_at`, `last_error`는 재시도 메타데이터다. 이름·연락처·일정 본문 스냅샷은 저장하지 않는다.

`google_sync_versions`는 원본 삭제 이후에도 남는다. 작업자는 원본과 버전을 한 SQL로 다시 읽는다. 원본 없음 또는 상담 `cancelled`는 삭제로 해석한다. 중간 변경은 최신 상태 하나로 합친다. 성공 시 읽은 버전까지만 큐를 지워 API 호출 도중 새로 생긴 변경을 보존한다.

교육원별 MySQL `GET_LOCK`으로 작업자, 토큰 갱신, 연결/해제를 직렬화한다. 여러 Node 프로세스가 실행되어도 같은 교육원에서 동시에 처리하지 않는다. 기본 3초 폴링, 한 번에 최대 20개 교육원에 각 1건 처리한다. API 지연과 초기 적체가 있으면 즉시 반영보다 늦어질 수 있다. HTTP 요청에는 10초 제한이 있다. 실패는 10초부터 최대 1시간 간격까지 지수 재시도하며, 연동을 다시 켜면 대기 중 재시도 시간을 초기화한다.

Google 이벤트 ID는 연결·종류·원본 ID·세대의 결정적 해시다. `google_calendar_events`에 원격 이벤트 ID와 반영 버전을 저장한다. private extended property는 상담 `paca:consult`, 학원 일정 `paca:event`이며 값은 namespace/교육원/원본 ID다. 응답 유실 뒤 재시도, 409, 원격 삭제 후 재생성을 처리한다. 다른 식별자의 이벤트는 수정하지 않고 중복 marker는 오류로 드러낸다.

Calendar를 처음 켤 때 교육원 전용 보조 캘린더 **파카 일정**을 생성한다. 제목만으로 기존 개인 캘린더를 재사용하지 않는다. `paca:calendar:<namespace>:<academy>` 설명으로 자신의 캘린더만 찾는다. 같은 계정 재연결은 기존 캘린더를 유지하고, 다른 계정은 새 연결로 관리한다.

- 상담: 이름과 예약 시각만 보낸다. 상담 기록·전화번호·성적은 보내지 않는다. 기존 상담 설정의 slot_duration, 없으면 30분.
- 학원 일정: 제목·설명·날짜·시간을 보낸다. 종일 일정 종료일은 다음 날(배타적), 시작 시각만 있으면 30분, 종료 시각이 시작보다 이르면 다음 날로 처리한다. 종일↔시간 일정 전환 시 이전 시간 표현을 지운다.
- 기존 업무 시간대와 같은 Asia/Seoul 기준이다. 이 기본값은 `config/google.js`에 모았다.
- 연동 OFF는 원격 일정 삭제가 아니다. 큐를 보존하고 ON 시 기존 일정까지 최신 상태를 다시 반영한다.
- 연결 해제는 로컬 토큰 제거 및 전체 서비스 OFF다. 다른 교육원이 같은 계정을 쓸 수 있으므로 Google 전체 grant를 강제 revoke하지 않는다. 원격 일정과 재연결용 mapping은 유지한다.

## 환경 설정

비밀은 서버 환경설정으로만 주입한다. 프론트 `NEXT_PUBLIC_*`로 보내지 않는다.

| 변수 | 값/역할 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 발급한 Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | 해당 client secret |
| `GOOGLE_REDIRECT_URI` | 등록한 API callback 절대 URL (`/paca/google-integration/callback`) |
| `GOOGLE_RETURN_URL` | 프론트 설정 화면 절대 URL (`/settings`) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 암호학적으로 생성한 32바이트 키의 64자리 hex. 전 프로세스가 같은 키 사용 |
| `GOOGLE_CALENDAR_NAMESPACE` | 환경마다 고유하고 변경하지 않을 식별자. 교육원 번호를 대신하는 값이 아님 |
| `GOOGLE_CALENDAR_WORKER_ENABLED` | 기본 OFF, 정확히 `true`일 때만 실행 |

키를 잃으면 저장 토큰을 복구할 수 없다. 일반 배포 때 키를 다시 만들지 않는다. namespace 변경도 이벤트 소유권에 영향을 주므로 일반 배포에서 바꾸지 않는다.

요청 scope: `openid`, `email`, `calendar.events`, `calendar.calendars`, `calendar.calendarlist.readonly`, `drive.file`, `spreadsheets` (후반 5개는 `https://www.googleapis.com/auth/` 접두사). 일부 권한만 허용해도 연결 상태는 저장되지만 누락된 서비스는 켤 수 없다.

## 적용 순서와 운영 경계

이 브랜치는 본 기능을 배포하지 않는다. 별도 승인된 배포에서 다음 순서를 지킨다.

1. 운영 대상 DB/서비스 확인, 백업, worker OFF 유지. 사업 테이블은 InnoDB인지 확인한다. DB 마이그레이션 계정에는 TRIGGER 권한이 필요하다.
2. 짧은 상담·학원 일정 쓰기 중지 구간에서 `migrations/20261022_google_integration.mysql`을 **MySQL client의 DELIMITER 지원**으로 1회 적용한다. CREATE TABLE/TRIGGER는 암묵적 commit이므로 설치 전체를 하나의 트랜잭션으로 보지 않는다. 중단된 설치는 객체 상태를 확인하고 복구한다.
3. 서버 코드/환경을 배치하고 원장 설정 화면·callback 접근을 확인한다. 기존 route/scheduler 자동 검색기가 새 파일을 등록한다.
4. 원장이 자기 교육원 계정을 연결한 뒤 Calendar를 켠다. 처음에는 기존 상담·학원 일정도 큐에 들어간다.
5. worker를 켜고 queue 감소, 최근 반영 시각, 오류 코드를 확인한다. 운영 상담 변경 검증은 별도 승인 범위에서 한다.

운영 모니터링 예시(개인정보를 포함하지 않는 메타데이터):

```sql
SELECT academy_id, resource_type, COUNT(*) AS pending, MAX(attempts) AS max_attempts,
       MIN(available_at) AS next_attempt FROM google_calendar_outbox GROUP BY academy_id, resource_type;
SELECT academy_id, calendar_enabled, last_error, last_synced_at FROM google_connections;
```

`RECONNECT_REQUIRED`는 구글 계정을 다시 연결해야 한다. `DUPLICATE_CALENDAR_EVENTS`, `EVENT_ID_CONFLICT`는 원격 중복/소유권 확인이 필요하다. 구글에서 캘린더 자체를 삭제하거나 이전한 경우에는 관리자가 연결 대상 복구를 확인해야 하며 새 캘린더를 무조건 반복 생성하지 않는다.

MySQL의 TRUNCATE, FK cascade, 테이블 교체/복원은 일반 행 트리거를 실행하지 않는다. 이러한 운영 작업은 일반 상담/학원 일정 편집 경로와 구분하고 별도 재조정 절차가 필요하다. 트리거를 설치한 뒤 outbox 테이블만 임의로 삭제하면 원본 쓰기도 실패할 수 있으므로 객체를 함께 관리한다.

롤백은 worker OFF 후 기존 런타임 복구를 우선한다. `20261022_google_integration.down.mysql`은 9개 트리거와 5개 연동 테이블만 제거하나 토큰·중복 방지 mapping을 잃으므로 운영에서는 별도 승인 없이 실행하지 않는다. 구글 일정은 down migration으로 삭제되지 않는다.

## 검증

`__tests__/google`의 단위·Express 라우트·격리 MySQL 테스트가 OAuth/권한/암호화/중복/취소/재시도/동시 변경/교육원 분리/마이그레이션 up·down을 검증한다. MySQL 테스트는 명시적 opt-in이며 localhost 고번호 포트의 전용 임시 DB만 사용한다.

```sh
# backend/에서, 별도 disposable MySQL을 준비한 뒤 실행
GOOGLE_TEST_MYSQL=1 GOOGLE_TEST_MYSQL_PORT=13376 ./node_modules/.bin/jest \
  --config jest.config.js --runInBand __tests__/google __tests__/routes/consultations \
  __tests__/routes/academyEvents.test.js __tests__/routes/maxEnginePrivacy.test.js \
  __tests__/services/maxEngineFull.test.js
```

UI는 `scripts/smoke/google-integration-fixture.mjs`로 모든 외부 API를 차단한 합성 원장 환경을 설치하고, 같은 Ego TaskSpace의 Page에 `checkGoogleIntegration`을 실행한다. 모든 서비스 토글, 실패 시 기존 상태 유지, 재조회, 연결 해제 후 비활성화를 검사한다. 1365/768/390px에서 가로 넘침이 없음을 확인한다.

## 공식 API 근거

- [OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server): offline consent와 refresh token.
- [Calendars and CalendarList](https://developers.google.com/workspace/calendar/api/concepts/events-calendars): 보조 캘린더 생성 시 소유자의 목록에 추가됨.
- [Events insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [extended properties](https://developers.google.com/workspace/calendar/api/guides/extended-properties), [API errors](https://developers.google.com/workspace/calendar/api/guides/errors): 사용자 지정 ID, 소유권 검색, 실패 재시도.
- [Drive scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Sheets scope](https://developers.google.com/workspace/sheets/api/scopes): 서비스별 요청 권한.
