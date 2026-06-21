# 상담 캘린더 리팩토링 검수 메모

## 목적

상담 달력 라우트의 월 보기, 날짜별 목록, 상세 보기, 재원생 상담 등록 흐름을 feature slice로 분리한다. 기존 API 계약과 URL query 동작은 유지한다.

## API 계약

- 월별 상담 조회: `GET /consultations`, `startDate`, `endDate`, `limit=100`
- 재원생 상담 메모: `GET /student-consultations/calendar`
- 재원생 목록: `GET /students`, `status=active`, `limit=500`
- 재원생 상담 등록: `POST /consultations/learning`

## UX 검수 기준

- 데이터 로드, 학생 목록 로드, 상담 등록 실패는 한국어 고정 메시지로 안내한다.
- 서버 raw 메시지, 500, CORS, stack trace 문구를 사용자에게 노출하지 않는다.
- 상담 유형/시간 Select는 기본값이 빈 버튼처럼 보이지 않아야 한다.
- 데스크톱과 모바일에서 달력 화면이 가로 overflow를 만들지 않아야 한다.
