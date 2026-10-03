# MCP 퇴원·학원비 정산 운영 배포 결과 — 2026-10-04

PACA·PEAK MCP **0.3.0**, GPT 개인 학원관리 앱 표시 **1.0.2** 적용·검증 완료. 퇴원하면서 청구 취소·감액·실제 완료된 환불 기록을 선택하거나, 이미 퇴원·졸업한 학생의 남은 금액을 별도로 정산할 수 있다. 조회72종·확인변경25종, 실제 공개 도구 PACA19/PEAK10이다. 기존 연결과 계정 정보를 유지했다. PACA 웹 4.0.56은 프론트 변경이 없어 그대로다.

## 동작

퇴원 미리보기는 청구·납부·미납 목록과 정산 후 남는 총 미납금을 표시한다. 청구가 있으면 취소/감액/환불 또는 명시적 유지 결정 없이 적용을 거부한다. 취소는 납부액0원 청구만 가능하며 청구 행을 삭제하지 않는다. 부분 납부는 받은 금액을 보존하고 확인된 총 청구액만 조정한다. 받은 금액 이하로 줄일 때는 실제 완료된 환불 기록이 필요하다. 환불은 순납부액·환불 지출과 변경 전후 정산 이력을 같은 트랜잭션으로 남기며 원본 수입 행을 유지한다. 남겨 둔 미납금은 기존 수납 도구로 납부 처리할 수 있다.

`student_settle` / `preview_student_settlement`는 이미 퇴원·졸업한 학생용이다. `student_withdraw`와 동시에 정산하면 출결 정리·학생 상태·청구·지출·감사 이력·멱등 이력까지 함께 커밋 또는 롤백한다. 원본 변경 시 재미리보기가 필요하고 같은 확인 재시도는 중복 반영하지 않는다.

금융기관 송금·카드 취소나 자동 법정 환불 계산은 실행하지 않는다. 토스 연결 환불은 기존 콜백이 납부액을 자동 갱신하므로 수동 재차감을 차단한다. 원본 카드 취소 후 남은 청구액 조정은 가능하다. 휴원 크레딧·선납 묶음·불명확한 시즌 연결은 원본 정산 화면으로 안내한다.

## 적용 및 검증

- PACA 최종 후보 `bea012be9d6cb2968d41aadcff463cf933dd2bed`, MCP 후보 `e4c2adf5` 및 두 저장소 브랜치·롤백 태그 푸시 완료. 전체 main 소스 교체 없이 후보 파일만 적용했다.
- 최초 19개 대상 운영 해시/신규 경로 부재 일치. 백업 후 교체 직전에 재확인했다. PACA10파일·MCP9파일만 바뀌었고 PEAK backend 정적 소스는 변경0이다.
- PACA `max_engine_payment_settlements` audit table만 additive DDL 적용. 기존 학원 업무 행을 변경하는 배포 SQL은 없다. 최종 audit0행, 실제 학생 confirm0회.
- 백업 `/root/backups/paca-mcp-settlement-20261003T151818Z`: PACA backend·consistent DB dump·기존 MCP 릴리스/포인터·두 OAuth online backup·환경 파일. gzip/tar/SHA-256/SQLite integrity 검증 통과. 운영 데이터·비밀값은 서버에 보관했다.
- 후속 토스 이중 차감 방지 보완 3파일도 현재 소스 해시를 다시 확인하고 별도 코드·DB 백업 `/root/backups/paca-mcp-settlement-gateway-20261003T152832Z` 후 적용했다. 합성 회귀 2건 추가, 최종 백엔드53건(Node18/MySQL8.4 격리) 및 MCP15건(Node22) 통과, skip0. 핵심3파일 statements96.26%, branches91.08%, functions/lines100%, lint·구문·diff검사 통과.
- 신규 토스 회귀의 첫 시도는 합성 결제 이력의 필수 order_id 누락으로 실패했다. 실제 스키마용 합성 fixture를 사용하도록 고치고 전체 영향 테스트를 다시 통과시킨 후 운영 보완을 적용했다.
- 현재 MCP 릴리스 `/opt/max-business-mcp/releases/settlement-20261004-e4c2adf5`. 기존 전용 Node22와 PACA Node18·의존성·systemd/Caddy·환경·OAuth 키를 유지했다. PACA와 양 MCP 재시작 후 네 서비스 active, 공개 health4종 HTTP200.
- 인증된 공개 MCP initialize/tools/list 및 새 정산 미리보기 통과. 기존 퇴원 학생의 미납 청구 취소는 미리보기까지만 검사했다. 실제 GPT 파카 연결의 catalog72/25와 student_settle도 확인했다. 실학생 청구 취소·환불·상태 변경은 이 배포에서 실행하지 않았다.
- 첫 OAuth 대조는 토큰 갱신으로 기존 refresh id3개가 없어져 byte 비교에 실패했다. 정상 회전된 새 토큰의 복호화된 계정·원본 위임·권한·resource·만료시간이 원래와 정확히 같은지 서버 안에서 대조하고 실제 source identity를 재검증했다. 원본 client/preview11건 보존, refresh3건 정상 회전, DB integrity·환경 해시 정상. 인증 자료를 복원하거나 초기화하지 않았다.
- GPT 기존 앱1.0.1을 새버전 업로드로1.0.2로 갱신. 새로고침 후 표시 버전/정산 설명/Primary·파카 연결 보존 확인, 재다운로드한 JSON2파일이 후보와 바이트 단위 일치. 앱 ID·author·기본 프롬프트·연결/공유 범위는 유지했다.

## 롤백

`rollback/paca-mcp-settlement-20261004`가 이전 소스 기준 태그다. 정확한 운영 원본은 첫 서버 백업이다. PACA 후보 경로만 첫 백업에서 복원하고 신규 런타임 파일을 제거한 뒤 MCP current를 `/opt/max-business-mcp/releases/business-20261003-5f68a83e`로 되돌려 서비스를 재시작한다. 실제 청구/환불/정산·OAuth를 덤프로 덮어쓰거나 audit table을 삭제하지 않는다. 이번 배포에서는 롤백 실행이 필요하지 않았다.

상세 근거: [배포 검증 JSON](mcp-settlement-20261004/deploy-verification.json). 로컬 검증: [verification.json](mcp-settlement-20261004/verification.json).
