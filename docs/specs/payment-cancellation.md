# Payment Cancellation Spec

## Problem
학원비를 납부 처리한 뒤 실제 운영에서 결제가 취소되는 경우가 있지만, 현재 PACA에는 납부 취소 기능이 없다. 청구 삭제는 감사 기록이 사라지므로 결제 취소와 분리해야 한다.

## Users And Jobs
원장/관리자는 납부된 결제를 취소하고, 취소 금액과 사유를 남겨야 한다.

## Scope
### In
- 납부 금액이 있는 청구에서 결제 취소 가능
- 취소 금액은 현재 납부액 이하로 제한
- 취소 사유 필수
- 취소 후 `paid_amount`, `payment_status`, `paid_date`, `payment_method` 갱신
- 취소 내역은 `notes`에 남김
- 가능하면 `revenues`에 음수 조정 기록 추가

### Out
- Toss 외부 결제 API 취소
- 결제별 개별 트랜잭션 테이블 추가
- 청구 삭제 정책 변경

## Acceptance Criteria
- 납부액 120,000원에서 50,000원 취소 시 납부액 70,000원, 상태 partial 유지
- 납부액 전액 취소 시 납부액 0원, 상태 pending, 납부일/방법 비움
- 취소 사유가 없거나 취소 금액이 납부액보다 크면 한국어 오류 반환
- 결제 상세 화면에서 납부액이 있는 경우만 결제 취소 버튼 표시
- 취소 성공 후 상세 화면 금액과 메모가 새로고침 없이 갱신

## API Contract
`POST /paca/payments/:id/cancel`

Request:
```json
{
  "cancel_amount": 50000,
  "cancel_reason": "카드 결제 취소",
  "cancel_date": "2026-07-07"
}
```

Response:
```json
{
  "message": "결제 취소가 기록되었습니다.",
  "payment": {}
}
```

## UI Contract
- 학원비 상세 헤더에 `결제 취소` 버튼 추가
- 모달에서 학생명, 현재 납부액, 취소 금액, 취소일, 취소 사유 표시
- 오류 문구는 사용자용 한국어만 표시
- 모바일에서도 버튼과 모달이 넘치지 않아야 함

## Test Plan
- Jest: 취소 성공, 전액 취소, 사유 누락, 초과 취소, 미존재 결제
- Playwright smoke: 상세 화면 취소 모달, payload, 금액 갱신, 메모 표시
- Existing payment smoke/build/typecheck 유지

## Risks
- 현재 구조는 개별 납부 트랜잭션이 없어 특정 회차만 정확히 취소하지는 못한다. 이번 범위는 누적 납부액의 부분/전액 취소로 제한한다.
