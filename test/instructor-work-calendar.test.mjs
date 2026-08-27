import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInstructorWorkCalendarDays,
  groupInstructorSchedulesByDate,
} from '../src/features/instructors/instructor-work-calendar-utils.ts';

test('월 달력은 6주 42일을 일요일부터 생성한다', () => {
  const days = buildInstructorWorkCalendarDays(2026, 5);

  assert.equal(days.length, 42);
  assert.equal(days[0].date, '2026-05-31');
  assert.equal(days[41].date, '2026-07-11');
  assert.equal(days.filter((day) => day.isCurrentMonth).length, 30);
});

test('같은 날짜의 여러 출근 예정 시간을 한 날짜에 묶는다', () => {
  const grouped = groupInstructorSchedulesByDate([
    { id: 1, work_date: '2026-06-03', time_slot: 'morning' },
    { id: 2, work_date: '2026-06-03', time_slot: 'afternoon' },
    { id: 3, work_date: '2026-06-15', time_slot: 'evening' },
  ]);

  assert.equal(grouped.get('2026-06-03')?.length, 2);
  assert.equal(grouped.get('2026-06-15')?.[0].time_slot, 'evening');
});
