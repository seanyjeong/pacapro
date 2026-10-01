# 엔진 부모 연락처 운영 배포 사전 검증

2026-10-02 KST. `paca-parent-phones.md` 전체와 DEPLOYMENT.md를 읽고 사장님의 현재 운영 변경 승인을 기준으로 진행한다. 운영 학생 쓰기 시험은 금지한다.

기준 GitHub main은 `b45e0aa2ade6d2618f15803a4895df9534aaf743`, 프론트 4.0.56이다. Vultr `/root/pacapro/backend` 읽기 전용 스냅샷 선택 파일 405개, 비테스트 292개가 이 기준과 바이트 단위 동일했다. 운영 테스트와 Git 테스트의 기존 차이 38개는 유지한다. 환경 파일·숨김 파일·키/인증서·의존성·로그·업로드·백업은 다운로드하지 않았다. `paca-failover.service` active, PID 3414096, NRestarts 0. 학생 두 전화번호 칸은 이미 nullable VARCHAR(512)다. Vultr cron/unit의 활성 legacy incoming sync 후보는 검출되지 않았다.

변경 실행 파일은 세 개뿐이다:

- `backend/constants/maxEngineCommands.js`: create/update profile의 선택 두 전화번호.
- `backend/services/maxEngineFullStudents.js`: 기존 `studentParentContactService`의 전화번호 규칙·암호화 재사용, 기존 이름/대표번호 처리 유지.
- `backend/services/maxEngineFullCommands.js`: 미리보기·확인 전 같은 서비스로 번호 검증·정규화.

시험은 합성 데이터 전용 MySQL 8.4.11 loopback 13319와 임시 소켓을 사용했다. 부모 연락처 집중 3 suites/43 tests 통과. 양쪽/아버지만/어머니만/빈 값/null/생략 등록, 잘못된 형식 422, 대표번호 암호화 보존, 부분 수정/한 칸 삭제/옛 요청 보존, preview 무변경, confirm 멱등성 증거를 포함한다.

전체 회귀 검증은 운영과 같은 Node 18.19.1에서 155 suites/1,267 tests 통과, 내장 `node:sqlite`를 요구하는 기존 두 suite는 Node 22.20.0에서 23 tests 통과했다. 합계 **157 suites/1,290 tests**, 생략 시험 없음. 이 수치는 단일 Node 전체 실행 결과가 아니라 두 런타임의 통과 증거 합계다. Node 22 전체 실행에서 기존 HTTP 모의 시험의 간헐 400 등이 재현됐고, Node 18에서는 기존 명단 경계 시험이 한 재실행에서 timeout을 보였다. 해당 시험을 따로 재실행해 통과했다. 운영 코드는 이를 이유로 바꾸지 않았다. Node 18은 기존 두 SQLite fixture를 실행할 수 없다는 제한을 Node 22 실행으로 해결했다.

ESLint, TypeScript, Next.js production build 통과. 기존 학생 부모 전화번호 화면 스모크 desktop/mobile 8건 통과(합성 API, 운영 mutation 0). Hotfix scope/metadata 자체 시험 22건 통과, 최종 변경 범위 gate **100/100**. 실행 파일 길이 51/46/106줄로 500줄 이하. 문서는 hotfix 허용 `docs/` 아래에 기록했다.

공식 저장소 CORS writer/audit를 임시 증거 root로 실행해 PACA 로그인·PEAK 로그인·PEAK socket 3 preflight와 증거 감사가 통과했다. 기존 요청 인증, 30일 쓰기 토큰, 교육원 범위, preview→confirm, 감사 로그, DB schema, 프론트 소스·버전은 변경하지 않는다. 배포 직전 운영 파일 전체 해시 재확인·개별 파일 SHA256 백업·롤백 태그 후 세 파일만 교체한다. 사후 실제 catalog/합성 preview와 잘못된 형식 거절을 확인하며 운영 confirm은 보내지 않는다.
