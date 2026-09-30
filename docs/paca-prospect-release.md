# PACA 예비생 릴리스 4.0.54

엔진 최초 학생 등록의 `registration_source=max_engine`은 `status=prospect`로 저장하고 메모 첫 줄에 `엔진등록`을 남긴다. 예비생은 별도 목록·배지로 표시하며, 학생 수정 화면에서 재원생으로 전환할 수 있다. 예비생은 재원 집계, 출결, 청구 생성, 학생 대상 문자·알림, 자동 진급 대상에서 제외한다. 기존 `registration_source` 없는 등록은 재원생으로 유지한다.

백엔드 적용 전에 `backend/migrations/20260930_add_student_prospect_status.mysql`로 `students.status` ENUM 끝에 `prospect`를 추가한다. 기존 nullable과 기본값 `active`는 유지한다. 롤백 때 ENUM은 즉시 제거하지 않는다. 이미 예비생 행이 있다면 보존·영향 평가 후 별도 재분류 절차를 결정한다.

프론트 `package.json`, lockfile, `src/constants/release.json`을 함께 4.0.54로 올렸다. 모바일 학생 상태 탭은 탭 영역 안에서만 가로 스크롤되도록 바깥 flex 콘텐츠의 최소 너비를 0으로 지정했다. 예비생 탭으로 이동해도 화면 전체가 옆으로 밀리지 않는지 `scripts/smoke/students-smoke.mjs`가 검사한다.
