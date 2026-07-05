'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useInstructorAttendanceRealtime } from '@/hooks/use-attendance-realtime';
import { schedulesApi, type InstructorAttendanceRecord, type InstructorAttendanceSubmission } from '@/lib/api/schedules';
import type { TimeSlot } from '@/lib/types/schedule';
import {
  INSTRUCTOR_ATTENDANCE_LOAD_ERROR,
  INSTRUCTOR_ATTENDANCE_SAVE_ERROR,
} from './instructor-attendance-constants';
import type {
  EditedInstructorAttendance,
  InstructorAttendanceStatus,
  InstructorOption,
  InstructorsBySlot,
} from './instructor-attendance-types';

const QUIET_REQUEST = { suppressErrorToast: true };

interface Params {
  date: string;
  onSuccess?: () => void;
}

function emptyInstructorsBySlot(): InstructorsBySlot {
  return { morning: [], afternoon: [], evening: [] };
}

function normalizeInstructorsBySlot(
  source: Partial<InstructorsBySlot> | undefined,
  fallback: InstructorOption[]
): InstructorsBySlot {
  if (!source) {
    return { morning: fallback, afternoon: fallback, evening: fallback };
  }

  return {
    morning: source.morning || [],
    afternoon: source.afternoon || [],
    evening: source.evening || [],
  };
}

function buildSubmissions(
  editedAttendances: Map<number, EditedInstructorAttendance>,
  selectedTimeSlot: TimeSlot
): InstructorAttendanceSubmission[] {
  const attendances: InstructorAttendanceSubmission[] = [];

  editedAttendances.forEach((data, instructorId) => {
    attendances.push({
      instructor_id: instructorId,
      time_slot: selectedTimeSlot,
      attendance_status: data.status,
      check_in_time: data.checkInTime,
      check_out_time: data.checkOutTime,
      notes: data.notes,
    });
  });

  return attendances;
}

function createInitialEdits(
  records: InstructorAttendanceRecord[],
  selectedTimeSlot: TimeSlot
): Map<number, EditedInstructorAttendance> {
  const initialEdits = new Map<number, EditedInstructorAttendance>();

  records.forEach((record) => {
    if (record.time_slot === selectedTimeSlot) {
      initialEdits.set(record.instructor_id, {
        status: record.attendance_status,
        checkInTime: record.check_in_time,
        checkOutTime: record.check_out_time,
        notes: record.notes,
      });
    }
  });

  return initialEdits;
}

export function useInstructorAttendanceChecker({ date, onSuccess }: Params) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [instructorsBySlot, setInstructorsBySlot] = useState<InstructorsBySlot>(() => emptyInstructorsBySlot());
  const [existingRecords, setExistingRecords] = useState<InstructorAttendanceRecord[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>('afternoon');
  const [editedAttendances, setEditedAttendances] = useState<Map<number, EditedInstructorAttendance>>(new Map());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await schedulesApi.getInstructorAttendanceByDate(date, QUIET_REQUEST);
      const allInstructors = response.instructors || [];

      setInstructorsBySlot(normalizeInstructorsBySlot(response.instructors_by_slot, allInstructors));
      setExistingRecords(response.attendances || []);
    } catch (error) {
      console.warn('강사 출근 정보를 불러오지 못했습니다.', error);
      setLoadError(INSTRUCTOR_ATTENDANCE_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useInstructorAttendanceRealtime({
    date,
    enabled: true,
    onInstructorAttendanceUpdated: () => {
      void loadData();
    },
  });

  useEffect(() => {
    setEditedAttendances(createInitialEdits(existingRecords, selectedTimeSlot));
  }, [selectedTimeSlot, existingRecords]);

  const currentSlotInstructors = instructorsBySlot[selectedTimeSlot] || [];

  const slotCounts = useMemo(() => ({
    morning: instructorsBySlot.morning.length,
    afternoon: instructorsBySlot.afternoon.length,
    evening: instructorsBySlot.evening.length,
  }), [instructorsBySlot]);

  const stats = useMemo(() => ({
    total: currentSlotInstructors.length,
    checked: editedAttendances.size,
    present: Array.from(editedAttendances.values()).filter((attendance) => attendance.status === 'present').length,
    absent: Array.from(editedAttendances.values()).filter((attendance) => attendance.status === 'absent').length,
    late: Array.from(editedAttendances.values()).filter((attendance) => attendance.status === 'late').length,
    halfDay: Array.from(editedAttendances.values()).filter((attendance) => attendance.status === 'half_day').length,
  }), [currentSlotInstructors.length, editedAttendances]);

  const handleTimeSlotChange = (timeSlot: TimeSlot) => {
    setSaveError(null);
    setSelectedTimeSlot(timeSlot);
  };

  const handleStatusChange = (instructorId: number, status: InstructorAttendanceStatus) => {
    setSaveError(null);
    setEditedAttendances((previous) => {
      const next = new Map(previous);
      const current = next.get(instructorId) || { status: 'present' };
      next.set(instructorId, { ...current, status });
      return next;
    });
  };

  const handleTimeChange = (instructorId: number, field: 'checkInTime' | 'checkOutTime', value: string) => {
    setSaveError(null);
    setEditedAttendances((previous) => {
      const next = new Map(previous);
      const current = next.get(instructorId) || { status: 'present' };
      next.set(instructorId, { ...current, [field]: value });
      return next;
    });
  };

  const handleMarkAllPresent = () => {
    setSaveError(null);
    const next = new Map<number, EditedInstructorAttendance>();

    currentSlotInstructors.forEach((instructor) => {
      const existing = editedAttendances.get(instructor.id);
      next.set(instructor.id, { ...existing, status: 'present' });
    });

    setEditedAttendances(next);
  };

  const handleSubmit = async () => {
    if (editedAttendances.size === 0) {
      toast.error('출근 체크할 강사를 선택해주세요.');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      const attendances = buildSubmissions(editedAttendances, selectedTimeSlot);

      await schedulesApi.submitInstructorAttendance(date, { attendances }, QUIET_REQUEST);
      toast.success(`${attendances.length}명의 강사 출근이 체크되었습니다.`);
      onSuccess?.();
      loadData();
    } catch (error) {
      console.warn('강사 출근 정보를 저장하지 못했습니다.', error);
      setSaveError(INSTRUCTOR_ATTENDANCE_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return {
    currentSlotInstructors,
    editedAttendances,
    handleMarkAllPresent,
    handleStatusChange,
    handleSubmit,
    handleTimeChange,
    handleTimeSlotChange,
    loadData,
    loading,
    loadError,
    saveError,
    saving,
    selectedTimeSlot,
    slotCounts,
    stats,
  };
}
