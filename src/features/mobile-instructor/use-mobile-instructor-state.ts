import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { schedulesApi, type InstructorAttendanceSubmission } from '@/lib/api/schedules';
import { canEdit } from '@/lib/utils/permissions';
import { MOBILE_INSTRUCTOR_MESSAGES, MOBILE_INSTRUCTOR_TIME_SLOTS } from './mobile-instructor-constants';
import type { MobileInstructor, MobileInstructorAttendanceStatus, MobileInstructorTimeSlot } from './mobile-instructor-types';
import {
  buildAttendanceMap,
  calculateInstructorStats,
  formatDateLabel,
  makeInstructorKey,
  normalizeInstructorsBySlot,
  parseInstructorKey,
  toLocalDateStr,
} from './mobile-instructor-utils';

export function useMobileInstructorState() {
  const router = useRouter();
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [instructorsBySlot, setInstructorsBySlot] = useState<Record<MobileInstructorTimeSlot, MobileInstructor[]>>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [attendances, setAttendances] = useState<Map<string, MobileInstructorAttendanceStatus>>(new Map());
  const [initialAttendances, setInitialAttendances] = useState<Map<string, MobileInstructorAttendanceStatus>>(new Map());
  const [clearedKeys, setClearedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const loadInstructorAttendance = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await schedulesApi.getInstructorAttendanceByDate(date, { suppressErrorToast: true });
      const slots = normalizeInstructorsBySlot(response);
      const initial = buildAttendanceMap(response.attendances || []);
      setInstructorsBySlot(slots);
      setAttendances(initial);
      setInitialAttendances(initial);
      setClearedKeys(new Set());
    } catch {
      setInstructorsBySlot({ morning: [], afternoon: [], evening: [] });
      setAttendances(new Map());
      setInitialAttendances(new Map());
      setClearedKeys(new Set());
      setLoadError(MOBILE_INSTRUCTOR_MESSAGES.load);
    } finally {
      setLoading(false);
    }
  }, [date]);

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
    if (hasPermission) void loadInstructorAttendance();
  }, [hasPermission, loadInstructorAttendance]);

  const stats = useMemo(
    () => calculateInstructorStats(instructorsBySlot, attendances, clearedKeys),
    [attendances, clearedKeys, instructorsBySlot]
  );

  const formattedDate = useMemo(() => formatDateLabel(date), [date]);
  const pendingRecords = useMemo(() => {
    const records: InstructorAttendanceSubmission[] = [];
    attendances.forEach((status, key) => {
      if (initialAttendances.get(key) === status) return;
      const { instructorId, timeSlot } = parseInstructorKey(key);
      records.push({ instructor_id: instructorId, time_slot: timeSlot, attendance_status: status });
    });
    clearedKeys.forEach((key) => {
      if (attendances.has(key)) return;
      const { instructorId, timeSlot } = parseInstructorKey(key);
      records.push({ instructor_id: instructorId, time_slot: timeSlot, attendance_status: 'none' });
    });
    return records;
  }, [attendances, clearedKeys, initialAttendances]);
  const submitCount = pendingRecords.length;

  const changeStatus = (
    instructorId: number,
    timeSlot: MobileInstructorTimeSlot,
    status: MobileInstructorAttendanceStatus
  ) => {
    if (saving) return;
    const key = makeInstructorKey(instructorId, timeSlot);
    const currentStatus = attendances.get(key);
    const shouldClear = currentStatus === status;

    setAttendances((prev) => {
      const next = new Map(prev);
      if (shouldClear) next.delete(key);
      else next.set(key, status);
      return next;
    });

    setClearedKeys((prev) => {
      const next = new Set(prev);
      if (shouldClear && initialAttendances.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const markSlotPresent = (timeSlot: MobileInstructorTimeSlot) => {
    if (saving) return;
    const instructors = instructorsBySlot[timeSlot];
    if (instructors.length === 0) return;

    setAttendances((prev) => {
      const next = new Map(prev);
      instructors.forEach((instructor) => next.set(makeInstructorKey(instructor.id, timeSlot), 'present'));
      return next;
    });
    setClearedKeys((prev) => {
      const next = new Set(prev);
      instructors.forEach((instructor) => next.delete(makeInstructorKey(instructor.id, timeSlot)));
      return next;
    });
  };

  const save = async () => {
    if (submitCount === 0) {
      toast.error(MOBILE_INSTRUCTOR_MESSAGES.noSelection);
      return;
    }

    setSaving(true);
    try {
      await schedulesApi.submitInstructorAttendance(date, { attendances: pendingRecords }, { suppressErrorToast: true });
      toast.success('강사 출근이 저장되었습니다.');
      await loadInstructorAttendance();
    } catch {
      toast.error(MOBILE_INSTRUCTOR_MESSAGES.save);
    } finally {
      setSaving(false);
    }
  };

  return {
    attendances,
    changeStatus,
    clearedKeys,
    date,
    formattedDate,
    hasPermission,
    instructorsBySlot,
    loadError,
    loading,
    markSlotPresent,
    reload: loadInstructorAttendance,
    router,
    save,
    saving,
    setDate,
    slots: MOBILE_INSTRUCTOR_TIME_SLOTS,
    stats,
    submitCount,
  };
}
