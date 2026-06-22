import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import type { TabletAttendanceSummary, TabletStudentDetail } from './tablet-student-detail-types';
import { calculateTabletAttendanceSummary, getCurrentMonthRange } from './tablet-student-detail-utils';

export function useTabletStudentDetail(studentId: string) {
  const [student, setStudent] = useState<TabletStudentDetail | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<TabletAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchStudentData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const studentRes = await apiClient.get<{ student: TabletStudentDetail }>(`/students/${studentId}`, {
        suppressErrorToast: true,
      });
      setStudent(studentRes.student);

      try {
        const { start, end } = getCurrentMonthRange();
        const attendanceRes = await apiClient.get<{
          schedules: Array<{
            attendances: Array<{
              attendance_status: string | null;
              student_id: number;
            }>;
          }>;
        }>('/schedules', {
          params: { start_date: start, end_date: end },
          suppressErrorToast: true,
        });
        setAttendanceSummary(calculateTabletAttendanceSummary(attendanceRes.schedules || [], Number(studentId)));
      } catch {
        setAttendanceSummary(null);
      }
    } catch {
      setStudent(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) void fetchStudentData();
  }, [fetchStudentData, studentId]);

  return {
    attendanceSummary,
    fetchStudentData,
    loadError,
    loading,
    student,
  };
}
