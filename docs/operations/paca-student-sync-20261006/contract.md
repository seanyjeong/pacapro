# PACA → 맥스엔진 학생 자동 가져오기 — 양쪽 계약 (2026-10-06, 사장님 결정)

## 사장님 결정
- PACA 에 신규 학생이 생기면 엔진에 **자동으로**(10분마다) + **버튼으로 바로** 불러오기.
- 같은 학생 기준 = **이름 + 학교 + 성별**. 엔진에 이미 있으면 **내버려 둠**(엔진 자료 안 바꿈, PACA 연결만). 이름·학교·성별이 같은 엔진 학생이 여럿이면 **전화번호**로 구분(전화번호는 필수 아님 — 엔진에 없는 학생 많음). 그래도 못 가리면 **원장 확인 필요** — 원장이 '기존 학생과 연결 / 새 학생으로 저장 / 다른 이름으로 저장 / 건너뛰기' 중 골라 실행.
- PACA 에서 지워도 엔진에서는 **안 지움**(지금처럼 연결만 끊고 기록).
- PACA 입시유형에 **'수시+정시'** 추가 → 엔진 트랙: 수시 = 수시, 정시 = 정시, 수시+정시 = 둘 다. 선행반·사관학교·경찰대는 **가져옴**, **공무원은 안 가져옴**.
- PACA 운영 서버 변경 **승인**("파카 운영서버 변경 수락할게").

## PACA 가 새로 내줄 것 (읽기 전용)
`GET {PACA_BUSINESS_URL}/paca/integrations/max-engine/sync/students?academy_id=<int>&updated_since=<ISO8601|생략>&cursor=<opaque|생략>`
- 인증: 헤더 `X-Max-Engine-Sync-Key: <공유 비밀>` — PACA env `MAX_ENGINE_SYNC_KEY`, 엔진 env `PACA_SYNC_KEY`(같은 값, 오케스트레이터가 서버에서 만들어 두 env 에 넣음, 값 출력·커밋 금지). 상수 시간 비교. 키 없으면 이 경로 전체 비활성(503).
- 범위: PACA env `MAX_ENGINE_SYNC_ACADEMY_IDS`의 쉼표 구분 양의 정수 academy id 허용 목록으로 확인한다. 목록에 없는 `academy_id`는 403. env가 없거나 비어 있거나 형식이 잘못되면 경로 전체를 비활성화(503)한다. 오케스트레이터가 엔진 `branch_external_links`를 기준으로 서버 env에 공유 키와 허용 목록을 넣으며 PACA 코드는 읽기만 한다(값 생성·출력·커밋 금지). 같은 서버의 loopback 주소로 직접 호출해야 한다. `PACA_BUSINESS_URL`은 내부 주소를 사용하고 공개 프록시 경유 요청·전달 헤더가 있는 요청은 403으로 차단한다. 기존 business 경로의 공개 로그인 인증과 별개로 이 경로는 외부 접근을 허용하지 않는다.
- 응답: `{"items":[{"paca_student_id":int,"academy_id":int,"name":str,"gender":"male|female|null","school_name":str|null,"grade":str|null,"phone":str|null,"parent_phone":str|null,"admission_type":"early|regular|both|advance|military_academy|police_university|civil_service|null","status":str,"deleted_at":ISO|null,"updated_at":ISO}], "next_cursor": str|null, "server_time": ISO}`
  - `updated_since` 이후 바뀐(생성·수정·삭제 포함) 학생만, `updated_at` 오름차순, 쪽당 최대 200. 같은 수정 시각은 학생 id 오름차순으로 구분한다. 각 페이지의 `server_time`은 첫 페이지의 고정 상한이며 cursor와 함께 최초 `updated_since`를 계속 보내야 한다. 초 단위 source TIMESTAMP의 현재 초 후속 변경이 누락되지 않도록 상한은 DB 현재 시각의 직전 완료된 초(최대 약 2초 지연)로 잡는다. 마지막 페이지까지 성공했을 때만 그 `server_time`을 다음 동기화의 `updated_since`로 저장한다. 이 경로는 트랜잭션 snapshot이 아니므로 페이지 조회 사이에 바뀐 행은 후속 동기화에서 반영될 수 있다.
  - 삭제된 학생도 `deleted_at` 과 함께 내준다(엔진은 연결만 끊고 기록).
  - 예비생(prospect)도 포함(status 그대로).
- 삭제 여부는 명시적인 `deleted_at`으로 판단한다. 이 상한 적용 목록에서 행이 보이지 않는 것만으로 삭제로 판정하지 않는다.
- 쓰기 없음. 학생 주민번호·생년월일 등 이 목록 밖 개인정보는 싣지 않는다.
