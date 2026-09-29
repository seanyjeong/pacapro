# 학생 보호자 전화번호

학생 등록·수정의 보호자 정보에서 아버지·어머니 전화번호를 각각 선택 입력한다.
학생 상세와 태블릿 학생 상세에서 두 번호를 확인할 수 있다. PC 학생 상세에서는
각 번호의 전화 연결을 사용할 수 있다. 입력은 기존 학생 폼과 같은 전화번호 형식을 사용한다.

기존 `parent_phone`은 대표 학부모 전화번호로 보존한다. 기존 번호가 어느 분의 번호인지는
추정하지 않으며, 기존 학생의 새 입력칸은 빈칸으로 시작한다. 각 부모님 전화번호 아래의
**대표 번호로 사용**을 누르거나 대표 번호를 직접 입력할 수 있다. 문자·알림 발송은
대표 번호를 사용한다. 대표 번호는 별도 값이므로 부모님 번호를 수정·삭제해도 자동으로
바뀌지 않으며, 변경하려면 대표 번호를 다시 선택하거나 수정한다.

## 저장 계약

- `students.father_phone`, `students.mother_phone`: nullable `VARCHAR(512)`, 기존 AES-256-GCM 키로 암호화.
- API는 `010-1234-5678` 형식 또는 하이픈 없는 10~11자리 번호를 받아 표준 형식으로 저장한다.
- 필드 생략은 기존 값 보존, 빈 문자열·null은 해당 번호만 삭제한다.
- 자료형 오류·잘못된 번호·제어문자·암호문 입력은 400 응답이며 암호화 실패 시 평문을 저장하지 않는다.
- 기존 학원 경계와 학생 수정 권한을 유지하며 새 번호 원문을 감사 로그에 기록하지 않는다.
- 휴원·복귀 응답에서 새 암호문 필드는 제외한다. 부모님 정보는 학생 상세 API로 조회한다.
- 상담 연계의 학생 응답에서도 새 필드를 복호화한다.

## 적용 순서

1. 운영 학생 테이블 백업과 기존 암호화 키 설정, 새 열의 존재·정의를 확인한다.
2. `backend/migrations/20260929_add_student_parent_phones.mysql`을 적용한다.
   새 열은 테이블 끝에 추가하며 재실행할 수 있다. 기존 열이 있다면 nullable,
   `VARCHAR(512)`, 기본값 null인지 확인하고 다른 정의는 임의 변경하지 않는다.
3. 백엔드를 적용해 등록·수정·목록·상세를 확인한 뒤 프론트엔드를 적용한다.
   DB와 백엔드가 준비되기 전에 프론트엔드만 배포하지 않는다.
4. 앱을 되돌릴 때는 새 열을 유지해 입력된 번호를 보존한다. `.down.mysql`은
   별도 백업과 명시적 데이터 폐기 승인 후 사용하는 수동 복구 절차다.

## 로컬 검증

```sh
cd backend
npm run test:ci -- --runInBand --coverage=false __tests__/services/studentParentContactService.test.js __tests__/services/studentParentNameService.test.js __tests__/routes/students/crud __tests__/routes/students/rest.test.js __tests__/routes/students/rest-resume.test.js __tests__/routes/consultations
cd ..
python3 scripts/release/test-student-parent-names-mysql.py
npm run build
PACA_SMOKE_BASE_URL=http://localhost:3112 node scripts/smoke/student-parent-phones-smoke.mjs
PACA_SMOKE_BASE_URL=http://localhost:3112 node scripts/smoke/student-parent-names-smoke.mjs
```

MySQL 검증은 소켓 전용 임시 인스턴스에서 마이그레이션과 실제 HTTP 저장·재조회,
한쪽 변경·삭제, 기존 번호 보존, 학원 경계·쓰기 권한을 확인한다. 브라우저 검증은
가상 API로 PC·좁은 화면의 입력·저장·재진입, 오류 시 입력 보존, 기존 번호 보존,
태블릿 표시를 확인한다. 실제 학생 자료와 운영 DB는 사용하지 않는다.

## 2026-09-29 검증 결과

- 백엔드 관련 19개 스위트, 192개 테스트 통과. 대표 번호 감사 기록 변경 후 학생 수정 23개 테스트를 다시 통과했다.
- 임시 MySQL 마이그레이션·실제 HTTP 계약 7개 테스트 통과, 생략 0개.
- 프론트 보호자 이름 검색 2개 테스트 통과.
- 부모님 전화번호 브라우저 8개, 기존 부모님 성함 브라우저 12개 시나리오 통과.
- 기존 학생 등록·수정·상세 브라우저 회귀 검증 통과.
- 프로덕션 빌드·타입 검사 통과. 린트 오류 0개, 경고 82개. 변경 UI 디자인 검사 지적 없음.
- 390px·1280px 입력 및 상세 화면 캡처를 직접 확인했다. 새 런타임 파일과 변경 런타임 파일은 모두 500줄 이하다.

MySQL 중간 재실행에서 기존 메모 수정 검증이 한 차례 400 응답으로 실패했다.
실패 원인은 재현되지 않았으며, 응답 문구 검증을 보강한 뒤 두 번의 독립 임시 DB
재실행에서 모두 7개 테스트가 통과했다.

위 결과는 최초 기능 검증 기록이다. 이후 사용자가 운영 적용과 4.0.53 버전업·
푸시를 승인해 운영 DB·백엔드 적용 및 추가 검증을 진행했다.
배포 절차와 검증 범위는 [4.0.53 릴리스 기록](student-parent-phones-release.md)을,
정확한 운영 상태와 프론트 배포 SHA는 해당 기록에 연결된 비공개 증빙을 따른다.
