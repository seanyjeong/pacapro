# 학원 일정의 선택형 상담 차단

- 일정 등록·수정의 **상담 차단** 스위치를 켠 경우에만 상담 예약을 막는다. 새 일정은 기본 꺼짐이다.
- 휴일 지정은 수업 휴강 여부를 정한다. 휴일에도 상담을 막으려면 상담 차단을 별도로 켠다.
- 종일 일정이나 휴일의 차단 범위는 하루 전체다. 시간 지정 일정은 기존 예약 체계에 따라 포함된 오전·오후·저녁 시간대를 차단한다.
- 차단 중인 일정의 날짜·시간을 바꾸면 이전 차단을 해제하고 새 시간대를 차단한다. 차단을 끄거나 일정을 삭제할 때 다른 일정·수동 차단은 지우지 않는다.

## API 호환성

`POST /paca/academy-events`, `PUT /paca/academy-events/:id`에 `block_consultation: boolean`을 추가한다. 신규 등록에서 생략하면 `false`, 수정에서 생략하면 기존 상태를 유지한다. 목록·상세·저장 응답의 `event`에도 동일한 boolean이 포함된다.

차단 상태는 해당 학원과 일정에 연결된 `consultation_blocked_slots` 기록에서 조회한다. DB 컬럼 추가나 기존 데이터 일괄 변경은 없다. 기존 차단 일정은 계속 차단되며 수정 화면에서 끌 수 있다. 동일 슬롯의 유일성 제약이 있는 환경에서는 다른 차단과 충돌한 저장을 롤백하며 기존 차단의 소유권을 덮어쓰지 않는다.

## 검증

- `cd backend && npm run test:ci -- --runInBand __tests__/services/academyEventService.test.js __tests__/routes/academyEvents.test.js`
- `npm run smoke:academy-events` (로컬 프론트엔드 `3109` 포트 또는 `PACA_SMOKE_BASE_URL` 필요)

API 통합 테스트는 실제 JWT 인증·라우트·서비스·저장소와 공개 상담 가능 시간 조회를 격리된 SQLite 메모리 DB에서 실행한다. Node.js의 `node:sqlite`를 지원하는 테스트 런타임이 필요하다. MySQL 전용 `FOR UPDATE` 구문은 어댑터에서 제거하므로 운영 DB의 잠금·동시성 검증을 대체하지 않는다. 브라우저 테스트는 API 응답을 모의하며 PC·모바일 선택 상태, 저장 요청의 인증 헤더와 boolean, 재조회, 입력 오류와 저장 실패의 한국어 안내를 검증한다.
