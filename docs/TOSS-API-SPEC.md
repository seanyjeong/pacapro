# P-ACA 토스 연동 API 명세서

## 토스 프론트 플러그인용 API 문서

---

## 1. 개요

### 1.1 API 기본 정보

| 항목 | 값 |
|------|-----|
| **Base URL** | `https://chejump.com/paca/toss` |
| **프로토콜** | HTTPS (TLS 1.2+) |
| **인코딩** | UTF-8 |
| **응답 형식** | JSON |

### 1.2 인증 방식

#### 플러그인 API 키 인증

```http
X-Toss-Plugin-Key: {API_KEY}
X-Academy-Id: {ACADEMY_ID}
```

| 헤더 | 필수 | 설명 |
|------|------|------|
| `X-Toss-Plugin-Key` | O | 플러그인 API 키 |
| `X-Academy-Id` | O | 학원 ID (멀티테넌시) |

#### 콜백 서명 검증

```http
X-Toss-Signature: {HMAC_SHA256_SIGNATURE}
X-Toss-Timestamp: {UNIX_TIMESTAMP_MS}
```

---

## 2. 플러그인용 API

### 2.1 미납자 목록 조회

토스 프론트 플러그인에서 해당 학원의 미납 학생 목록을 조회합니다.

```http
GET /paca/toss/unpaid?academy_id={academy_id}
```

#### Request Headers

| 이름 | 필수 | 설명 |
|------|------|------|
| `X-Toss-Plugin-Key` | O | API 키 |

#### Query Parameters

| 이름 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `academy_id` | O | integer | 학원 ID |

#### Response

```json
{
  "success": true,
  "stats": {
    "totalCount": 15,
    "totalAmount": 4500000,
    "pendingCount": 10,
    "partialCount": 5
  },
  "payments": [
    {
      "payment_id": 123,
      "student_id": 45,
      "student_name": "김철수",
      "display_name": "김*수",
      "student_number": "2024-001",
      "grade": "고3",
      "school": "OO고등학교",
      "year_month": "2025-12",
      "payment_type": "monthly",
      "base_amount": 350000,
      "discount_amount": 50000,
      "final_amount": 300000,
      "paid_amount": 0,
      "remaining_amount": 300000,
      "due_date": "2025-12-10",
      "payment_status": "pending",
      "description": "12월 수강료"
    }
  ]
}
```

#### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| `payment_id` | integer | 결제 건 ID (주문번호 생성에 사용) |
| `student_id` | integer | 학생 ID |
| `student_name` | string | 학생 이름 (복호화됨) |
| `display_name` | string | 마스킹된 이름 (홍*동) |
| `remaining_amount` | number | 남은 결제 금액 |
| `payment_status` | string | `pending`: 미납, `partial`: 부분납 |

---

### 2.2 학생 결제 정보 조회

특정 학생의 미납 결제 목록을 조회합니다.

```http
GET /paca/toss/student/{student_id}?academy_id={academy_id}
```

#### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| `student_id` | integer | 학생 ID |

#### Response

```json
{
  "success": true,
  "payments": [
    {
      "payment_id": 123,
      "year_month": "2025-12",
      "payment_type": "monthly",
      "final_amount": 300000,
      "paid_amount": 0,
      "remaining_amount": 300000,
      "payment_status": "pending",
      "due_date": "2025-12-10"
    }
  ]
}
```

---

## 3. 결제 콜백 API

### 3.1 결제 완료 콜백

토스에서 결제 완료 시 호출하는 콜백 API입니다.

```http
POST /paca/toss/payment-callback
```

#### Request Headers

| 이름 | 필수 | 설명 |
|------|------|------|
| `X-Toss-Signature` | 권장 | HMAC-SHA256 서명 |
| `X-Toss-Timestamp` | 권장 | 요청 타임스탬프 (ms) |
| `Content-Type` | O | `application/json` |

#### Request Body

```json
{
  "orderId": "PACA-123-1703235600000",
  "paymentKey": "toss_payment_key_xxxxx",
  "amount": 300000,
  "status": "DONE",
  "method": "CARD",
  "approvedAt": "2025-12-22T10:00:00+09:00",
  "receipt": {
    "url": "https://receipt.tosspayments.com/xxxxx"
  },
  "card": {
    "company": "삼성카드",
    "number": "1234-****-****-5678",
    "installmentPlanMonths": 0
  },
  "metadata": {
    "academyId": 1,
    "paymentId": 123,
    "studentId": 45,
    "studentName": "김철수"
  }
}
```

#### Request Body Fields

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `orderId` | string | O | 주문번호 (`PACA-{payment_id}-{timestamp}`) |
| `paymentKey` | string | O | 토스 결제 키 |
| `amount` | number | O | 결제 금액 |
| `status` | string | O | 결제 상태 (`DONE`, `CANCELED` 등) |
| `method` | string | O | 결제 수단 (`CARD`, `CASH` 등) |
| `approvedAt` | string | O | 승인 시간 (ISO 8601) |
| `metadata.academyId` | integer | O | 학원 ID |

#### Response (성공 - 자동 매칭)

```json
{
  "success": true,
  "matched": true,
  "paymentId": 123,
  "studentPaymentStatus": "paid",
  "paidAmount": 300000,
  "remainingAmount": 0
}
```

#### Response (자동 매칭 실패)

```json
{
  "success": true,
  "matched": false,
  "message": "결제 수신 완료 (수동 매칭 필요)",
  "queueReason": "ORDER_ID_FORMAT"
}
```

#### 자동 매칭 조건

주문번호가 다음 형식이어야 자동 매칭됩니다:

```
PACA-{payment_id}-{timestamp}
```

예시: `PACA-123-1703235600000`

---

## 4. 주문번호 생성 규칙

### 4.1 형식

```
PACA-{payment_id}-{timestamp}
```

| 요소 | 설명 | 예시 |
|------|------|------|
| `PACA` | 고정 접두사 | PACA |
| `payment_id` | student_payments 테이블 ID | 123 |
| `timestamp` | Unix 타임스탬프 (ms) | 1703235600000 |

### 4.2 플러그인 구현 예시

```javascript
// 주문번호 생성
const orderId = `PACA-${payment.payment_id}-${Date.now()}`;

// 결제 요청
await TossFrontSDK.payment.request({
  orderId: orderId,
  amount: payment.remaining_amount,
  orderName: `${payment.student_name} ${payment.year_month} 학원비`,
  metadata: {
    academyId: ACADEMY_ID,
    paymentId: payment.payment_id,
    studentId: payment.student_id,
    studentName: payment.student_name
  }
});
```

---

## 5. 에러 코드

### 5.1 HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (파라미터 오류) |
| 401 | 인증 실패 (API 키 오류) |
| 403 | 권한 없음 (서명 검증 실패) |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

### 5.2 에러 응답 형식

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "유효하지 않은 API 키입니다."
}
```

---

## 6. 테스트

### 6.1 테스트 API 키

```
X-Toss-Plugin-Key: paca-toss-plugin-key-2024
```

### 6.2 cURL 테스트

```bash
# 미납자 목록 조회
curl -X GET \
  -H "X-Toss-Plugin-Key: paca-toss-plugin-key-2024" \
  "https://chejump.com/paca/toss/unpaid?academy_id=1"

# 결제 콜백 테스트
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "PACA-123-1703235600000",
    "paymentKey": "test_key",
    "amount": 300000,
    "status": "DONE",
    "method": "CARD",
    "approvedAt": "2025-12-22T10:00:00+09:00",
    "metadata": { "academyId": 1 }
  }' \
  "https://chejump.com/paca/toss/payment-callback"
```

---

## 7. Rate Limit

현재 Rate Limit은 적용되지 않습니다. (내부 시스템)

---

*문서 버전: 1.0*
*작성일: 2025-12-22*
