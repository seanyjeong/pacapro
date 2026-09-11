# 공용 브릿지 상담 쓰기

상담 예약 등록과 일정·메모 수정, 삭제를 공용 브릿지에 연결한다. 브릿지 입력으로 상태,
연결 학생이나 성적을 수정하거나 예약 확인 메시지를 발송하지 않는다.

인증의 `expectedAcademy` 가드는 현재 사용자 소속과 브릿지에 고정된 학원을 매 요청 비교한다.
`GET /paca/consultations/bridge-capabilities`로 원본 비교 지원을 확인한다.
수정/삭제의 `x-academy-bridge-before-hash`는 전체 상담 행의 해시다. 표시용 학생 조인과
중복 JSON 표시 필드를 제외하고 native 행 잠금 아래 비교한다. 충돌 시 409로 거부한다.
날짜·시간·메모 이외의 변경은 guarded 경로에서 허용하지 않는다.

검증은 `__tests__/services/consultationBridgeService.test.js`,
`__tests__/middleware/expectedAcademy.test.js`와 MAX AI의
`scripts/test-academy-operations-native-mysql.py --domains`에서 한다.
native 성공 응답의 생성 ID와 실제 재조회 결과는 AX의 비공개 원장에 남긴다.
성공 응답 자체의 유실을 자동 재생성으로 복구하지 않는다.

이 변경에 PACA DB 마이그레이션은 없다. auth 가드와 상담 bridge/service/repository/util을
함께 설치하고 native capabilities를 확인한 뒤 새 academy-operations를 활성화한다.
