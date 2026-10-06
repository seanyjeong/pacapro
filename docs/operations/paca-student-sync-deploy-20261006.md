# PACA 학생 자동 동기화 읽기 경로 — 2026-10-06

사장님 승인 및 이번 오케스트레이터 결정에 따라 허용 교육원을 `MAX_ENGINE_SYNC_ACADEMY_IDS`로 확인한다. 공유 키와 허용 목록은 서버 env를 읽기만 한다. 둘 중 하나가 없거나 목록 형식이 잘못되면 전체 경로503, 목록 밖 교육원403, 내부에서 잘못된 키401이다. 외부 socket 및 프록시 전달 헤더는403으로 차단한다.

`GET /paca/integrations/max-engine/sync/students`는 계약의 최소 학생 필드만 복호화하여 반환한다. 삭제 행과 예비생을 포함하며 학생 자료를 쓰지 않는다. 고정된 DB 상한과 수정 시각/id 순서 및 서명 cursor로 페이지당200명을 내준다. 현재 초의 후속 수정을 다음 동기화에서 놓치지 않도록 완료된 초까지만 읽는다. 이 경로는 긴 DB 트랜잭션까지 추적하는 outbox가 아니며, 페이지 조회 중 변경된 행은 다음 동기화에서 반영될 수 있다. 삭제는 deleted_at으로 판단하며 목록 부재만으로 판정하지 않는다.

영향: backend의 신규5파일과 integrations/index.js의 mount1줄. DB migration·프론트 변경은 없다. 수시+정시/운영 프론트4.0.57은 앞 단계에서 이미 반영했다.

검증: 백엔드 전체 Node22 157개 suite/1,267건 통과, 옵트인69건은 별도. Node18+격리 MySQL8.4에서 기존 MCP와 새 HTTP/모델/서비스6개 suite59건 통과. lint 오류0·기존 경고86. 첫 전체 실행의 기존 HTTP 시험 실패 후 수정 없이 최종 전체 재실행 통과; 실패 로그도 보존했다. 새 HTTP 시험은 키/목록503, 잘못된 키401, 교육원403, 외부 전달 헤더403, 삭제/예비생 포함, 동일 시각405행의200/200/5페이지, cursor 범위/변조, 날짜·시간대, 자료 불변 및 복호화/DB 오류 비노출을 검사한다.

운영 절차: 실제 mount 원본 해시와 신규 파일 부재를 두 번 확인한다. `/root/backups/paca-student-sync-<UTC>`에 backend tar와 학생 consistent dump를 남기고 무결성을 검증한다. 후보6파일만 교체하고 paca-failover.service만 재시작한다. 내부/public health, sync 키 미설정503, env hash 및 원본 학생 전체 값 digest를 확인한다. 다른 서비스·env·실제 학생 자료는 수정하지 않는다. 실패하면 backup에서 기존 mount만 복원하고 신규5파일을 제거한 뒤 같은 서비스만 재시작한다.

되돌리기 기준: `rollback/paca-student-sync-20261006` 태그. 이전 both migration을 축소하거나 학생 값을 바꾸지 않는다. 프론트4.0.57을 되돌릴 필요는 없다.

실제 운영 반영 결과는 이 문서 아래와 `paca-student-sync-20261006/deploy-result.json`에 추가한다.
