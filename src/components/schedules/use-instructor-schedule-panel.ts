'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import type { TimeSlot } from '@/lib/types/schedule';
import {
  INSTRUCTOR_SCHEDULE_LOAD_ERROR,
  INSTRUCTOR_SCHEDULE_SAVE_ERROR,
  INSTRUCTOR_SCHEDULE_TIME_SLOTS,
} from './instructor-schedule-constants';
import type {
  InstructorScheduleInstructor,
  InstructorSchedulePayloadEntry,
  InstructorSchedulesBySlot,
  InstructorScheduleSelections,
} from './instructor-schedule-types';

const QUIET_REQUEST = { suppressErrorToast: true };
const EMPTY_SCHEDULES: InstructorSchedulesBySlot = { morning: [], afternoon: [], evening: [] };

interface Params {
  date: string | null;
  onSave?: () => void;
}

function createEmptySelections(): InstructorScheduleSelections {
  return { morning: {}, afternoon: {}, evening: {} };
}

function buildSelections(schedules: Partial<InstructorSchedulesBySlot> | undefined): InstructorScheduleSelections {
  const selections = createEmptySelections();

  INSTRUCTOR_SCHEDULE_TIME_SLOTS.forEach(({ slot }) => {
    const slotSchedules = schedules?.[slot] || [];
    slotSchedules.forEach((schedule) => {
      selections[slot][schedule.instructor_id] = {
        selected: true,
        startTime: schedule.scheduled_start_time || undefined,
        endTime: schedule.scheduled_end_time || undefined,
      };
    });
  });

  return selections;
}

function buildPayload(selections: InstructorScheduleSelections): InstructorSchedulePayloadEntry[] {
  const payload: InstructorSchedulePayloadEntry[] = [];

  INSTRUCTOR_SCHEDULE_TIME_SLOTS.forEach(({ slot }) => {
    Object.entries(selections[slot]).forEach(([id, data]) => {
      if (data.selected) {
        payload.push({
          instructor_id: Number(id),
          time_slot: slot,
          scheduled_start_time: data.startTime,
          scheduled_end_time: data.endTime,
        });
      }
    });
  });

  return payload;
}

function countSelected(selections: InstructorScheduleSelections, slot?: TimeSlot): number {
  if (slot) {
    return Object.values(selections[slot]).filter((selection) => selection.selected).length;
  }

  return INSTRUCTOR_SCHEDULE_TIME_SLOTS.reduce((sum, item) => sum + countSelected(selections, item.slot), 0);
}

export function useInstructorSchedulePanel({ date, onSave }: Params) {
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('morning');
  const [instructors, setInstructors] = useState<InstructorScheduleInstructor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selections, setSelections] = useState<InstructorScheduleSelections>(() => createEmptySelections());

  const loadSchedules = useCallback(async () => {
    if (!date) return;

    try {
      setLoading(true);
      setLoadError(null);
      setSaveError(null);
      const response = await apiClient.get<{
        instructors: InstructorScheduleInstructor[];
        schedules?: Partial<InstructorSchedulesBySlot>;
      }>(`/schedules/date/${date}/instructor-schedules`, QUIET_REQUEST);

      setInstructors(response.instructors || []);
      setSelections(buildSelections(response.schedules || EMPTY_SCHEDULES));
    } catch (error) {
      console.warn('강사 배정 정보를 불러오지 못했습니다.', error);
      setLoadError(INSTRUCTOR_SCHEDULE_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const activeSlotInfo = useMemo(
    () => INSTRUCTOR_SCHEDULE_TIME_SLOTS.find((item) => item.slot === activeSlot) || INSTRUCTOR_SCHEDULE_TIME_SLOTS[0],
    [activeSlot]
  );

  const slotCounts = useMemo(() => ({
    morning: countSelected(selections, 'morning'),
    afternoon: countSelected(selections, 'afternoon'),
    evening: countSelected(selections, 'evening'),
  }), [selections]);

  const selectedCount = slotCounts[activeSlot];
  const totalSelectedCount = useMemo(() => countSelected(selections), [selections]);

  const toggleInstructor = (instructor: InstructorScheduleInstructor) => {
    setSaveError(null);
    setSelections((previous) => {
      const current = previous[activeSlot][instructor.id];

      if (current?.selected) {
        const rest = { ...previous[activeSlot] };
        delete rest[instructor.id];
        return { ...previous, [activeSlot]: rest };
      }

      return {
        ...previous,
        [activeSlot]: {
          ...previous[activeSlot],
          [instructor.id]: {
            selected: true,
            startTime: instructor.salary_type === 'hourly' ? activeSlotInfo.defaultStart : undefined,
            endTime: instructor.salary_type === 'hourly' ? activeSlotInfo.defaultEnd : undefined,
          },
        },
      };
    });
  };

  const updateTime = (instructorId: number, field: 'startTime' | 'endTime', value: string) => {
    setSaveError(null);
    setSelections((previous) => ({
      ...previous,
      [activeSlot]: {
        ...previous[activeSlot],
        [instructorId]: {
          ...previous[activeSlot][instructorId],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!date) return;

    try {
      setSaving(true);
      setSaveError(null);
      await apiClient.post(
        `/schedules/date/${date}/instructor-schedules`,
        { schedules: buildPayload(selections) },
        QUIET_REQUEST
      );

      toast.success('강사 일정이 저장되었습니다.');
      await loadSchedules();
      onSave?.();
    } catch (error) {
      console.warn('강사 배정 정보를 저장하지 못했습니다.', error);
      setSaveError(INSTRUCTOR_SCHEDULE_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return {
    activeSlot,
    activeSlotInfo,
    handleSave,
    instructors,
    loading,
    loadError,
    loadSchedules,
    saveError,
    saving,
    selectedCount,
    selections,
    setActiveSlot,
    slotCounts,
    toggleInstructor,
    totalSelectedCount,
    updateTime,
  };
}
