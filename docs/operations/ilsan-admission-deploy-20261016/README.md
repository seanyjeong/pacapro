# 일산 입학원서 운영 반영 (2026-10-16)

## 범위와 동작

일산 academy 2 공개 원서 접수 → PACA `입학원서` 메뉴에서 담당자가 등록일·수업 요일·월 학원비/할인·일할 금액 확인 → 당일 즉시 또는 해당 날짜 자동 학생 등록. 학생·첫 달 청구·수업 배정과 원서 완료 처리는 한 DB transaction이다. 월 학원비 결제 승인/문자 발송은 하지 않는다. 입력 원서는 암호화한다.

## 검증

- 모델/CORS 10개, 격리 MySQL HTTP·실제 file:// 브라우저 통합 10개 통과.
- 현재 Opus 담당자 디자인을 포함한 독립 production build 통과. 담당자 견적 → 날짜 변경 → 재계산 → 예약 → 취소 브라우저 시험 통과. 외부 API는 합성 응답으로 차단했다.
- 운영 backend 4.0.24: 기존 3개 파일의 현재 운영 기준 해시 일치, 새 파일 10개 경로 부재 확인 후 13개만 반영. 운영 Node18 syntax 검사 통과.
- 백업 `/root/backups/paca-ilsan-admission-20261016T065644704461Z`: 교체 파일·환경·DB gzip 무결성 확인. 환경 변경 없음, paca-failover.service만 재시작.
- 원서 테이블 migration 1개 신규 적용. 운영 합성 접수/학생/청구 작성 0회. 실제 저장·등록 검증은 격리 DB에서 했으며 실제 학생 E2E로 주장하지 않는다.
- 공개 readiness 200, 익명 목록 401, 빈 접수 422. file:// 공개 제출 preflight 204, 인증 승인 경로 Origin:null 예외 없음.
- 다운로드 HTML을 Chrome에서 열어 운영 readiness와 제출 활성화 확인. 실제 제출은 차단했다.
- Mac helper 보고: 실제 HTML 문서 첨부 message_id 42, 안내 41. 수신자 열람 미확인.

## 복구

rollback/paca-ilsan-admission-20261016 태그는 이전 Git 기준30f0ffb. 서버 코드 복구는 백업 code.tgz + manifest 기준으로 교체한 파일만 복원/신규 파일 제거 후 paca-failover.service 재시작한다. 원서 테이블과 접수 데이터는 보존한다. down migration이나 전체 DB 덮어쓰기를 자동 수행하지 않는다. 프론트 배포 상태는 frontend-deployment.json, backend 상세는 backend-deployment.json 참조.

이전 Vercel production 복구 대상: `dpl_3tBbLs8Rao14k4WgZJBweszkiswE` / `pacapro-jc4a33gi9-seanys-projects-4437e034.vercel.app` (배포 직전 조회에서 READY).

## 프론트 운영 확인 완료

프론트 **4.0.59**, Vercel production `dpl_53cHNaf2yZR8whkSK8q8SWYHKxfh` READY와 main `087a81ad274bf205149d84da4e9e76f2d448b2db` 일치, `pacapro.vercel.app` 별칭 연결 확인. 운영 자산을 불러온 브라우저에서 일산 원장 합성 계정 조건으로 `P-ACA v4.0.59`·입학원서 메뉴와 담당자 전체 동작을 확인했다. 이 UI 확인의 API는 합성 응답이며 실제 운영 계정 E2E가 아니다.
