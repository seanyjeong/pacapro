# 일산 입학원서 링크 복사 main 통합 및 배포

## 통합 기준

- 기능 커밋 `a3a3004`에 최신 원격 main `9a6e70f`를 병합한다.
- 로컬 `main`은 과거 `051f8c1`이었으므로 원격을 fetch해 확인했다. 이번 병합은 자동으로 해결됐으며 미해결 충돌이 없다.
- 요청된 `backend/routes/students/crud/update.js`, `backend/routes/students/rest/resume.js` 및 대응 테스트 두 파일은 `9a6e70f`와 바이트 단위로 동일하다.
- 학생 수정의 정식 복귀 API 사용, 일반 paused→active 전환 차단, 크레딧·청구·출결 원자 처리, 같은 달 청구 복원과 시즌 무료수업 제외 조건을 보존한다.
- 링크 복사 구현은 `a3a3004` 그대로 유지한다. 새 프론트 릴리스는 4.0.62다.

## 검증

- 영향 범위 Jest 11 suites / 136 tests 통과.
- 전체 backend Jest: 174 suites / 1,417 tests 통과, 환경 의존 통합시험 등 12 suites / 140 tests 명시적 skip.
- 전체 실행은 backend 디렉터리에서 Node 24와 `test-http-environment.cjs` preload를 사용했다. 기존 Supertest 시험의 짧은 임시 포트 수명과 풀 연결 재사용을 분리하며, 테스트 assertion이나 운영 HTTP 설정은 바꾸지 않는다.
- 실행: `npm exec --yes --package=node@24 -- node --require ../docs/operations/ilsan-admission-link-20261017/test-http-environment.cjs node_modules/jest/bin/jest.js --runInBand`
- 최초 Node 25 전체 실행은 기존 webhook/알림/학생 생성/시간대 시험에서 간헐적인 400을 반환했다. 해당 4 suites / 64 tests 단독 재실행은 통과했다. 최초 실행을 전체 성공으로 취급하지 않는다.
- 링크의 격리 MySQL HTTP·실제 브라우저 시험 19개 및 학생 수정·상세 복귀 스모크(390/768/1365px)를 실행한다. 합성 원서는 격리 DB에만 제출한다.
- production build, `tsc --noEmit`, 전체 lint 오류 0건, hotfix gate 테스트 22개 통과. 기존 lint 경고는 유지한다.

## 배포 범위와 복구

- GitHub Actions workflow는 없으며 프론트 Vercel `pacapro`가 `seanyjeong/pacapro`의 `main`에 연결돼 있다.
- Vultr `/root/pacapro/backend`, `paca-failover.service`를 현재 실행 상태로 확인했다. backend package version은 4.0.26을 유지하며 코드 SHA와 해시로 이번 hotfix를 식별한다.
- backend 교체 범위는 `constants/ilsanAdmission.js`, `routes/ilsanAdmissions.js`, `services/ilsanAdmissionService.js` 3개뿐이다. 학생 수정·복귀 파일을 운영에 덮어쓰지 않는다.
- `deploy.py --check`는 기존 3개 파일 해시, 미변경 런타임 해시, 서비스 경로, 입학원서 테이블 존재, Node 18 문법을 검증한다. 환경·의존성·스케줄러·DB schema 변경 없음.
- `ET_ALLOW_PRODUCTION=1 python3 /tmp/paca-admission-link-20261017/deploy.py --apply`는 코드·환경·DB 백업과 무결성 검사 후 3개 파일만 반영한다. PACA만 재시작하고 공개/내부 health, 익명 링크 API 401, 공개 접수 readiness를 확인한다.
- 복구 태그: `rollback/ilsan-admission-link-20261017-4.0.61`. 실패 시 checksum 검증한 코드만 원복한다. DB 복원·학생 접수/복귀/청구 쓰기를 실행하지 않는다.
- backend 확인 후 main을 push하여 Vercel production 배포를 기다린다. 실제 일산 계정에서 링크 복사를 확인하고 공개 원서는 제출하지 않는다.
- 실행 영수증·배포 결과는 로컬 git 제외 경로 `test-results/admission-link-deploy/`에 보관하며, 최종 결과는 별도 `RESULT.md`에 정리한다.
