# 맥스엔진 문자 창구 + 동기화 부모 번호

2026-10-11. 맥스엔진 학생·학부모 화면(MYMAX)의 인증번호·초대 링크·알림 문자를 **교육원마다 PACA에 설정된 솔라피·발신번호**로 보내는 엔진 전용 창구다. 사장님 승인 범위: 문자 보내기 연동 + 초대 번호를 PACA 등록 번호로.

- `GET /paca/integrations/max-engine/sms/status?academy_id=` → `{"solapi": bool, "sender_number": bool}`(값은 주지 않음).
- `POST /paca/integrations/max-engine/sms/send` 본문 `{"academy_id": int, "to": "01012345678", "text": str, "purpose": str}` → 200 `{"message_id"}` · 409 솔라피·발신번호 미설정 · 502 솔라피 실패(HTTP 오류 또는 200 응답의 거부 메시지).
- 문은 신규 학생 동기화(`/max-engine/sync/students`)와 같다: `X-Max-Engine-Sync-Key`(= `MAX_ENGINE_SYNC_KEY`), 같은 서버 직접 내부 호출만, `MAX_ENGINE_SYNC_ACADEMY_IDS` 교육원만(403). 새 env·DB 칸 없음.
- 솔라피 설정은 `routes/sms.js`와 같은 표·순서(`notification_settings` service_type=solapi + 키·시크릿(`ENCRYPTION_KEY`) → 기본 솔라피 발신번호 → `solapi_sender_phone`), 발송은 `utils/solapi.sendSMSSolapi`(90바이트 초과 LMS). `sendSMSSolapi` 결과에 `messageId`·`failedCount`를 더했다(기존 호출 영향 없음).
- 로그에는 교육원·목적·종류·결과만 남긴다(번호·본문 없음). `notification_logs`에도 쓰지 않는다.
- 동기화 읽기 행에 `father_phone`·`mother_phone`(복호화, 없으면 null)을 더했다 — 엔진이 초대 번호를 PACA 등록 번호로 채운다.

배포 대상(런타임 7개): `routes/integrations/{index,sms}.js`, `services/{maxEngineSmsService,maxEngineSyncService}.js`, `repositories/{maxEngineSmsRepository,maxEngineSyncRepository}.js`, `utils/solapi.js`. 시험: `__tests__/routes/maxEngineSms.test.js`, `__tests__/utils/solapiSms.test.js`, `__tests__/integration/max-engine-sms-mysql.test.js`(RUN_MAX_ENGINE_MYSQL=1), 동기화 시험 갱신. 실제 문자 발송 시험은 하지 않았다(가짜 솔라피).
