import type {
  AttendanceStudent,
  InstructorAttendance,
  InstructorAttendanceState,
  StudentAttendanceState,
} from './time-slot-detail-types';
import type { TimeSlot } from '@/lib/types/schedule';

export function calculateHours(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return '';

  const [inHour, inMinute] = checkIn.split(':').map(Number);
  const [outHour, outMinute] = checkOut.split(':').map(Number);
  const totalMinutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);

  if (totalMinutes <= 0) return '';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

export function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function formatSlotDate(date: string): { shortDate: string; dayOfWeek: string } {
  const dateObj = new Date(`${date}T00:00:00`);
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
  return {
    shortDate: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
    dayOfWeek,
  };
}

export function buildStudentAttendanceMap(students: AttendanceStudent[]): Record<number, StudentAttendanceState> {
  return students.reduce<Record<number, StudentAttendanceState>>((acc, student) => {
    if (student.attendance_status) {
      acc[student.student_id] = {
        status: student.attendance_status,
        notes: student.notes || undefined,
      };
    }
    return acc;
  }, {});
}

export function buildInstructorAttendanceMap(
  attendances: InstructorAttendance[] | undefined,
  timeSlot: TimeSlot
): Record<number, InstructorAttendanceState> {
  return (attendances || []).reduce<Record<number, InstructorAttendanceState>>((acc, attendance) => {
    if (attendance.time_slot === timeSlot) {
      acc[attendance.instructor_id] = {
        status: attendance.attendance_status || '',
        checkIn: attendance.check_in_time || '',
        checkOut: attendance.check_out_time || '',
      };
    }
    return acc;
  }, {});
}

export function sortStudentsForAttendance(students: AttendanceStudent[]): AttendanceStudent[] {
  return [...students].sort((a, b) => {
    if (a.season_type && !b.season_type) return -1;
    if (!a.season_type && b.season_type) return 1;
    return 0;
  });
}

export function getTrialBadgeInfo(
  date: string,
  student: AttendanceStudent,
  currentStatus: string
): { text: string; completed: boolean } | null {
  const trialDates = student.trial_dates || [];
  const currentDateIndex = trialDates.findIndex((trialDate) => trialDate.date === date);

  if (currentDateIndex === -1) return null;

  const totalSessions = trialDates.length;
  const sessionNumber = currentDateIndex + 1;
  const currentDateTrial = trialDates[currentDateIndex];
  const isLastSession = sessionNumber === totalSessions;
  const isAttended = currentDateTrial.attended || currentStatus === 'present' || currentStatus === 'late';
  const completed = isLastSession && isAttended;

  return {
    completed,
    text: completed ? '체험완료' : `체험 ${sessionNumber}/${totalSessions}`,
  };
}
