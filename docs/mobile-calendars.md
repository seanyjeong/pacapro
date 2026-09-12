# 모바일 일정 조회

모바일 홈(`/m`)에 **학원일정**과 **강사 근무달력**을 제공한다. 로그인·승인된 같은 학원의 사용자는 별도 메뉴 권한 없이 조회할 수 있다. 다른 업무 메뉴의 권한과 일정·출결 수정 권한은 기존 정책을 따른다.

- `/m/academy-events`: 월별 행사·업무·휴일 달력, 날짜별 제목·시간·설명 조회.
- `/m/instructor-calendar`: 해당 월에 배정된 강사의 이름을 달력에 표시한다. 강사를 선택하면 그 강사의 근무 시간대가 표시되고, 날짜를 누르면 오전·오후·저녁별 이름과 예정 시간을 볼 수 있다. 배정이 없는 날은 근무가 없는 것으로 표시하며 실제 출근 기록으로 추정하지 않는다.
- 두 화면 모두 이전/다음 달, 오늘 이동, 다시 불러오기, 로딩·빈 일정·한국어 오류 안내를 제공한다.

## API

학원 일정은 기존 `GET /paca/academy-events?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`를 사용한다.

`GET /paca/schedules/instructor-schedules/calendar?year=2026&month=9`는 로그인 계정의 학원에 한정된 `year_month`, `instructors: [{ id, name }]`, `schedules: [{ id, instructor_id, instructor_name, work_date, time_slot, scheduled_start_time, scheduled_end_time }]`를 반환한다. 월은 1~12, 연도는 2000~2100이다. 급여·연락처·출결 메모는 포함하지 않는다. 활동 중인 강사와 해당 월 배정이 남은 퇴사 강사를 필터에 제공하고, 삭제된 강사는 제외한다. 데이터베이스 변경은 필요 없다.

## 검증

- `node --test scripts/smoke/mobile-calendar.test.mjs` (Node.js 22.18 이상, TypeScript 구문 제거 지원)
- `cd backend && npm run test:ci -- --runInBand __tests__/services/instructorCalendarService.test.js __tests__/routes/schedules/instructor-calendar.test.js __tests__/routes/academyEvents.test.js __tests__/routes/schedules/index.test.js`
- `node scripts/smoke/mobile-calendars-smoke.mjs`, `npm run smoke:mobile-home` (`PACA_SMOKE_BASE_URL`로 로컬 서버 지정)

API 통합 검증은 실제 JWT·라우트·서비스·저장소를 SQLite 메모리 DB에서 실행한다. 브라우저 검증은 API 응답을 모의하고 모바일 화면, 요청 인증, 월 경계, 강사 필터, 오류 복구를 확인한다. 운영 DB에는 접근하지 않는다.
