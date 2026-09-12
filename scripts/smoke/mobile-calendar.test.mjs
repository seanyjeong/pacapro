import assert from 'node:assert/strict';
import test from 'node:test';
import { localDateKey, monthDateRange, moveMonth, monthCells } from '../../src/features/mobile-calendar/mobile-calendar-utils.ts';
import { makeMobileHomeMenu } from '../../src/features/mobile-home/mobile-home-constants.ts';

test('별도 권한이 없는 계정도 두 달력에 접근하고 출결·금액 메뉴는 숨긴다', () => {
  const items = makeMobileHomeMenu({ schedules: false, payments: false, consultations: false });
  assert.deepEqual(items.filter(item => item.permission).map(item => item.href), [
    '/m/academy-events', '/m/instructor-calendar',
  ]);
});

test('권한이 있는 계정은 기존 업무 메뉴도 계속 사용한다', () => {
  const items = makeMobileHomeMenu({ schedules: true, payments: true, consultations: true });
  assert.equal(items.filter(item => item.permission).length, 6);
});

test('윤년·연말에 달력과 API 조회 범위가 일치한다', () => {
  assert.deepEqual(monthDateRange('2028-02'), { start_date: '2028-02-01', end_date: '2028-02-29' });
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2026-01', -1), '2025-12');
  assert.equal(localDateKey(new Date(2026, 8, 1)), '2026-09-01');
  const leapDays = monthCells('2028-02').filter(Boolean);
  assert.equal(leapDays.length, 29);
  assert.equal(leapDays.at(-1), '2028-02-29');
  const sixWeeks = monthCells('2026-08');
  assert.equal(sixWeeks.length, 42);
  assert.equal(sixWeeks[6], '2026-08-01');
  assert.equal(new Set(sixWeeks.filter(Boolean)).size, 31);
});
