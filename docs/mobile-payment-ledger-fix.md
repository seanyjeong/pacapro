# 모바일 납부 장부 오류 수정 — v4.0.50

운영 `revenues`에는 `payment_method`가 없어 단건 납부·취소 장부 INSERT가
실패했다. 장부를 `payment_id`로 원본 수납에 연결하며 결제 방법은 기존
`student_payments.payment_method`에 저장한다. 수납과 장부의 트랜잭션 및
행 잠금을 유지해 장부 실패 시 수납도 롤백한다.

DB 스키마·기존 데이터·권한·결제업체 연동은 변경하지 않는다.
적용 경로는 `POST /paca/payments/:id/pay`와 `POST /paca/payments/:id/cancel`이다.

회귀 테스트는 운영에서 확인한 장부 컬럼 구조로 임시 MySQL을 구성한다.
카드·계좌·현금 납부와 취소, 장부 연결, 동시 부분 납부, 장부 실패 시 롤백을
검증한다. 운영 결제 자료를 사용하지 않는다.

```bash
python3 ../MaxAIwithhermes/scripts/test-academy-operations-native-mysql.py --paca
cd backend && npm run test:ci
```

배포 전 두 라우트의 체크섬 백업과 Git 롤백 태그를 만든다. 해당 두 파일만
Vultr에 반영하고 `paca-failover.service`를 재시작한다. 정상 상태를 확인한 뒤
GitHub main을 푸시하여 Vercel의 v4.0.50 배포를 검증한다.
롤백은 두 파일의 백업을 복구하고 PACA 서비스만 재시작한다.
이미 기록된 결제를 자동 취소하거나 DB를 복원하지 않는다.
