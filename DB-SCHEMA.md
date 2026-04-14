# pacapro DB-SCHEMA

MySQL `paca` DB. n100 primary + vultr sync 복제. user=`paca` (n100) / `maxilsan` (vultr).

> **Last Updated**: 2026-04-14

---

## 전체 테이블 목록 (41개, nc_* 제외)

### 학원 운영 (6개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `academies` | 학원(지점) 마스터 — multi-tenant | id, name, slug, owner_id |
| `academy_events` | 학원별 일정/이벤트 | academy_id, title, date, type |
| `academy_settings` | 학원별 설정 | academy_id, key, value |
| `holidays` | 휴일 | academy_id, date, name |
| `users` | 사용자 계정 (owner/staff/instructor) | id, academy_id, email, role |
| `audit_logs` | 감사 로그 | user_id, action, table_name, record_id |

### 학생 (6개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `students` | 학생 마스터 | id, academy_id, name, phone*, status |
| `student_classes` | 학생-반 매핑 | student_id, class_id |
| `student_performance` | 성적 (모의고사/내신) | student_id, exam_type, score |
| `student_consultations` | 재원생 상담기록 | student_id, consultation_date, memo |
| `student_seasons` | 시즌 등록 | student_id, season_id, status |
| `rest_credits` | 휴원 크레딧 | student_id, amount, reason |

### 상담 (5개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `consultations` | 신규상담 예약 | academy_id, parent_phone*, preferred_date, status |
| `consultation_settings` | 상담 설정 | academy_id, slug, intro, availability |
| `consultation_weekly_hours` | 주간 가용 시간 | academy_id, day_of_week, start_time, end_time |
| `consultation_blocked_slots` | 차단 슬롯 | academy_id, blocked_date, blocked_time |
| `test_applicants` | 체험 신청자 | consultation_id, status |

### 수업/스케줄 (4개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `classes` | 반/클래스 | academy_id, name, max_students |
| `class_schedules` | 수업 스케줄 | class_id, date, start_time, end_time |
| `attendance` | 학생 출결 | student_id, schedule_id, status (출석/결석/지각) |
| `seasons` | 시즌/특강 | academy_id, name, start_date, end_date, price |
| `season_settings` | 시즌 설정 | season_id, key, value |

### 강사 (4개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `instructors` | 강사 마스터 | academy_id, name, phone*, hourly_rate |
| `instructor_attendance` | 강사 출근 | instructor_id, date, check_in, check_out |
| `instructor_schedules` | 강사 스케줄 | instructor_id, date, schedule_id |
| `overtime_approvals` | 야근 승인 | instructor_id, date, minutes, status |

### 결제/급여 (8개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `student_payments` | 학원비/결제 | student_id, year_month, final_amount, payment_status |
| `salary_records` | 급여 기록 | instructor_id, year_month, total_amount, paid_status |
| `expenses` | 지출 | academy_id, category, amount, date |
| `other_incomes` | 기타수입 | academy_id, category, amount, date |
| `revenues` | 수입 요약 | academy_id, year_month, total |
| `toss_payment_history` | Toss 결제 내역 | student_id, payment_id, amount, status |
| `toss_payment_queue` | Toss 결제 대기열 | academy_id, student_id, amount |
| `toss_settings` | Toss 설정 | academy_id, access_key, plugin_key |

### 알림 (6개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `notifications` | 알림 마스터 | academy_id, type, title, content |
| `notification` | 알림 발송 기록 | recipient, type, sent_at |
| `notification_logs` | 알림 로그 상세 | notification_id, status, response |
| `notification_settings` | 학원별 알림 설정 | academy_id, type, enabled |
| `user_notification_settings` | 사용자 알림 설정 | user_id, type, enabled |
| `push_subscriptions` | 웹푸시 구독 | user_id, endpoint, keys |

### SMS (1개)
| 테이블 | 역할 | 주요 필드 |
|--------|------|----------|
| `sender_numbers` | 발신번호 관리 | academy_id, phone_number, verified |

---

## 주요 테이블 상세 스키마

### `students` (학생 마스터)
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
academy_id      INT NOT NULL (FK → academies)
name            VARCHAR(255) NOT NULL  -- 암호화됨*
gender          ENUM('male','female')
student_type    ENUM('exam','adult') DEFAULT 'exam'
student_number  VARCHAR(50)
phone           VARCHAR(255)  -- 암호화됨*
parent_phone    VARCHAR(255)  -- 암호화됨*
school          VARCHAR(200)
grade           VARCHAR(20)
address         TEXT  -- 암호화됨*
class_days      JSON NOT NULL  -- 예: ["월","수","금"]
weekly_count    INT DEFAULT 3
monthly_tuition DECIMAL(10,2)
discount_rate   DECIMAL(5,2) DEFAULT 0
final_monthly_tuition DECIMAL(10,2)
status          ENUM('active','paused','graduated','withdrawn','trial','pending') DEFAULT 'active'
rest_start_date DATE
rest_end_date   DATE
enrollment_date DATE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### `consultations` (신규상담)
```sql
id                  INT PRIMARY KEY AUTO_INCREMENT
academy_id          INT NOT NULL
consultation_type   ENUM('new_registration','learning') DEFAULT 'new_registration'
parent_name         VARCHAR(255)  -- 암호화됨*
parent_phone        VARCHAR(255)  -- 암호화됨*
student_name        VARCHAR(255)  -- 암호화됨*
student_grade       ENUM('초1'...'N수','성인')
academic_scores     JSON  -- 모의고사/내신 점수
target_school       VARCHAR(100)
referral_sources    JSON
inquiry_content     TEXT
preferred_date      DATE NOT NULL
preferred_time      TIME NOT NULL
linked_student_id   INT (FK → students, 등록 후 연결)
status              ENUM('pending','confirmed','completed','cancelled','no_show')
checklist           JSON
consultation_memo   TEXT
admin_notes         TEXT
reservation_number  VARCHAR(20) UNIQUE
created_at          TIMESTAMP
```

### `student_payments` (결제)
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
student_id      INT NOT NULL
academy_id      INT NOT NULL
year_month      VARCHAR(7) NOT NULL  -- '2026-04'
payment_type    ENUM('monthly','season','product','other')
base_amount     DECIMAL(10,2) NOT NULL
discount_amount DECIMAL(10,2) DEFAULT 0
carryover_amount INT DEFAULT 0
refund_amount   INT DEFAULT 0
rest_credit_id  INT (FK → rest_credits)
final_amount    DECIMAL(10,2) NOT NULL
paid_amount     DECIMAL(12,2) DEFAULT 0
is_prorated     TINYINT(1) DEFAULT 0
proration_details JSON
due_date        DATE NOT NULL
payment_status  ENUM('pending','paid','partial','overdue','cancelled')
paid_date       DATE
payment_method  ENUM('account','card','cash','other')
season_id       INT (FK → seasons)
prepaid_group_id VARCHAR(36)  -- 선납 그룹
created_at      TIMESTAMP
```

---

## 암호화 필드 (*)

다음 필드들은 `DATA_ENCRYPTION_KEY`로 AES 암호화됨:
- `students.name`, `students.phone`, `students.parent_phone`, `students.address`
- `consultations.parent_name`, `consultations.parent_phone`, `consultations.student_name`
- `instructors.phone`, `instructors.address`

복호화 시 `encryption.js` 모듈 사용.

---

## NocoDB 공존 (nc_* 60+ 개 — 건드리지 말 것)

같은 `paca` DB 안에 NocoDB 메타 테이블 공존:
- `nc_bases_v2`, `nc_tables_v2`, `nc_columns_v2`, `nc_views_v2`, ...
- `nc_audit_v2`, `nc_hooks_v2`, `nc_comments`, `nc_dashboards_v2`, ...
- `xc_knex_migrations*` (마이그레이션 추적)

⚠️ NocoDB가 자체 스키마 관리. 직접 DML 하지 말 것. (`https://nocodb.sean8320.dedyn.io` 웹 UI 사용)

---

## Peak 연동

- `students.id` = peak.students.paca_student_id (peak에서 역참조)
- `users` — peak가 JWT로 사용자 정보 조회
- JWT secret + DATA_ENCRYPTION_KEY 공유

---

## 백업

- n100 매일 03:00 KST: `/home/sean/backups/backup_all.sh`
- 보존: `/home/sean/backups/*.sql.gz`

## 동기화 (n100 → vultr)

- 30분마다: `/home/sean/backups/sync-to-vultr.sh`
- dump + scp + mysql import

---

## 연결 설정

### n100 (.env)
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=paca
DB_NAME=paca
DATA_ENCRYPTION_KEY=QQe/soOzfamoQhmoHQBQ32CM7qQHthbTs3yhE/qDem0=
```

### vultr (.env)
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=maxilsan
DB_NAME=paca
# 동일 DATA_ENCRYPTION_KEY
```

---

## 주의사항

1. **nc_* 테이블 수정 금지** (NocoDB 관리)
2. **DML은 n100에서만** (vultr는 덮어써짐)
3. **DATA_ENCRYPTION_KEY는 peak과 동일** — 변경 시 둘 다 재시작
4. **암호화 필드 직접 SELECT 불가** — 복호화 로직 필요
