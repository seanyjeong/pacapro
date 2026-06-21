import type { WeeklyHour } from '@/lib/types/consultation';

interface KoreanHoliday {
  date: string;
  name: string;
}

const LUNAR_HOLIDAYS: Record<number, KoreanHoliday[]> = {
  2025: [
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-05-05', name: '부처님오신날' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
  ],
  2026: [
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
  ],
  2027: [
    { date: '2027-02-05', name: '설날 연휴' },
    { date: '2027-02-06', name: '설날' },
    { date: '2027-02-07', name: '설날 연휴' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-09-14', name: '추석 연휴' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 연휴' },
  ],
  2028: [
    { date: '2028-01-25', name: '설날 연휴' },
    { date: '2028-01-26', name: '설날' },
    { date: '2028-01-27', name: '설날 연휴' },
    { date: '2028-05-02', name: '부처님오신날' },
    { date: '2028-10-02', name: '추석 연휴' },
    { date: '2028-10-03', name: '추석' },
    { date: '2028-10-04', name: '추석 연휴' },
  ],
  2029: [
    { date: '2029-02-12', name: '설날 연휴' },
    { date: '2029-02-13', name: '설날' },
    { date: '2029-02-14', name: '설날 연휴' },
    { date: '2029-05-20', name: '부처님오신날' },
    { date: '2029-09-21', name: '추석 연휴' },
    { date: '2029-09-22', name: '추석' },
    { date: '2029-09-23', name: '추석 연휴' },
  ],
  2030: [
    { date: '2030-02-02', name: '설날 연휴' },
    { date: '2030-02-03', name: '설날' },
    { date: '2030-02-04', name: '설날 연휴' },
    { date: '2030-05-09', name: '부처님오신날' },
    { date: '2030-09-11', name: '추석 연휴' },
    { date: '2030-09-12', name: '추석' },
    { date: '2030-09-13', name: '추석 연휴' },
  ],
};

export function createDefaultWeeklyHours(): WeeklyHour[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isAvailable: dayOfWeek >= 1 && dayOfWeek <= 5,
    startTime: '09:00:00',
    endTime: '18:00:00',
  }));
}

export function getKoreanHolidays(year: number) {
  const fixedHolidays = [
    { date: `${year}-01-01`, name: '신정' },
    { date: `${year}-03-01`, name: '삼일절' },
    { date: `${year}-05-05`, name: '어린이날' },
    { date: `${year}-06-06`, name: '현충일' },
    { date: `${year}-08-15`, name: '광복절' },
    { date: `${year}-10-03`, name: '개천절' },
    { date: `${year}-10-09`, name: '한글날' },
    { date: `${year}-12-25`, name: '크리스마스' },
  ];

  return [...fixedHolidays, ...(LUNAR_HOLIDAYS[year] || [])]
    .filter((holiday, index, holidays) => holidays.findIndex((item) => item.date === holiday.date) === index)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function timeLabel(value: string) {
  return value === '24:00:00' ? '24:00' : value.substring(0, 5);
}
