import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { assignClassStudents, getClassRoster, withClassRoster } from '@/features/class-roster/class-roster-api';
import { schedulesApi } from '@/lib/api/schedules';
import { hapticForStatus } from '@/lib/attendance/haptics';
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';
import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';
import { TABLET_ATTENDANCE_MESSAGES } from './tablet-attendance-constants';
import type {
  TabletAttendanceFilters,
  TabletAttendanceMark,
  TabletAttendanceSchedule,
  TabletAttendanceStudent,
  TabletReasonState,
} from './tablet-attendance-types';
import {
  addDays,
  calculateTabletStats,
  filterTabletStudents,
  formatTabletDate,
  isMarkableStatus,
  toLocalDateStr,
} from './tablet-attendance-utils';

const DEFAULT_FILTERS: TabletAttendanceFilters = { query: '', status: 'all', studentType: 'all' };

interface LoadScheduleOptions {
  background?: boolean;
}

export function useTabletAttendanceState() {
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('evening');
  const [classId, setClassId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<TabletAttendanceSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<TabletAttendanceFilters>(DEFAULT_FILTERS);
  const [reasonState, setReasonState] = useState<TabletReasonState | null>(null);

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
      const nextSchedule = response.schedule as TabletAttendanceSchedule | null;
      const slotStudents: TabletAttendanceStudent[] = (nextSchedule?.students || []).map((student) => ({
        ...student,
        attendance_status: isMarkableStatus(student.attendance_status) ? student.attendance_status : null,
        notes: student.notes ?? null,
      }));
      if (roster) {
        setSchedule({
          id: nextSchedule?.id ?? roster.schedule?.id ?? null,
          students: withClassRoster(slotStudents, roster.students),
        });
      } else {
        setSchedule(nextSchedule ? { ...nextSchedule, students: slotStudents } : null);
      }
      setLoadError(null);
    } catch {
      if (!background) {
        setSchedule(null);
        setLoadError(TABLET_ATTENDANCE_MESSAGES.load);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [classId, date, timeSlot]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useAttendanceRealtime({
    scheduleId: schedule?.id ?? null,
    onAttendanceUpdated: () => {
      void loadSchedule({ background: true });
    },
  });

  const students = useMemo(() => schedule?.students || [], [schedule]);
  const filteredStudents = useMemo(() => filterTabletStudents(students, filters), [filters, students]);
  const stats = useMemo(() => calculateTabletStats(students), [students]);
  const filteredStats = useMemo(() => calculateTabletStats(filteredStudents), [filteredStudents]);
  const dateLabel = useMemo(() => formatTabletDate(date), [date]);
  const isToday = date === toLocalDateStr(new Date());

  const patchStudent = (studentId: number, patch: Partial<TabletAttendanceStudent>) => {
    setSchedule((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map((student) => (
          student.student_id === studentId ? { ...student, ...patch } : student
        )),
      };
    });
  };

  // 반으로 볼 때 그날 수업에 없던 학생은 먼저 수업에 넣는다. 저장할 수업 id 를 돌려준다.
  const assignMissing = async (current: TabletAttendanceSchedule, targets: TabletAttendanceStudent[]) => {
    const missing = targets.filter((student) => student.assigned === false).map((student) => student.student_id);
    if (missing.length === 0 || classId === null) return current.id;
    const scheduleId = await assignClassStudents(date, timeSlot, classId, missing);
    setSchedule((prev) => prev && {
      ...prev,
      id: scheduleId,
      students: prev.students.map((student) => (missing.includes(student.student_id) ? { ...student, assigned: true } : student)),
    });
    return scheduleId;
  };

  const saveAttendance = async (studentId: number, status: AttendanceStatus | 'none', notes?: string) => {
    if (!schedule || savingId !== null) return;
    const previousSchedule = schedule;
    const nextStatus = status === 'none' ? null : status;
    const nextNotes = nextStatus === 'absent' || nextStatus === 'excused' ? notes || '' : null;

    patchStudent(studentId, { attendance_status: nextStatus, notes: nextNotes });
    setSavingId(studentId);
    try {
      const targetId = await assignMissing(schedule, students.filter((student) => student.student_id === studentId));
      if (!targetId) throw new Error('수업을 찾을 수 없습니다.');
      await schedulesApi.submitAttendance(
        targetId,
        { attendance_records: [{ student_id: studentId, attendance_status: status, notes: nextNotes || undefined }] },
        { suppressErrorToast: true }
      );
    } catch {
      setSchedule(previousSchedule);
      if (classId !== null) void loadSchedule({ background: true });
      toast.error(TABLET_ATTENDANCE_MESSAGES.save);
    } finally {
      setSavingId(null);
    }
  };

  const changeAttendance = async (student: TabletAttendanceStudent, status: TabletAttendanceMark) => {
    if (!schedule || savingId !== null) return;
    if (student.attendance_status === status) {
      await saveAttendance(student.student_id, 'none');
      return;
    }

    hapticForStatus(status);
    if (status === 'absent' || status === 'excused') {
      setReasonState({ studentId: student.student_id, studentName: student.student_name, status, reason: '', customReason: '' });
      return;
    }

    await saveAttendance(student.student_id, status);
  };

  const confirmReason = async () => {
    if (!reasonState) return;
    const notes = reasonState.reason === '기타' ? reasonState.customReason.trim() : reasonState.reason;
    setReasonState(null);
    await saveAttendance(reasonState.studentId, reasonState.status, notes);
  };

  const markAllPresent = async () => {
    if (!schedule || savingId !== null || students.length === 0) return;
    const alreadyAllPresent = students.every((student) => student.attendance_status === 'present');
    if (alreadyAllPresent) return;

    const previousSchedule = schedule;
    setSchedule({
      ...schedule,
      students: schedule.students.map((student) => ({ ...student, attendance_status: 'present', notes: null })),
    });
    setSavingId(-1);
    try {
      const targetId = await assignMissing(schedule, schedule.students);
      if (!targetId) throw new Error('수업을 찾을 수 없습니다.');
      await schedulesApi.submitAttendance(
        targetId,
        {
          attendance_records: schedule.students.map((student) => ({
            student_id: student.student_id,
            attendance_status: 'present',
          })),
        },
        { suppressErrorToast: true }
      );
      toast.success('전체 출석 처리되었습니다.');
    } catch {
      setSchedule(previousSchedule);
      if (classId !== null) void loadSchedule({ background: true });
      toast.error(TABLET_ATTENDANCE_MESSAGES.allPresent);
    } finally {
      setSavingId(null);
    }
  };

  return {
    changeAttendance,
    classId,
    confirmReason,
    date,
    dateLabel,
    filteredStats,
    filteredStudents,
    filters,
    isToday,
    loadError,
    loading,
    markAllPresent,
    nextDate: () => setDate((current) => addDays(current, 1)),
    previousDate: () => setDate((current) => addDays(current, -1)),
    reasonState,
    reload: loadSchedule,
    savingId,
    schedule,
    setClassId,
    setDate,
    setFilters,
    setReasonState,
    setTimeSlot,
    stats,
    students,
    timeSlot,
  };
}
