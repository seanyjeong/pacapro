# 상담확정 알림톡 구현 가이드

## 개요

상담 예약이 확정(confirmed)되면 고객에게 알림톡을 발송하는 기능.
현재 **솔라피(Solapi)** 로 구현되어 있으며, 추후 **SENS**로 전환 가능.

---

## 현재 구현 (솔라피)

### 1. 관련 파일

| 파일 | 역할 |
|------|------|
| `backend/routes/consultations.js` | 상담 확정 시 알림톡 발송 트리거 |
| `backend/routes/notifications.js` | 템플릿 설정 저장/조회 API |
| `backend/utils/solapi.js` | 솔라피 API 호출 유틸 (기존) |
| `src/app/settings/notifications/page.tsx` | 템플릿 설정 UI |
| `src/app/consultation/[reservationNumber]/page.tsx` | 고객용 예약 변경 페이지 |

### 2. DB 컬럼

**consultations 테이블**
```sql
reservation_number VARCHAR(20) UNIQUE  -- 예약번호 (C20251215001 형식)
```

**notification_settings 테이블**
```sql
solapi_consultation_template_id VARCHAR(100)       -- 솔라피 템플릿 ID
solapi_consultation_template_content TEXT          -- 템플릿 미리보기용 내용
```

### 3. 알림톡 발송 흐름

```
상담 상태 변경 (PUT /consultations/:id)
    ↓
status === 'confirmed' 체크
    ↓
예약번호 생성 (generateReservationNumber)
    ↓
sendConfirmationAlimtalk() 호출
    ↓
솔라피 API 직접 호출 (HMAC-SHA256 인증)
```

### 4. 템플릿 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `#{이름}` | 학생 이름 | 홍길동 |
| `#{날짜}` | 상담 날짜 | 12월 20일 |
| `#{시간}` | 상담 시간 | 14:00 |
| `#{예약번호}` | 예약번호 | C20251215001 |

### 5. 핵심 코드 (consultations.js)

```javascript
// 예약번호 생성
async function generateReservationNumber(connection) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `C${dateStr}`;

  const [rows] = await connection.execute(
    `SELECT reservation_number FROM consultations
     WHERE reservation_number LIKE ?
     ORDER BY reservation_number DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastNum = parseInt(rows[0].reservation_number.slice(-3));
    sequence = lastNum + 1;
  }

  return `${prefix}${String(sequence).padStart(3, '0')}`;
}

// 알림톡 발송
async function sendConfirmationAlimtalk(consultation, settings) {
  const message = settings.solapi_consultation_template_content
    .replace(/#{이름}/g, consultation.student_name)
    .replace(/#{날짜}/g, formatDate(consultation.preferred_date))
    .replace(/#{시간}/g, consultation.preferred_time)
    .replace(/#{예약번호}/g, consultation.reservation_number);

  // 솔라피 API 호출
  const response = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
    },
    body: JSON.stringify({
      message: {
        to: phone,
        from: settings.solapi_sender_phone,
        kakaoOptions: {
          pfId: settings.solapi_pfid,
          templateId: settings.solapi_consultation_template_id,
          variables: { /* 변수들 */ }
        }
      }
    })
  });
}
```

---

## SENS로 전환하기

### 1. 추가할 DB 컬럼 (notification_settings)

```sql
ALTER TABLE notification_settings ADD COLUMN sens_consultation_template_code VARCHAR(100);
ALTER TABLE notification_settings ADD COLUMN sens_consultation_template_content TEXT;
```

### 2. 수정할 파일

#### A. backend/routes/consultations.js

**현재 (솔라피)**
```javascript
const { sendAlimtalkSolapi } = require('../utils/solapi');

async function sendConfirmationAlimtalk(consultation, settings) {
  // 솔라피 API 호출
}
```

**변경 (SENS)**
```javascript
const { sendAlimtalkSENS } = require('../utils/naverSens');

async function sendConfirmationAlimtalk(consultation, settings) {
  // 서비스 타입에 따라 분기
  if (settings.service_type === 'sens') {
    return sendConfirmationAlimtalkSENS(consultation, settings);
  } else {
    return sendConfirmationAlimtalkSolapi(consultation, settings);
  }
}

async function sendConfirmationAlimtalkSENS(consultation, settings) {
  const templateCode = settings.sens_consultation_template_code;

  // SENS API 호출 (기존 naverSens.js 참고)
  const response = await fetch(
    `https://sens.apigw.ntruss.com/alimtalk/v2/services/${settings.naver_service_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': settings.naver_access_key,
        'x-ncp-apigw-signature-v2': signature
      },
      body: JSON.stringify({
        plusFriendId: settings.kakao_channel_id,
        templateCode: templateCode,
        messages: [{
          to: phone,
          content: message,
          buttons: [{
            type: 'WL',
            name: '일정 변경하기',
            linkMobile: `https://pacapro.vercel.app/consultation/${reservationNumber}`,
            linkPc: `https://pacapro.vercel.app/consultation/${reservationNumber}`
          }]
        }]
      })
    }
  );
}
```

#### B. backend/routes/notifications.js

**GET/PUT /settings에 추가**
```javascript
// 조회 시
sens_consultation_template_code: row.sens_consultation_template_code || '',
sens_consultation_template_content: row.sens_consultation_template_content || '',

// 저장 시
sens_consultation_template_code = ?,
sens_consultation_template_content = ?,
```

#### C. src/lib/api/notifications.ts

**인터페이스에 추가**
```typescript
interface NotificationSettings {
  // ... 기존 필드

  // SENS 상담확정 알림톡
  sens_consultation_template_code: string;
  sens_consultation_template_content: string;
}
```

#### D. src/app/settings/notifications/page.tsx

**UI에 SENS 탭 추가**
```tsx
{/* SENS 상담확정 템플릿 섹션 */}
{settings.service_type === 'sens' && (
  <div className="p-4 bg-orange-50 rounded-lg">
    <h4>SENS 상담확정 템플릿</h4>
    <input
      placeholder="템플릿 코드"
      value={settings.sens_consultation_template_code}
      onChange={(e) => setSettings({...settings, sens_consultation_template_code: e.target.value})}
    />
    <textarea
      placeholder="템플릿 내용 (미리보기용)"
      value={settings.sens_consultation_template_content}
      onChange={(e) => setSettings({...settings, sens_consultation_template_content: e.target.value})}
    />
  </div>
)}
```

### 3. SENS 템플릿 등록 (카카오 비즈니스 센터)

1. 카카오 비즈니스 센터 접속
2. 알림톡 템플릿 신규 등록
3. 템플릿 내용 예시:
```
#{이름}님, 상담이 확정되었습니다.

■ 상담 일시: #{날짜} #{시간}
■ 예약번호: #{예약번호}

일정 변경이 필요하시면 아래 버튼을 눌러주세요.
```
4. 버튼: 웹링크 타입, `https://pacapro.vercel.app/consultation/#{예약번호}`
5. 승인 후 템플릿 코드 복사하여 설정에 입력

### 4. SENS vs 솔라피 API 차이점

| 항목 | SENS | 솔라피 |
|------|------|--------|
| 인증 | x-ncp-apigw-signature-v2 (HMAC-SHA256) | Authorization 헤더 (HMAC-SHA256) |
| 엔드포인트 | sens.apigw.ntruss.com | api.solapi.com |
| 템플릿 식별 | templateCode | templateId |
| 채널 식별 | plusFriendId | pfId |
| 변수 치환 | 메시지 content에 직접 치환 | kakaoOptions.variables 사용 |

---

## 체크리스트

### SENS 전환 시 확인사항

- [ ] notification_settings 테이블에 SENS 템플릿 컬럼 추가
- [ ] consultations.js에 SENS 발송 함수 추가
- [ ] notifications.js GET/PUT에 SENS 필드 추가
- [ ] 프론트엔드 타입 정의 수정
- [ ] 설정 UI에 SENS 템플릿 입력 폼 추가
- [ ] 카카오 비즈니스에서 템플릿 승인 받기
- [ ] 테스트 발송 확인

---

## 버전 히스토리

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v2.9.22 | 2025-12-15 | 솔라피 기반 상담확정 알림톡 최초 구현 |
