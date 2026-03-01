# student-initial-consultation Plan

## 개요
학생 상세 페이지의 상담기록 탭에 신규상담(consultations 테이블) 기록도 함께 표시

## 배경
- 현재: `student_consultations` 테이블의 재원생 상담만 표시
- 요청: `consultations` 테이블에서 `linked_student_id`로 연결된 신규상담 기록도 함께 표시

## 요구사항

### FR-1: 백엔드 API 확장
- `GET /student-consultations/:studentId` 응답에 `initialConsultations` 필드 추가
- `consultations` 테이블에서 `linked_student_id = studentId` 조회
- 암호화 필드 복호화: student_name, parent_name, parent_phone
- JSON 필드 파싱: academic_scores, checklist, referral_sources

### FR-2: 프론트엔드 통합 타임라인
- 재원생 상담 + 신규상담을 날짜순 통합 타임라인으로 표시
- 신규상담 배지: 파란색 `신규상담` (기존 재원생은 초록색)
- 건수 표시: `상담 기록 (재원 N건 + 신규 N건)`

### FR-3: 하위호환
- 기존 `consultations` 필드 유지
- `initialConsultations`는 새 필드로 추가
- 프론트에서 undefined면 빈 배열 처리

## 영향 범위
- `backend/routes/student-consultations.js` (GET /:studentId)
- `src/components/students/student-consultations.tsx`
- `docs/API-ROUTES.md`

## 우선순위
Medium - 기존 기능 확장, 하위호환 유지
