# 일산 입학원서 — 화면 연결 계약

작업 위치: `/Users/etlab/worktrees/pacapro-ilsan-admission`, 브랜치 `codex/ilsan-admission`.
기준 커밋: `30f0ffb`. 2026-10-16 사용자 요청에 따라 운영 반영 진행. 실제 적용 및 검증 근거는 `docs/operations/ilsan-admission-deploy-20261016/` 참조.

## 담당 범위

- 사용자 2026-10-16 지시: 화면 마크업·스타일은 별도 Opus 창 담당. Codex는 이후 화면 디자인을 변경하지 않는다.
- Codex: API, 입력 검증, 암호화 저장, 일할계산, 예약 등록, 담당자 화면 controller.
- 기본 흐름: 보호자/학생 공개 원서 제출 → 일산 담당자 조건 확인·승인 → 등록일에 학생/첫 달 청구/수업 배정 생성.
- 공개 제출 자체는 재원 등록이나 결제가 아니다. 일산 academy_id=2 고정이며 DB 교육원 이름도 일치해야 작동한다.

## 화면에서 사용하는 파일

- 공개 페이지: `/admissions/ilsan`, `src/features/ilsan-admission/admission-page.tsx`.
- 데이터형: `src/lib/types/ilsan-admission.ts`.
- API: `src/lib/api/ilsan-admissions.ts`.
- 담당자 controller: `src/hooks/use-ilsan-admissions.ts`의 `useIlsanAdmissions()`.
- 담당자 화면 `/admissions`의 기본 기능을 `src/app/admissions/page.tsx`에 연결했다. middleware에 인증 및 태블릿 경로를 허용했고 일산 학생 수정 권한 담당자에게만 사이드바 입학원서 메뉴를 표시한다. 공개 원서 디자인 파일은 Opus 전담으로 유지한다.

### 담당자 controller

반환 상태: `applications`, `nextCursor`, `selected`, `draft`, `preview`, `busy`, `loading`, `error`, `notice`, `editable`, `canConfirm`, `today`.

동작:

1. mount 시 목록을 불러온다. `refresh()` 새로고침, `loadMore()` 50건 단위 추가 조회.
2. `select(application)` 원서 선택. 원서 이름/학교/학년/성별/생년월일 6자리/양 부모 연락처는 `selected.profile`.
3. `changeTerms(patch)` 등록 조건 변경. 월 학원비는 초기 빈 값(`''`), 무료이면 명시적으로 `0` 입력. 요일도 담당자 선택 필수. 바꾸면 이전 견적은 무효화된다.
4. `calculate()` 서버 일할 계산. `preview.quote`에서 `total_classes`, `remaining_classes`, `class_dates`, `prorated_amount`, `discount_amount`, `final_amount` 표시. 계산 중 변경한 조건에 대한 오래된 응답은 무시한다.
5. `canConfirm`일 때만 명시적인 승인 버튼으로 `confirm()`. `preview.terms.enrollment_date`와 `preview.quote.final_amount`를 승인 전에 함께 표시한다. 현재 날짜면 즉시 등록, 미래 날짜면 예약.
6. `cancel()`은 별도의 명시적인 취소 클릭으로만 호출. 등록 완료 후에는 이 기능으로 학생을 삭제하거나 퇴원시키지 않는다.

`busy`일 때 승인·취소·선택/조건 편집은 잠근다. 버튼 유형은 form 안에서 명시한다. `error`는 alert, `notice`는 status로 전달한다. `review` 상태는 확인 필요로 표시하고 다시 금액 계산/승인이 가능하다. 기존 학생 중복이 있으면 `preview.duplicate_student_ids`의 학생 상세 `/students/{id}`로 안내하고 승인을 막는다. 등록 완료는 `student_id`로 학생 상세 연결. 원서 생년월일은 별도 암호화 원서에 남으며 기존 students 테이블에 없는 생년월일 필드를 임의로 만들지 않는다.

## API

기본 `/paca/ilsan-admissions` (프론트 API client가 `/paca` 포함).

| 경로 | 접근 | 응답/효과 |
|---|---|---|
| POST `/submit` | 공개, IP별 시간당 20회 | JSON profile, UUID v4 `Idempotency-Key`; 같은 키/내용 재전송은 같은 접수 결과 |
| GET `/` (`?before=id`) | 일산 + students/edit | 원서 목록 50개 + next_cursor |
| POST `/:id/preview` | 동일 | terms → 계산 금액·중복 학생·preview_hash, 저장 없음 |
| POST `/:id/confirm` | 동일 | terms + preview_hash → 승인/예약 또는 당일 등록 |
| POST `/:id/cancel` | 동일 | 현재 revision 필요, 예약/접수 취소 |

terms: `enrollment_date` YYYY-MM-DD, `monthly_tuition` 원 정수, `discount_rate` 0~100 정수, `class_days` 0(일)~6(토) 중복 없는 배열, `time_slot` morning/afternoon/evening.

profile: 이름, 학교, 학년, 성별 male/female, 생년월일 `birth_six` 6자리, 학생 전화, father_name/phone, mother_name/phone, primary_parent father/mother, 희망 enrollment_date, consent=true. 보호자 전화는 최소 한 분 필요. 주민번호 뒷자리는 받지 않는다. 공개 응답에는 학생/부모 정보가 없다.

## 계산·예약 규칙

- 기존 신규 등록 계산과 같이 월 학원비 × 등록일부터 말일까지 선택 요일 수 / 월 전체 선택 요일 수, 천원 미만 버림. 이후 할인액도 천원 미만 버림.
- 등록일 포함. 달력 공휴일/교육원 휴무는 현재 기존 계산과 동일하게 별도 차감하지 않는다. 담당자가 실제 수업 조건과 맞는지 확인한다.
- 예: 2026-10-20 등록, 화/목, 월 300,000원, 10% 할인 → 9회 중 4회 → 133,000원 − 13,000원 = 120,000원.
- 남은 선택 요일이 0회면 0원. 등록은 하되 첫 달 0원 청구서를 만들지 않는다.
- 서버 한국시간 기준 매분 확인 및 재시작 시 누락분 처리. 승인 전/등록일 전에는 학생·청구·출석을 만들지 않는다.
- 학생/부모 정보 암호화, 학생 생성, 첫 청구, 수업 배정, 원서 완료 전환은 한 DB transaction. 실패 시 모두 되돌린다.
- 동일 이름+학생 전화가 이미 존재하면 기존 기록을 덮어쓰지 않고 확인 필요 상태. 접수 중복/승인 재실행/동시 scheduler 실행도 중복 등록하지 않는다.
- 장애로 등록 예정월이 지난 예약은 과거 월로 자동 청구하지 않고 담당자가 날짜·금액을 재확인한다.
- 이름/학교/연락처 등 오입력 수정 API는 현재 범위 밖. 기존 원서를 취소하고 새 원서를 제출하거나 담당자가 정상 학생 등록 경로로 처리한다.
- 문자 발송, 결제 승인/카드 청구, 기존 학생 청구 변경은 이 기능에 포함하지 않는다.

## 운영 반영 전

1. 현재 운영 소스와 schema 확인, 변경 범위 비교, 백업 및 복원 지점 확보.
2. `backend/migrations/20261016_ilsan_admission_applications.mysql` 적용. 기존 학생/청구 테이블 데이터는 변경하지 않는다. parent contact 기존 migration이 선행되어 있어야 한다.
3. 암호화 키 설정 확인(값 출력 금지), 일산 academy 2 이름 확인. route/scheduler 자동 등록되는 기존 런타임 구조 사용.
4. 백엔드 반영 후 공개 검증 오류·비로그인 목록 401·타 교육원403·헬스 확인. 실제 합성 원서를 운영에 제출하지 않는다.
5. 화면 연결 확인 후 프론트 버전업/배포. 2026-10-16 사용자 요청으로 실제 접수와 PACA 반영을 위한 운영 배포를 진행한다.
6. 되돌릴 때 scheduler/route를 이전 코드로 먼저 복구. 접수된 개인정보 보존과 예약 처리 현황을 확인한 뒤 테이블 처리 여부 판단. down migration은 무조건 실행하지 않는다.

## 기존 학생 정보 보완 (4.0.60)

원서 선택 시 같은 이름의 일산 기존 학생을 조회한다. 이름+학생 전화가 일치하는 후보가 한 명이면 선택만 미리 해 두며, 반영은 담당자의 미리보기·동일 학생 확인·명시적 승인 후에만 실행한다. 동명이인이나 기존 학생 전화가 없는 경우에는 학번/학교/전화로 직접 선택한다. 다른 사람이면 신규 등록으로 전환할 수 있지만 이름+전화가 같은 중복 학생의 신규 생성은 계속 차단한다.

- `GET /:id/existing-students`: 동일 이름 후보 (일산 students/edit 권한).
- `POST /:id/existing-preview`: `student_id` → 현재 값/원서 값/빈 항목 추가 계획·preview_hash.
- `POST /:id/existing-confirm`: `student_id`, `preview_hash` → 학생 row lock과 최신 계획 재검증 후 빈 항목만 반영.
- 보완 대상: 학생 전화·학교·학년·성별·양 부모 이름/전화·대표 안내 번호. null/공백만 비어 있는 값으로 판단하며 기본값/서로 다른 값도 보존한다. 대표 안내 번호도 이미 있으면 유지한다. 대표 번호가 비었으면 선택한 보호자의 보완 후 번호를 사용한다.
- 이름, 등록일, 재원/휴원/퇴원 상태, 월 학원비, 할인, 수업 일정, 기존 청구·납부 이력은 바꾸지 않는다. 새 학생·청구·수업 배정도 만들지 않는다. 생년월일 6자리는 기존 설계대로 암호화 원서에 보관하며 학생 테이블에 임의 필드를 추가하지 않는다.
- 승인 전에 학생 정보/원서가 변경되면 409로 중단하고 재확인을 요구한다. 보완과 원서 완료는 하나의 transaction이므로 중간 실패 시 모두 원복한다.
- 원서의 내부 완료 상태는 `enrolled`, `terms_json.operation='fill_missing'`와 target_student_id/filled_fields로 보완 이력을 구분한다. 응답 completion_kind와 학생 보기 링크로 연결한다. 학생 신규 생성용 unique student_id 열은 비워 두므로 같은 기존 학생의 다음 원서도 안전하게 보완할 수 있다. 화면은 '정보 보완 완료'로 표시한다.
- 예약 원서를 정보 보완으로 승인하면 신규 등록 예약도 완료 상태로 끝나므로 추후 중복 등록하지 않는다. 기존 원서가 이미 등록 완료/취소된 경우 새 승인은 차단한다.
- DB schema 변경 없음. 기존 태블릿 HTML 파일은 그대로 사용한다.
