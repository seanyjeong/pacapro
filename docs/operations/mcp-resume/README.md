# MCP 휴원 복귀

`student_reactivate`는 휴원 학생에게 `changes.resume_date`(YYYY-MM-DD)를 받는다.
생략하면 KST 오늘이며, 날짜를 선택한 `preview_student_reactivate`도 같은 경로다.
퇴원·졸업 복귀의 기존 무청구 동작은 유지한다. 날짜 정산은 휴원 학생 전용이다.

미리보기는 SELECT만 실행하며 업무 DB에 쓰지 않는다. before/after.related에 자동
휴원 크레딧 금액·잔액·사용액, 월청구 생성/조정/유지, 출결 배정 계획을 표시한다.
이월 크레딧은 파카 화면처럼 재계산 후 잔액으로 보존하고 복귀 청구에 새로 자동 차감하지 않는다.
미래 복귀 날짜는 예약이 아니다. confirm 시 즉시 재원으로 변경하며 선택한 복귀일~말일 출결을 배정한다.

정산은 화면의 restCreditRecalculationService / resumePaymentService를 공유한다.
계산 부분을 순수 plan 함수로 추출했고 화면 저장도 같은 함수를 호출한다. 시즌·무료기간
청구 제외 정책도 같은 repository를 사용한다. 수업 날짜/시간대 계획과 적용은 기존
학생 배정 helper를 studentScheduleAssignment로 옮겨 공유한다.

원장 확인 후 confirm_change에서 원본 해시·학원/학생 잠금·기존 명령 원장을 검사한다.
크레딧·청구·출결·상태·명령 완료 기록은 한 트랜잭션이다. 중복 확인은 결과를 재사용한다.
학생·청구·크레딧·시즌·출결 변경 또는 생략한 날짜의 KST 자정 경과 시 다시 미리보기한다.
다른 학원·삭제 학생·이미 사용한 금액 초과·중복/모호한 청구는 거부한다.

검증: 새 격리 loopback MySQL에서 실제 화면 HTTP와 MCP HTTP의 결과 동등성을 비교한다.
`RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<격리 포트> PACA_MCP_TEST_ROOT=<MCP 루트>`로
`backend/__tests__/integration/max-engine-resume-mysql.test.js`를 실행한다.
운영 학생 confirm이나 실제 복귀는 검수에 사용하지 않는다. 스키마 변경 없음.
