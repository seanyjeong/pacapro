# Student Profile Photos

## Scope

학생 사진은 PACA 리팩 버전에만 로컬 구현한다. 운영 반영 전까지 Vultr DB, 운영 업로드 디렉터리, Vercel 배포는 건드리지 않는다.

## Behavior

- 학생별 프로필 사진 원본과 목록용 썸네일을 저장한다.
- 저장 키는 `academies/{academyId}/students/{studentId}/...` 형태로 고정해서 학원별 파일 공간을 분리한다.
- 모든 사진 업로드, 조회, 삭제는 로그인 토큰의 `academyId`와 학생의 `academy_id`가 일치할 때만 허용한다.
- 학생 목록과 학생 상세는 사진이 있으면 썸네일을 보여주고, 없으면 기존 첫 글자 표시로 대체한다.
- 신규 학생은 저장 후 상세/수정 화면에서 사진을 등록할 수 있다. 운영 위험을 줄이기 위해 학생 생성 트랜잭션에 사진 파일 저장을 섞지 않는다.

## API

- `POST /paca/students/:id/photo`
  - JSON body: `original_data_url`, `thumbnail_data_url`
  - 지원 형식: JPEG, PNG, WebP
  - 원본 최대 5MB, 썸네일 최대 512KB
- `GET /paca/students/:id/photo/thumb`
- `GET /paca/students/:id/photo/original`
- `DELETE /paca/students/:id/photo`

## Storage

- `PACA_UPLOAD_ROOT`가 있으면 그 경로를 사용한다.
- 없으면 backend 프로세스 작업 디렉터리의 `uploads/`를 사용한다.
- 운영 권장값: `/var/lib/paca/uploads`

## Database Migration

운영 반영 직전 백업 후 migration SQL을 먼저 적용한다.

- `profile_image_url`
- `profile_image_key`
- `profile_thumb_key`
- `profile_image_mime_type`
- `profile_thumb_mime_type`
- `profile_image_updated_at`

## Verification

- Backend Jest: storage service, route academy isolation, upload/get/delete.
- Frontend checks: lint, build, student list smoke, student detail smoke.
- 운영 전 smoke: 실제 테스트 학원 계정으로 업로드, 목록 썸네일, 상세 사진, 삭제 후 대체 표시 확인.
