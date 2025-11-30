/**
 * 수업 관리 헬퍼 함수
 */

import type {
  ClassSchedule,
  TimeSlot,
  AttendanceStatus,
  CalendarEvent,
  Attendance,
} from '@/lib/types/schedule';
import {
  TIME_SLOT_LABELS,
  TIME_SLOT_COLORS,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
} from '@/lib/types/schedule';

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 문자열을 Date 객체로 변환
 */
export function parseStringToDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * 날짜를 한글 형식으로 포맷팅
 */
export function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];

  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

/**
 * 시간대 레이블 가져오기
 */
export function getTimeSlotLabel(timeSlot: TimeSlot): string {
  return TIME_SLOT_LABELS[timeSlot];
}

/**
 * 시간대 색상 클래스 가져오기
 */
export function getTimeSlotColor(timeSlot: TimeSlot): string {
  return TIME_SLOT_COLORS[timeSlot];
}

/**
 * 출석 상태 레이블 가져오기
 */
export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  return ATTENDANCE_STATUS_LABELS[status];
}

/**
 * 출석 상태 색상 클래스 가져오기
 */
export function getAttendanceStatusColor(status: AttendanceStatus): string {
  return ATTENDANCE_STATUS_COLORS[status];
}

/**
 * 수업 제목 생성 (제목이 없는 경우 기본 제목 생성)
 */
export function getScheduleTitle(schedule: ClassSchedule): string {
  if (schedule.title) {
    return schedule.title;
  }

  const timeSlotLabel = getTimeSlotLabel(schedule.time_slot);
  const instructorName = schedule.instructor_name || '강사';
  return `${timeSlotLabel} 수업 - ${instructorName}`;
}

/**
 * 월의 시작일과 종료일 가져오기
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: formatDateToString(start),
    end: formatDateToString(end),
  };
}

/**
 * 주의 시작일(월요일)과 종료일(일요일) 가져오기
 */
export function getWeekRange(date: Date): { start: string; end: string } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 조정

  const start = new Date(date.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatDateToString(start),
    end: formatDateToString(end),
  };
}

/**
 * 수업 목록을 캘린더 이벤트로 변환
 */
export function scheduleToCalendarEvent(schedule: ClassSchedule): CalendarEvent {
  return {
    id: schedule.id,
    date: schedule.class_date,
    time_slot: schedule.time_slot,
    title: getScheduleTitle(schedule),
    instructor_name: schedule.instructor_name || '강사',
    attendance_taken: schedule.attendance_taken,
  };
}

/**
 * 날짜별로 수업 그룹화
 */
export function groupSchedulesByDate(
  schedules: ClassSchedule[]
): Map<string, ClassSchedule[]> {
  const grouped = new Map<string, ClassSchedule[]>();

  schedules.forEach((schedule) => {
    const date = schedule.class_date;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(schedule);
  });

  // 각 날짜의 수업을 시간대 순으로 정렬
  grouped.forEach((schedules, date) => {
    const timeSlotOrder: Record<TimeSlot, number> = {
      morning: 1,
      afternoon: 2,
      evening: 3,
    };

    schedules.sort((a, b) => timeSlotOrder[a.time_slot] - timeSlotOrder[b.time_slot]);
  });

  return grouped;
}

/**
 * 출석 통계 계산
 */
export function calculateAttendanceStats(attendances: Attendance[]) {
  const total = attendances.length;
  const present = attendances.filter((a) => a.attendance_status === 'present').length;
  const absent = attendances.filter((a) => a.attendance_status === 'absent').length;
  const late = attendances.filter((a) => a.attendance_status === 'late').length;
  const excused = attendances.filter((a) => a.attendance_status === 'excused').length;
  const makeup = attendances.filter((a) => a.attendance_status === 'makeup').length;
  const pending = attendances.filter((a) => !a.attendance_status).length;

  return {
    total,
    present,
    absent,
    late,
    excused,
    makeup,
    pending,
    presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}

/**
 * 오늘 날짜 가져오기
 */
export function getToday(): string {
  return formatDateToString(new Date());
}

/**
 * 날짜가 오늘인지 확인
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

/**
 * 날짜가 과거인지 확인
 */
export function isPast(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * 날짜가 미래인지 확인
 */
export function isFuture(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

/**
 * 캘린더 그리드 생성 (6주 * 7일)
 */
export function generateCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // 첫 주의 시작일 (이전 달의 날짜 포함)
  const startDay = new Date(firstDay);
  const dayOfWeek = firstDay.getDay();
  startDay.setDate(startDay.getDate() - dayOfWeek);

  // 6주 * 7일 = 42일의 그리드 생성
  const grid: Date[] = [];
  const current = new Date(startDay);

  for (let i = 0; i < 42; i++) {
    grid.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return grid;
}

/**
 * 날짜가 현재 월에 속하는지 확인
 */
export function isInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

/**
 * 시간대별 수업 필터링
 */
export function filterSchedulesByTimeSlot(
  schedules: ClassSchedule[],
  timeSlot: TimeSlot
): ClassSchedule[] {
  return schedules.filter((schedule) => schedule.time_slot === timeSlot);
}

/**
 * 출석 완료 여부에 따른 수업 필터링
 */
export function filterSchedulesByAttendanceTaken(
  schedules: ClassSchedule[],
  attendanceTaken: boolean
): ClassSchedule[] {
  return schedules.filter((schedule) => schedule.attendance_taken === attendanceTaken);
}
