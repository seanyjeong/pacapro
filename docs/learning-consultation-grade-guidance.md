# 재원생 상담 등록 시 학년 누락 안내

학생정보의 학년은 생략할 수 있지만 상담의 학년은 필수다. 학년이 없는
학생을 상담 등록하면 첫 저장 전에 요청을 중단하고 다음 안내를 반환한다.

> 학생의 학년 정보가 없어 상담을 등록할 수 없습니다. 학생정보에서 학년을 입력한 뒤 다시 시도해 주세요.

`POST /paca/consultations/learning`은 이 경우 `{ code: 'STUDENT_GRADE_REQUIRED',
error: '<안내 문구>' }`를 반환한다. 기존 `error` 필드는 유지한다.
상담 일정, 상담 기록, 모의고사 성적을 저장하거나 알림을 발송하지 않는다.

재원생상담, 상담 목록, 상담 달력은 이 원인을 같은 문구로 표시한다.
실패한 폼의 학생, 날짜, 시간, 메모는 유지한다. 알 수 없는 오류의 내부 내용은
표시하지 않고 재시도 안내를 제공한다.

검증: backend의 `__tests__/routes/consultations/learning.test.js`와
`scripts/smoke/enrolled-consultations-smoke.mjs`, 상담 달력 smoke를 실행한다.
운영 데이터 보정과 학년 필수 조건 변경은 이 수정에 포함하지 않는다.
