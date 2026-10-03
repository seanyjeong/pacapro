# GPT PACA·PEAK MCP 0.2.0 운영 배포 결과

2026-10-03 사장님의 현재 메시지 `mcp 운영배포를 해줘` 승인으로 Vultr 운영 반영을 완료했다. 대상은 `https://paca-mcp.supermax.kr/mcp`와 `https://peak-mcp.supermax.kr/mcp`다. **MCP 0.2.0 운영 배포·인증 검증 완료**. 프론트 변경이 없어 PACA 웹 4.0.56과 Vercel 배포는 그대로다.

## 적용 및 운영 보존

- PACA 후보 `fec5c7121b6e65467113445e1a9a169c4bcc004f`, MCP 후보 `5f68a83ea2df56c4ee8ab1dc661cb6dba1f43d86`. 두 `codex/mcp-business` 브랜치에 푸시되어 있다. main 전체 소스 교체·병합은 하지 않았다.
- 새 소스 검사: 22개 대상 모두 원래 운영 해시 또는 신규 경로 부재와 일치. 업로드 두 압축 파일의 검증 당시 SHA-256도 일치.
- 서버 백업: `/root/backups/paca-mcp-business-20261003T135828Z`. 전체 PACA backend, PEAK DB consistent dump, 기존 MCP 릴리스/포인터, 두 OAuth SQLite online backup 및 환경 파일. tar/gzip 읽기·SHA-256·SQLite integrity_check 통과. 비밀값이나 운영 DB 덤프는 로컬/저장소로 가져오지 않았다.
- PEAK에만 `20261003_peak_max_engine_commands.sql` 적용: InnoDB ledger와 academy lock 2개 테이블 생성. 기존 업무 행 변경 SQL 없음. 배포 검증 종료 시 두 신규 테이블 모두 0행.
- PACA 16개 파일(신규 migration 포함)만 교체. 원본 정적 소스 전체 비교에서 이 16개만 변경됐고 PEAK backend 정적 소스는 변경 0개. `paca.js`, 기존 일반 라우트/bridge/cron 및 의존성을 보존했다. 회전 로그 JSON은 코드 비교에서 제외했다.
- 기존 MCP 운영 릴리스를 복사하고 6개 후보 파일만 적용. 새 current는 `/opt/max-business-mcp/releases/business-20261003-5f68a83e`. 의존성 재설치, Caddy/systemd/env/스토리지 키 변경 없음. 전용 Node **22.23.2** 유지; PACA Node18 유지.
- 양쪽 기존 유효 OAuth entries(파카 9, 피크 4)의 암호화 payload/만료시간 일치와 integrity_check 확인. 환경 파일 해시도 백업과 일치. 검사 때 만든 일시적 read-only access와 합성 preview receipt는 종료 후 제거했다.
- 폐기된 N100 자동 failover cron은 disabled 상태였다. 해당 서버에 접속하지 않았다.

## 검증

이 후보의 기존 검증 입력은 변경되지 않았으며 로컬 120건(backend 영향 70 + 기존 라우트 37 + MCP 프로토콜 13), lint 및 구문 검사 통과 근거를 재사용했다. 배포 파일 구문 검사와 후보 해시 일치를 별도 확인했다.

공개 MCP 두 제공자에 기존 연결 위임을 인증 재확인하고 일시적인 읽기 scope로 실제 MCP initialize/tools/list/tools/call을 수행했다.

| 항목 | PACA | PEAK |
|---|---:|---:|
| 실제 서버 버전 | 0.2.0 | 0.2.0 |
| 도구 | 18 | 9 |
| 허용 조회 자료 | 71 | 71 |
| 확인 변경 작업 | 24 | 24 |
| 합성 학생 생성 미리보기 | 통과 | 통과 |
| 존재하지 않는 학생의 퇴원·복귀 요청 | 안전하게 거부 | 안전하게 거부 |

`preview_student_withdraw`, `preview_student_reactivate`가 실제 도구 목록에 존재한다. PACA의 PEAK 기록/순위/향상도 도구 3개도 노출됐다. 미리보기는 합성 입력만 사용했으며 `confirm_change` 호출은 **0건**이다. 실학생 조회 상세나 개인정보를 출력/보관하지 않았다.

연결된 GPT용 **학원관리 → 파카**의 `list_capabilities`를 실제 호출해 `isError=false`, resources=71, commands=24, student_withdraw/student_reactivate=true를 확인했다. 사용자의 ChatGPT 화면에서 새로고침 버튼을 누르는 작업은 수행하지 않았다. 새 전용 도구를 반영하려면 해당 MCP 연결의 도구 새로고침 후 새 대화를 시작하면 된다.

PACA·PEAK·두 MCP 서비스 모두 active. 공개 PACA/PEAK health와 두 MCP health 모두 HTTP200. 마지막 검증에서 후보 22개 파일의 해시와 백업 무결성, 기존 연결 보존을 확인했다. 퇴원·복귀 같은 업무 실행은 사용자의 미리보기 검토와 개별 확인이 필요한 기존 계약을 유지한다.

## 첫 시도 중단과 재적용

첫 교체 후 배포 스크립트가 내부 PACA에 `/paca-health`를 요청해 404를 받았다. 내부 정상 경로는 `/health`이며 공개 Caddy 경로가 `/paca-health`다. 이 오류는 제가 작성한 배포 검증 스크립트의 경로 오류였다. 스크립트는 이전 PACA 파일·MCP 포인터로 자동 복원하고 서비스들을 재시작했다. 신규 테이블은 보존했다.

로그로 서비스 시작·DB 연결 정상과 내부 `/health` HTTP200, 공개 `/paca-health` HTTP200을 확인했다. 소스 해시를 원래 manifest와 다시 비교하고 신규 테이블 구조를 최초 DDL 결과와 대조한 뒤, 헬스체크 경로만 수정해 재적용했다. 이후 공개 인증 도구 목록·미리보기·연결 보존 검증까지 통과했다. 운영 업무 구현을 이 과정에서 수정하지 않았다.

검증 실행기 초기 SDK import 경로 오류는 패키지 exports 기반 require로 고쳤고, 원본 전체 비교에 섞인 회전 로그 JSON은 정적 소스 범위에서 분리했다. 두 검증 모두 다시 통과했으며 최종 성공 증거만 아래 JSON에 집계했다.

## 롤백

두 저장소에 `rollback/paca-mcp-business-20261003` 태그를 푸시했다(PACA 기준5175913, MCP 기존 schedule909ff643). 정확한 운영 원본은 체크섬 백업이다. PACA 변경 파일만 백업에서 복원하고 신규 후보 경로를 제거한 뒤 기존 MCP current `/opt/max-business-mcp/releases/schedule-20260930-909ff643`로 되돌려 PACA·두 MCP를 재시작한다. 이미 반영된 업무 행·OAuth 저장소·새 ledger/lock 테이블은 삭제하거나 DB 덤프로 덮어쓰지 않는다. 첫 실패에서 실제 runtime 복원과 이전 포인터·health 정상화를 확인했다.

근거: [배포 검증 JSON](paca-mcp-business-deploy-20261003.json). 미지원 쓰기(휴원 정산, 시즌 청구, 환불/청구 취소, 문자, 급여, PEAK 배정·시험 기록)는 기존 후보 계약과 동일하다.
