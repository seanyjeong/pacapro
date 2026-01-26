-- 수업일 예약 변경 기능 추가
-- class_days_next: 변경 예정 수업요일 (JSON 배열)
-- class_days_effective_from: 변경 적용 시작일 (해당 월 1일)

ALTER TABLE students
  ADD COLUMN class_days_next JSON DEFAULT NULL COMMENT '변경 예정 수업요일',
  ADD COLUMN class_days_effective_from DATE DEFAULT NULL COMMENT '변경 적용 시작일';
