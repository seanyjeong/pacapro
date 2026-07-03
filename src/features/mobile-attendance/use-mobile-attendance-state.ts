import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { schedulesApi } from '@/lib/api/schedules';
import { hapticForStatus } from '@/lib/attendance/haptics';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';
import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';
import { canEdit } from '@/lib/utils/permissions';
import { MOBILE_ATTENDANCE_MESSAGES } from './mobile-attendance-constants';
import type { MarkableAttendanceStatus, MobileAttendanceSchedule, MobileAttendanceStudent, ReasonSheetState } from './mobile-attendance-types';
import { calculateStats, formatDateLabel, isMarkableStatus, normalizeStudents, toLocalDateStr } from './mobile-attendance-utils';

export function useMobileAttendanceState() {
  const router = useRouter();
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('evening');
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [students, setStudents] = useState<MobileAttendanceStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attendances, setAttendances] = useState<Map<number, AttendanceStatus>>(new Map());
  const [attendanceNotes, setAttendanceNotes] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [reasonSheet, setReasonSheet] = useState<ReasonSheetState | null>(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await schedulesApi.getSlotData(date, timeSlot, { suppressErrorToast: true });
      const schedule = response.schedule as MobileAttendanceSchedule | null;
      const nextStudents = normalizeStudents(schedule);
      const statusMap = new Map<number, AttendanceStatus>();
      const notesMap = new Map<number, string>();

      nextStudents.forEach((student) => {
        if (isMarkableStatus(student.attendance_status)) statusMap.set(student.student_id, student.attendance_status);
        if (student.notes) notesMap.set(student.student_id, student.notes);
      });

      setScheduleId(schedule?.id ?? null);
      setStudents(nextStudents);
      setAttendances(statusMap);
      setAttendanceNotes(notesMap);
    } catch {
      setScheduleId(null);
      setStudents([]);
      setAttendances(new Map());
      setAttendanceNotes(new Map());
      setLoadError(MOBILE_ATTENDANCE_MESSAGES.load);
    } finally {
      setLoading(false);
    }
  }, [date, timeSlot]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (!canEdit('schedules')) {
      router.push('/m');
      return;
    }
    setHasPermission(true);
  }, [router]);

  useEffect(() => {
    if (hasPermission) void loadSchedule();
  }, [hasPermission, loadSchedule]);

  useAttendanceRealtime({
    scheduleId,
    enabled: hasPermission === true,
    onAttendanceUpdated: () => {
      void loadSchedule();
    },
  });

  const stats = useMemo(() => calculateStats(students, attendances), [attendances, students]);
  const formattedDate = useMemo(() => formatDateLabel(date), [date]);

  const saveAttendance = async (studentId: number, status: AttendanceStatus | 'none', notes?: string) => {
    if (!scheduleId || saving) return;

    const previousStatus = attendances.get(studentId);
    const previousNote = attendanceNotes.get(studentId);
    const nextNote = status === 'absent' || status === 'excused' ? notes || '' : '';

    setAttendances((prev) => {
      const next = new Map(prev);
      if (status === 'none') next.delete(studentId);
      else next.set(studentId, status);
      return next;
    });
    setAttendanceNotes((prev) => {
      const next = new Map(prev);
      if (nextNote) next.set(studentId, nextNote);
      else next.delete(studentId);
      return next;
    });

    setSaving(true);
    try {
      await schedulesApi.submitAttendance(
        scheduleId,
        { attendance_records: [{ student_id: studentId, attendance_status: status, notes: nextNote || undefined }] },
        { suppressErrorToast: true }
      );
    } catch {
      setAttendances((prev) => {
        const next = new Map(prev);
        if (previousStatus) next.set(studentId, previousStatus);
        else next.delete(studentId);
        return next;
      });
      setAttendanceNotes((prev) => {
        const next = new Map(prev);
        if (previousNote) next.set(studentId, previousNote);
        else next.delete(studentId);
        return next;
      });
      toast.error(MOBILE_ATTENDANCE_MESSAGES.save);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (student: MobileAttendanceStudent, status: MarkableAttendanceStatus) => {
    if (!scheduleId || saving) return;
    hapticForStatus(status);

    if (attendances.get(student.student_id) === status) {
      await saveAttendance(student.student_id, 'none');
      return;
    }

    if (status === 'absent' || status === 'excused') {
      setReasonSheet({ studentId: student.student_id, studentName: student.student_name, status, reason: '', customReason: '' });
      return;
    }

    await saveAttendance(student.student_id, status);
  };

  const confirmReason = async () => {
    if (!reasonSheet) return;
    const finalNote = reasonSheet.reason === '기타' ? reasonSheet.customReason.trim() : reasonSheet.reason;
    setReasonSheet(null);
    await saveAttendance(reasonSheet.studentId, reasonSheet.status, finalNote);
  };

  const markAllPresent = async () => {
    if (!scheduleId || saving || students.length === 0) return;
    const previousStatuses = new Map(attendances);
    const previousNotes = new Map(attendanceNotes);
    const nextStatuses = new Map<number, AttendanceStatus>();
    students.forEach((student) => nextStatuses.set(student.student_id, 'present'));

    setAttendances(nextStatuses);
    setAttendanceNotes(new Map());
    setSaving(true);
    try {
      await schedulesApi.submitAttendance(
        scheduleId,
        {
          attendance_records: students.map((student) => ({
            student_id: student.student_id,
            attendance_status: 'present',
          })),
        },
        { suppressErrorToast: true }
      );
      toast.success('전체 출석 처리되었습니다.');
    } catch {
      setAttendances(previousStatuses);
      setAttendanceNotes(previousNotes);
      toast.error(MOBILE_ATTENDANCE_MESSAGES.allPresent);
    } finally {
      setSaving(false);
    }
  };

  const callStudent = (phone?: string | null) => {
    if (!phone) {
      toast.error(MOBILE_ATTENDANCE_MESSAGES.noPhone);
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  return {
    attendanceNotes,
    attendances,
    callStudent,
    changeStatus,
    confirmReason,
    date,
    formattedDate,
    hasPermission,
    loadError,
    loading,
    markAllPresent,
    reasonSheet,
    reload: loadSchedule,
    router,
    saving,
    scheduleId,
    setDate,
    setReasonSheet,
    setTimeSlot,
    stats,
    students,
    timeSlot,
  };
}
