# PACA 업무 위임 토큰 30일 — 운영 기준과 검증

2026-10-01 KST. 사장님 요청으로 `codex-paca-full-token-30d.md` 전체를 읽고 운영 배포를 포함한 작업을 수행한다. 최신 지시대로 오늘 4.0.56 배포 후 현재 운영 소스를 기준으로 삼았다.

- 기준 커밋: `d9eaae308dc70bbc11fecd4abcdd6654c12b50ec` (GitHub main).
- 대상: Vultr `/root/pacapro/backend`, `paca-failover.service`. 최초 확인 active/running, PID 3228801, NRestarts 0.
- 읽기 전용 소스 다운로드 두 번: 선택 파일 405개, 비테스트 292개, 스냅샷 간 차이 0. 비테스트 파일은 전부 기준 커밋과 바이트 단위 동일하다. 기존 운영 테스트와 Git 테스트의 차이 38개는 그대로 보존한다.
- 선택 규칙: `.js`, `.json`, `.sql`, `.mysql`, `.md`; 디렉터리 순회, node_modules/logs/uploads/숨김 파일/환경 파일/백업/인증서/키 제외. 환경·데이터는 내려받지 않았다.
- 선택 파일 경로→SHA256 JSON의 정렬 직렬화 집계: `de10a58af5f3eb1a7546688711927e23e951b40fbde5f59012eb27dc3fde6dba`.
- 기존 `config/maxEngineFull.js` SHA256: `877f432139b92387f133c210d37f8b2d34b9a779e7716495979c4b46e9b45431`.
- 기존 `services/maxEngineFullAuth.js` SHA256: `cf1d3f65288435c317c852a659bd8ccdf331c760dbab703a04d3f88dee8919ae`.

변경 런타임은 `backend/config/maxEngineFull.js` 한 파일의 `tokenSeconds` 3600→2592000뿐이다. scope, MCP 30일, issuer/audience, preview 600초, 확인·감사 로그, 인증 서비스는 그대로다. DB와 프론트 변경 없음, 프론트 4.0.56 유지.

검증: 전용 MySQL 8.4.11, loopback 13319, `/tmp/paca-token30-20261001/mysql.sock`에 합성 데이터만 사용했다. Node 22.20.0 + HTTP keep-alive 비활성 테스트 프로세스에서 전체 Jest 156 suites / 1,272 tests passed, skip 0. 일반/MCP 토큰 발급·30일 만료·2일/29일 유효·30일 만료·계정 비활성/승인 취소/권한/교육원/비밀번호 변경 즉시 거부를 검증했다. 기존 예비생 preview→confirm·업무 트랜잭션·멱등성 회귀도 포함한다. ESLint와 TypeScript `tsc --noEmit` 통과. 최초 Node 25 실행의 기존 HTTP 모의 테스트 간헐 400/401, Node 22 실행의 기존 단일 HTTP 테스트 타임아웃은 최종 실행에서 재현되지 않았다. MySQL 재실행 때 잔존 테이블 오류가 발생해 해당 격리 fixture DB들을 재생성했다. 운영 코드를 이 문제 때문에 바꾸지 않았다.

배포 전 기존 승인 MCP 세션을 서버 안에서만 사용했다. identity/PACA·PEAK catalog/학생 조회 200, MCP 토큰 수명 2592000, 일정 명령 4개 유지, 예비생 preview 200·확인 필요, 전화번호 누락 422, 중복 409, 예비생 행 전후 0, confirm 요청 없음. 토큰·개인정보·키는 출력하지 않았다.

폐기 한계: PACA full API에는 개별 토큰 폐기/로그아웃/연결 해제 endpoint와 폐기 원장이 없다. 클라이언트 연결 해제로 복사된 토큰이 즉시 무효가 되지는 않는다. 계정 조건 변경은 매 요청 재검사하며 기존에 발급된 토큰의 exp는 바뀌지 않는다. 실제 신규 계정 로그인 발급은 승인 계정 비밀번호를 사용하지 않았으므로 운영 E2E로 주장하지 않는다.

최종 운영 결과·백업·되돌리기는 `codex-paca-full-token-30d-result.md` 및 저장소의 별도 배포 결과 문서에 남긴다.
