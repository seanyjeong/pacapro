---
name: student-stats
description: P-ACA 학생 현황 통계 조회
---

# P-ACA 학생 통계 스킬

## 수행 작업

MySQL에서 학생 현황 조회:

```sql
-- 상태별 학생 수
SELECT status, COUNT(*) as count
FROM students
GROUP BY status;

-- 상태 구분
-- active: 재원
-- paused: 휴원
-- withdrawn: 퇴원
-- graduated: 졸업
-- trial: 체험
-- pending: 미등록
```

## 추가 통계 (필요시)
- 시간대별 학생 분포 (morning/afternoon/evening)
- 이번 달 신규 등록
- 이번 달 퇴원
- 수업료 미납 현황
