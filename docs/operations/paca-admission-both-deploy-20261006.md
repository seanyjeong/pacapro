# PACA 수시+정시 운영 반영 — 2026-10-06

**수시+정시(both)는 운영 4.0.57 반영·검증 완료. 자동 동기화 읽기 경로는 미완료이며 배포하지 않았다.** 사장님의 이번 운영 반영 승인으로 PACA 관련 변경만 적용했다.

## 반영

- 학생 등록/수정·필터·상세/목록·엑셀 출력의 공통 타입에 both / 수시+정시 추가. 엑셀 가져오기도 같은 값 인식.
- MCP 학생 생성/수정 admission_type을 실제 저장하고 검증한다. 기존 상담 기록의 both 허용과 학생 저장을 구분했다.
- 자동/수동 진급은 both를 유지한다. 유형별 통계는 기존 GROUP BY로 both를 별도 항목에 한 번 집계하며 전체 수를 중복 합산하지 않는다. 반·시즌의 별도 유형은 바꾸지 않는다.
- students.admission_type 기존 ENUM 순서/nullable/default/charset/collation을 보존해 마지막에 both를 INSTANT 추가했다. 실제 학생2,072행 전체 값 digest가 전후 일치했고 실제 학생 수정은0건이다.

## 배포·검증

원본 해시 재검사 후 /root/backups/paca-admission-both-20261006T084311Z에 backend와 학생 테이블 consistent dump를 백업했다. gzip/tar 및 SHA-256, 별도 복원 DB에서 전체 학생 값 digest 비교를 통과한 후 그 임시 DB만 삭제했다. 2026-10-06 17:43:18 KST backend/DB 반영, 후보6파일만 교체하고 paca-failover.service만 재시작했다. 공개 health와 CORS 정상, MCP 서버0.3.0 유지. 환경·키·PACA 이외 서비스는 변경하지 않았다.

rollback/paca-admission-both-20261006 태그와 후보 브랜치를 푸시했다. 백엔드 정상 확인 후 main7cd8d7d를 푸시했고 Vercel Production의 같은 Git SHA READY를 확인했다. pacapro.vercel.app 별칭이 새 deployment로 연결됨을 확인했다. 운영 프론트 asset에서 합성 읽기 응답으로 desktop/mobile 등록 선택지·수정값 유지·필터 요청을 검사했다. 실제 운영 계정으로 로그인한 화면 검증은 로그인 상태가 없어 수행하지 않았으며, 합성 검증을 실제 계정 E2E로 보고하지 않는다.

Backend 전체 Node22 1,265건 통과(옵트인63건 별도), Node18/격리MySQL8.4 영향 통합48건 통과, frontend Node29건·lint 오류0(기존 경고86)·tsc·build 통과. Cursor/key/internal-access primitive 모델3건도 로컬 통과했지만 sync HTTP endpoint 검증은 아직 아니다.

첫 운영 preflight는 출력 파서가 빈 column comment를 strip해 메타데이터 배열 길이가 달라 중단했다. DB·코드를 바꾸기 전이었다. 빈 마지막 필드를 보존하도록 파서를 고치고 원본 해시/메타데이터를 재확인한 뒤 적용했다. 실제 운영 소스나 schema가 예상과 달랐던 것은 아니다.

기존 full-cutover 감사도 읽기 실행했다. 이전 redesign-lab 문서 문구 누락 및 PACA/PEAK 외 여러 소비자의 오래된 환경·CORS/CSP/JS 증거 때문에3개 gate가 실패했다. 이 결과를 통과로 표시하지 않았다. 이번 승인된 PACA additive ENUM 반영에는 요청된 동일 백업·되돌리기 태그·해시검사·재시작 절차와 실제 복원/자료보존 검증을 적용했고, 다른 프로젝트 환경 정리나 full-cutover는 실행하지 않았다.

## 미완료: 자동 동기화 읽기

계약 paca-sync-contract.md의 ‘연동을 허락한 교육원만, 다른 교육원403’을 확인할 기록은 엔진의 branch_external_links/business_delegations에 있다. PACA에 해당 허용 기록이 없으며 max_engine_commands는 업무 감사 이력이라 동의 기록으로 간주할 수 없다. 다른 에이전트의 현재 sync client도 계약대로 공유 키만 보내며 교육원 연결 토큰을 보내지 않는다. 계약을 임의로 바꾸거나 전체 교육원을 열지 않았다.

키/날짜/cursor 모델과 삭제·예비생 포함 SQL 페이지 조회를 로컬에 준비했지만 라우트·교육원 허용 검사·HTTP 통합 시험은 아직 구현 완료되지 않았다. 이 파일들은 배포/main 푸시에 포함하지 않았다. 실제 MAX_ENGINE_SYNC_KEY를 만들거나 env에 넣지 않았다. 현재 운영 sync/students 경로가 완성됐거나 키 없이503 검증됐다고 보고하지 않는다. 권한 확인 원본을 PACA가 읽는 API/조회 경로나 확정된 범위 전달 방법을 사용자에게 질문했으며 답이 필요하다. 완료 신호 codex-paca-both-done은 아직 보내지 않았다.

## 되돌리기

서버 백업에서 후보 runtime 파일만 복원하고 paca-failover.service를 재시작한다. 프론트는 이전 READY deployment pacapro-4truxt09j-seanys-projects-4437e034.vercel.app로 되돌린다. ENUM 축소나 학생 값 치환·DB 덤프 덮어쓰기는 하지 않으며, 새로 입력된 both도 보존한다.

근거: paca-admission-both-20261006/verification.json, deploy-both-result.json, both-manifest.json, vercel-candidate.json, browser-production.log. 계약 확인 대기 사항을 포함한 전체 진행 결과는 CODEX-PACA-ADMISSION-BOTH-RESULT.md에 기록했다.
