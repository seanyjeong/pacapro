# 재원생상담 리팩토링 검수 메모

## 목적

재원생상담 화면의 1000라인대 라우트 파일을 기능 단위로 분리한다. 상담 목록, 필터, 상세, 상태 변경, 삭제, 신규 등록, 성적 조회 흐름은 기존 API 계약을 유지한다.

## API 계약

- 목록 조회: `GET /consultations`, `consultationType=learning`
- 설정 조회: `GET /consultations/settings/info`
- 예약 시간 조회: `GET /consultations/booked-times`
- 상태 변경: `PUT /consultations/:id`
- 삭제: `DELETE /consultations/:id`
- 학생 목록: `GET /students?status=active&limit=500`
- 정시엔진 성적: `GET /jungsi/scores/:studentId?exam=...`
- 재원생상담 등록: `POST /consultations/learning`

## UX 검수 기준

- 필수값 누락 시 한국어 메시지로 안내한다.
- 서버 실패 메시지는 콘솔/상태코드/스택을 노출하지 않는다.
- 상태 필터와 성적 수동 입력은 Radix Select의 빈 문자열 value를 쓰지 않는다.
- 데스크톱과 모바일에서 가로 overflow가 없어야 한다.
