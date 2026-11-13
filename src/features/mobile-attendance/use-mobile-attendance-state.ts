import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { assignClassStudents, getClassRoster, withClassRoster } from '@/features/class-roster/class-roster-api';
import { schedulesApi } from '@/lib/api/schedules';
import { hapticForStatus } from '@/lib/attendance/haptics';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';
import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';
import { canEdit } from '@/lib/utils/permissions';
import { MOBILE_ATTENDANCE_MESSAGES } from './mobile-attendance-constants';
import type { MarkableAttendanceStatus, MobileAttendanceSchedule, MobileAttendanceStudent, ReasonSheetState } from './mobile-attendance-types';
import { calculateStats, formatDateLabel, isMarkableStatus, normalizeStudents, toLocalDateStr } from './mobile-attendance-utils';

interface LoadScheduleOptions {
  background?: boolean;
}

export function useMobileAttendanceState() {
  const router = useRouter();
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('evening');
  const [classId, setClassId] = useState<number | null>(null);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [students, setStudents] = useState<MobileAttendanceStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attendances, setAttendances] = useState<Map<number, AttendanceStatus>>(new Map());
  const [attendanceNotes, setAttendanceNotes] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [reasonSheet, setReasonSheet] = useState<ReasonSheetState | null>(null);

  const loadSchedule = useCallback(async ({ background = false }: LoadScheduleOptions = {}) => {
    if (!background) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const [response, roster] = await Promise.all([
        schedulesApi.getSlotData(date, timeSlot, { suppressErrorToast: true }),
        classId !== null ? getClassRoster(date, classId, timeSlot) : null,
      ]);
      const schedule = response.schedule as MobileAttendanceSchedule | null;
      const nextStudents: MobileAttendanceStudent[] = roster
        ? withClassRoster(normalizeStudents(schedule), roster.students)
        : normalizeStudents(schedule);
      const statusMap = new Map<number, AttendanceStatus>();
      const notesMap = new Map<number, string>();

      nextStudents.forEach((student) => {
        if (isMarkableStatus(student.attendance_status)) statusMap.set(student.student_id, student.attendance_status);
        if (student.notes) notesMap.set(student.student_id, student.notes);
      });

      setScheduleId(schedule?.id ?? roster?.schedule?.id ?? null);
      setStudents(nextStudents);
      setAttendances(statusMap);
      setAttendanceNotes(notesMap);
      setLoadError(null);
    } catch {
      if (!background) {
        setScheduleId(null);
        setStudents([]);
        setAttendances(new Map());
        setAttendanceNotes(new Map());
        setLoadError(MOBILE_ATTENDANCE_MESSAGES.load);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [classId, date, timeSlot]);

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
      void loadSchedule({ background: true });
    },
  });

  const stats = useMemo(() => calculateStats(students, attendances), [attendances, students]);
  const formattedDate = useMemo(() => formatDateLabel(date), [date]);

  // 반으로 볼 때 그날 수업에 없던 학생은 먼저 수업에 넣는다. 저장할 수업 id 를 돌려준다.
  const assignMissing = async (targets: MobileAttendanceStudent[]) => {
    const missing = targets.filter((student) => student.assigned === false).map((student) => student.student_id);
    if (missing.length === 0 || classId === null) return scheduleId;
    const nextScheduleId = await assignClassStudents(date, timeSlot, classId, missing);
    setScheduleId(nextScheduleId);
    setStudents((prev) => prev.map((student) => (missing.includes(student.student_id) ? { ...student, assigned: true } : student)));
    return nextScheduleId;
  };

  const saveAttendance = async (studentId: number, status: AttendanceStatus | 'none', notes?: string) => {
    if ((!scheduleId && classId === null) || saving) return;

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
      const targetId = await assignMissing(students.filter((student) => student.student_id === studentId));
      if (!targetId) throw new Error('수업을 찾을 수 없습니다.');
      await schedulesApi.submitAttendance(
        targetId,
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
    if ((!scheduleId && classId === null) || saving) return;
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
    if ((!scheduleId && classId === null) || saving || students.length === 0) return;
    const previousStatuses = new Map(attendances);
    const previousNotes = new Map(attendanceNotes);
    const nextStatuses = new Map<number, AttendanceStatus>();
    students.forEach((student) => nextStatuses.set(student.student_id, 'present'));

    setAttendances(nextStatuses);
    setAttendanceNotes(new Map());
    setSaving(true);
    try {
      const targetId = await assignMissing(students);
      if (!targetId) throw new Error('수업을 찾을 수 없습니다.');
      await schedulesApi.submitAttendance(
        targetId,
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
    classId,
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
    setClassId,
    setDate,
    setReasonSheet,
    setTimeSlot,
    stats,
    students,
    timeSlot,
  };
}
