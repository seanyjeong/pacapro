# 엔진 등록·수정의 부모 연락처

2026-10-02. `student_create`·`student_update`는 선택 `father_phone`·`mother_phone`을 받는다. 일반 학생 등록의 `studentParentContactService`를 재사용하며 숫자만 입력한 번호는 `010-1234-5678` 형식으로 정규화하고 암호화 저장한다. 형식 오류는 동일한 아버지/어머니 전화번호 안내와 HTTP 422로 거부한다.

두 칸 모두 빈 문자열·공백·null이어도 등록할 수 있다. 칸 생략은 등록 시 NULL 기본값, 수정 시 기존 값 유지; 빈 값/null은 제공한 칸만 지운다. 기존 대표 `parent_phone`은 그대로이며 양쪽 번호로 자동 변경하지 않는다. 기존 부모 이름 처리도 유지한다. 미리보기에서 정규화된 값을 확인한 뒤 확정해야 저장된다. 확인 재시도·교육원 범위·서명 토큰 30일 규칙은 그대로다.

```json
{"operation":"student_create","changes":{"name":"합성예비","phone":"01011112222","enrollment_date":"2026-10-02","registration_source":"max_engine","father_phone":"01012345678","mother_phone":null}}
```

기존 운영 nullable VARCHAR(512) 칸을 사용하므로 DB migration은 없다. 운영 시험은 catalog/preview만 호출하고 confirm은 보내지 않는다. 합성 격리 MySQL에서 양쪽·한쪽·빈 값·null·생략·형식 오류와 부분 수정·멱등성을 시험한다. 배포 대상은 `constants/maxEngineCommands.js`, `services/maxEngineFullStudents.js`, `services/maxEngineFullCommands.js` 세 파일이며, 기존 소스 해시 재확인·개별 파일 체크섬 백업·롤백 태그 후 적용한다. 실패하면 체크섬 백업 세 파일을 복원하고 `paca-failover.service`만 재시작한다. 코드 롤백 시 저장된 부모 연락처와 DB 칸을 보존한다. 프론트 소스·버전 변경 없음(4.0.56).
