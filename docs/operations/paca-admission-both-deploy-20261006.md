# PACA 수시+정시 운영 반영 — 2026-10-06

**수시+정시(both) 운영4.0.57과 교육원 허용 목록 기반 자동 동기화 읽기 경로 모두 운영 반영·검증 완료.** 사장님의 이번 운영 반영 승인으로 PACA 관련 변경만 적용했다.

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

## 자동 동기화 읽기 — 운영 반영 완료

앞 단계에서 교육원 동의 원본을 확인할 경로가 없어 잠시 보류했다. 이번 오케스트레이터 결정으로 PACA env `MAX_ENGINE_SYNC_ACADEMY_IDS` 허용 목록을 권한 원본으로 확정했고 공유 계약의 범위 문단도 수정했다. 오케스트레이터가 `branch_external_links` 기준으로 서버에 값을 넣는다. PACA 코드는 공유 키와 허용 목록을 읽기만 한다. 누락/빈 목록/잘못된 목록은 경로 전체503, 목록 밖 교육원403, 틀린 키401. loopback 직접 호출만 허용하고 외부/프록시 전달 헤더는403.

2026-10-06 **19:18:23 KST** 후보6파일만 반영하고 PACA만 재시작했다. 백업 `/root/backups/paca-student-sync-20261006T101815Z`, 태그 `rollback/paca-student-sync-20261006`, 후보 커밋 `14ef6d99e204531f6b10b99caa5b4ee5f694aa97`. DB migration 재실행·프론트 재배포 없음(프론트4.0.57 유지). source guard 두 번과 후보 해시 parity, 백업 무결성 확인. 기존 학생2,072행의 전체 값 digest와 env hash 전후 일치. 실제 학생 수정0, 키/허용 목록 생성·입력0.

내부/public health200, CORS 정상, sync 내부와 공개 URL 모두 **503/SYNC_DISABLED** 확인. PEAK health/uptime 정상, MCP0.3.0 유지. 최종 backend 전체1,267건 통과(옵트인69건은 별도), 운영 Node18/격리 MySQL8.4의 기존 MCP+신규 HTTP/모델/서비스59건 통과. lint 오류0·기존 경고86. 초기 전체 실행의 기존 HTTP 실패 후 코드 변경 없이 최종 전체 재실행 통과했고 실패도 기록했다. 이전 프론트 type/build/browser 증거는 입력이 그대로라 유효하다.

삭제된 행·예비생 포함, 수정시각/id 순서로 최대200명씩 읽으며 고정 상한·서명 cursor로 페이지를 이어간다. 동일 시각405행을200/200/5로 조회하고 자료 불변을 검사했다. 복호화 실패·DB 오류는 원문/암호문 노출 없이503. 현재 초의 후속 수정은 다음 scan에서 받도록 완료된 초를 상한으로 쓰며 삭제는 `deleted_at`으로 판단한다. 페이지 조회 중 바뀐 행은 후속 동기화에서 반영될 수 있으며 이 경로가 긴 트랜잭션까지 추적하는 outbox는 아니다.

운영 공유 키와 허용 목록은 아직 미설정이므로 경로는 비활성이다. 오케스트레이터가 값을 넣고 PACA 서비스를 다시 읽게 한 뒤 엔진 호출을 시작할 수 있다. 허용 키를 통한 읽기 성공은 격리 MySQL의 합성 자료로 검증했으며 운영 키를 쓰는 실제 엔진 E2E를 수행했다고 보고하지 않는다. 자세한 근거는 `paca-student-sync-20261006/deploy-result.json`, `verification.json`, `test-results.txt`에 있다.

되돌리기: 이 백업의 `backend.tgz`를 별도 디렉터리에 풀어 기존 `backend/routes/integrations/index.js`만 복원하고 manifest에서 before=null인 신규5파일을 제거한다. `systemctl restart paca-failover.service` 후 health를 확인한다. env·학생 자료·both ENUM·프론트는 덮어쓰지 않는다. 실패 시 자동 rollback도 같은 방식이다.


## 되돌리기

서버 백업에서 후보 runtime 파일만 복원하고 paca-failover.service를 재시작한다. 프론트는 이전 READY deployment pacapro-4truxt09j-seanys-projects-4437e034.vercel.app로 되돌린다. ENUM 축소나 학생 값 치환·DB 덤프 덮어쓰기는 하지 않으며, 새로 입력된 both도 보존한다.

근거: paca-admission-both-20261006/verification.json, deploy-both-result.json, both-manifest.json, vercel-candidate.json, browser-production.log. 완료된 전체 진행 결과는 CODEX-PACA-ADMISSION-BOTH-RESULT.md에 기록했다.
