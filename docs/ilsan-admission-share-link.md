# 일산 입학원서 링크 복사

## 동작

일산 담당자 `입학원서` 화면(`/admissions`)에 **입학원서 링크 복사** 버튼을 추가했다.
버튼은 서버의 `GET /paca/ilsan-admissions/share-link`가 허용한 경우에만 표시한다.
복사 직전에도 같은 API로 권한을 재검사한다. 서버는 기존 `verifyToken`,
`checkPermission('students', 'edit')`, `actor`, `scope`를 그대로 사용한다.
지점 ID·지점 이름을 새로 하드코딩하지 않으며, 다른 교육원·읽기 전용 직원·익명
요청은 링크 API를 사용할 수 없다. 계정의 지점이 바뀌면 같은 JWT여도 거절한다.

서버의 `PUBLIC_FORM_PATH`와 현재 프론트 origin을 합쳐 `/admissions/ilsan` 링크를
복사한다. 별도 HTML 첨부, 로그인 토큰, 사용자 ID, 지점 쿼리, 학생 정보는 포함하지 않는다.
복사가 성공해야 성공 안내를 표시하고, 클립보드 권한이 거절되거나 기능이 없으면
선택 가능한 읽기 전용 링크를 표시한다.

공유받은 학생은 기존 공개 페이지를 로그인 없이 사용한다. 기존 middleware의
공개 경로 예외와 공개 레이아웃을 그대로 이용하며, 제출은 인증 클라이언트 대신
기존 `submitAdmission`의 공개 fetch를 사용한다. 제출 API는 서버의 기존
`ACADEMY_ID`로만 저장한다. 요청 본문의 지점 값은 저장 지점을 변경하지 못한다.
원서는 암호화 저장되며 담당자가 확인하기 전 학생·청구가 자동 생성되지 않는다.

## 검증 방법과 범위

- `npm ci --ignore-scripts --no-audit --no-fund`와 backend의 동일 명령으로 잠금파일 기준 설치.
- `node backend/node_modules/jest/bin/jest.js --config backend/jest.config.js --runInBand backend/__tests__/services/ilsanAdmissionShareLink.test.js backend/__tests__/models/ilsanAdmission.test.js backend/__tests__/middleware/ilsanAdmissionFileCors.test.js`
- `npm run build`
- `npm run start -- --hostname 127.0.0.1 --port 3187`
- `PACA_ADMISSION_LINK_BASE_URL=http://127.0.0.1:3187 python3 scripts/test-ilsan-admission-mysql.py`
- 변경한 TS/TSX/JS 파일에 ESLint, 전체 `npx tsc --noEmit`, `git diff --check`.

단위/모델/CORS 18개, 격리 MySQL HTTP·브라우저 통합 19개 통과.
production build, 전체 타입 검사, 변경 파일 ESLint도 통과했다.
빌드는 기존 코드의 lint 경고를 출력하며, 변경 파일의 lint 경고·오류는 없다.
브라우저 검증은 실제 production build에서 클립보드를 읽고, 새 익명 컨텍스트에서
그 링크를 열어 모바일 원서를 제출한 뒤 실제 격리 SQL 저장값이 일산인지 확인한다.
PC/태블릿/모바일 공개 접근, 1440/820/390px 버튼 표시·넘침, 복사 거절 시 수동 링크,
다른 지점·읽기 직원·위조된 localStorage의 버튼 비노출, 권한 변경 후 복사 차단을 포함한다.
브라우저 외부 요청은 모두 차단 또는 격리 loopback API로 대체하며 운영 접수는 없다.
스크린샷은 git 제외 경로 `test-results/admission-link/`에 생성한다.
`PACA_ADMISSION_LINK_BASE_URL` 없이 실행하면 새 브라우저 연동 시험은 명시적으로 skip된다.

빠르게 포트를 열고 닫던 기존 Supertest 실행에서 간헐적인 400/401이 관측되어,
격리 통합시험은 시험 전체에서 하나의 loopback listener를 재사용하도록 변경했다.
인증된 합성 요청의 401은 원인을 포함해 즉시 실패시킨다. 운영 인증 코드는 변경하지 않았다.

## 아이작 인계

원래 제공된 작업 사본 `a545d49`에는 기존 입학원서 기능이 없었다.
사용자가 링크 복사 변경만 커밋하도록 확인하여 이 작업 브랜치의 기준만 기존
입학원서 구현 `685a6a4`로 조정했다. 원본 브랜치·다른 작업 사본은 변경하지 않았다.
새 기능 커밋 하나만 기존 입학원서 구현이 있는 대상에 적용한다. 이번 커밋에는
기존 입학원서 전체 구현이나 휴원 복귀 변경이 포함되지 않는다.

이번 기능은 프론트와 인증된 링크 조회 API가 함께 필요하다. 프론트만 적용하면
링크 조회가 실패하여 버튼이 표시되지 않는다. DB migration은 추가하지 않았다.
로컬 검증·커밋 범위이며 운영 배포, push, 원본 브랜치 병합, 실제 학생 접수는 하지 않았다.

## 후속 통합·배포 요청

2026-10-17 사용자의 후속 요청으로 최신 원격 main `9a6e70f`를 이 브랜치에
병합하고 main push 및 운영 배포를 진행한다. 위 로컬 전용 설명은 최초 `a3a3004`
작업 시점의 범위다. 이후 검증·배포 기록은
[main 통합 및 배포](operations/ilsan-admission-link-20261017/README.md)를 따른다.
