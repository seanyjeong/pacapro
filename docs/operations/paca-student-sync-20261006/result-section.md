## 자동 동기화 읽기 — 운영 반영 완료

앞 단계에서 교육원 동의 원본을 확인할 경로가 없어 잠시 보류했다. 이번 오케스트레이터 결정으로 PACA env `MAX_ENGINE_SYNC_ACADEMY_IDS` 허용 목록을 권한 원본으로 확정했고 공유 계약의 범위 문단도 수정했다. 오케스트레이터가 `branch_external_links` 기준으로 서버에 값을 넣는다. PACA 코드는 공유 키와 허용 목록을 읽기만 한다. 누락/빈 목록/잘못된 목록은 경로 전체503, 목록 밖 교육원403, 틀린 키401. loopback 직접 호출만 허용하고 외부/프록시 전달 헤더는403.

2026-10-06 **19:18:23 KST** 후보6파일만 반영하고 PACA만 재시작했다. 백업 `/root/backups/paca-student-sync-20261006T101815Z`, 태그 `rollback/paca-student-sync-20261006`, 후보 커밋 `14ef6d99e204531f6b10b99caa5b4ee5f694aa97`. DB migration 재실행·프론트 재배포 없음(프론트4.0.57 유지). source guard 두 번과 후보 해시 parity, 백업 무결성 확인. 기존 학생2,072행의 전체 값 digest와 env hash 전후 일치. 실제 학생 수정0, 키/허용 목록 생성·입력0.

내부/public health200, CORS 정상, sync 내부와 공개 URL 모두 **503/SYNC_DISABLED** 확인. PEAK health/uptime 정상, MCP0.3.0 유지. 최종 backend 전체1,267건 통과(옵트인69건은 별도), 운영 Node18/격리 MySQL8.4의 기존 MCP+신규 HTTP/모델/서비스59건 통과. lint 오류0·기존 경고86. 초기 전체 실행의 기존 HTTP 실패 후 코드 변경 없이 최종 전체 재실행 통과했고 실패도 기록했다. 이전 프론트 type/build/browser 증거는 입력이 그대로라 유효하다.

삭제된 행·예비생 포함, 수정시각/id 순서로 최대200명씩 읽으며 고정 상한·서명 cursor로 페이지를 이어간다. 동일 시각405행을200/200/5로 조회하고 자료 불변을 검사했다. 복호화 실패·DB 오류는 원문/암호문 노출 없이503. 현재 초의 후속 수정은 다음 scan에서 받도록 완료된 초를 상한으로 쓰며 삭제는 `deleted_at`으로 판단한다. 페이지 조회 중 바뀐 행은 후속 동기화에서 반영될 수 있으며 이 경로가 긴 트랜잭션까지 추적하는 outbox는 아니다.

운영 공유 키와 허용 목록은 아직 미설정이므로 경로는 비활성이다. 오케스트레이터가 값을 넣고 PACA 서비스를 다시 읽게 한 뒤 엔진 호출을 시작할 수 있다. 허용 키를 통한 읽기 성공은 격리 MySQL의 합성 자료로 검증했으며 운영 키를 쓰는 실제 엔진 E2E를 수행했다고 보고하지 않는다. 자세한 근거는 `paca-student-sync-20261006/deploy-result.json`, `verification.json`, `test-results.txt`에 있다.

되돌리기: 이 백업의 `backend.tgz`를 별도 디렉터리에 풀어 기존 `backend/routes/integrations/index.js`만 복원하고 manifest에서 before=null인 신규5파일을 제거한다. `systemctl restart paca-failover.service` 후 health를 확인한다. env·학생 자료·both ENUM·프론트는 덮어쓰지 않는다. 실패 시 자동 rollback도 같은 방식이다.
