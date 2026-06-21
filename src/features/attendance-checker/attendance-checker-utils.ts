import type { Attendance, AttendanceStatus, AttendanceSubmission } from '@/lib/types/schedule';
import type { EditedAttendanceData } from './attendance-checker-types';

export function createEditedAttendanceMap(attendances: Attendance[]): Map<number, EditedAttendanceData> {
  return new Map(
    attendances.map((attendance) => [
      attendance.student_id,
      {
        status: attendance.attendance_status,
        makeup_date: attendance.makeup_date,
        notes: attendance.notes,
      },
    ])
  );
}

export function hasEditedAttendanceChanges(
  attendances: Attendance[],
  editedAttendances: Map<number, EditedAttendanceData>
): boolean {
  return Array.from(editedAttendances.entries()).some(([studentId, data]) => {
    const original = attendances.find((attendance) => attendance.student_id === studentId);
    return (
      data.status !== original?.attendance_status ||
      data.makeup_date !== original?.makeup_date ||
      data.notes !== original?.notes
    );
  });
}

export function buildAttendanceSubmissions(
  attendances: Attendance[],
  editedAttendances: Map<number, EditedAttendanceData>
): { submissions: AttendanceSubmission[]; missingMakeupDate: boolean } {
  const submissions: AttendanceSubmission[] = [];
  let missingMakeupDate = false;

  editedAttendances.forEach((data, studentId) => {
    const original = attendances.find((attendance) => attendance.student_id === studentId);

    if (data.status) {
      if (data.status === 'makeup' && !data.makeup_date) {
        missingMakeupDate = true;
        return;
      }

      submissions.push({
        student_id: studentId,
        attendance_status: data.status,
        makeup_date: data.makeup_date,
        notes: data.notes,
      });
      return;
    }

    if (original?.attendance_status) {
      submissions.push({
        student_id: studentId,
        attendance_status: 'none' as AttendanceStatus,
      });
    }
  });

  return { submissions, missingMakeupDate };
}
