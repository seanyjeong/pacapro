import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Consultation } from '@/lib/types/consultation';
import type { ClassSchedule, ScheduleFilters, TimeSlot } from '@/lib/types/schedule';
import type { DailyInstructorStats } from '@/lib/api/schedules';
import { canEdit, canView } from '@/lib/utils/permissions';
import { getMonthRange, getToday } from '@/lib/utils/schedule-helpers';
import {
  deleteScheduleForPage,
  fetchConsultationEvents,
  fetchMonthlyInstructorStats,
  fetchPendingOvertimeCount,
  fetchSchedulesForPage,
} from './schedules-page-api';
import { createInitialScheduleFilters, getInitialYearMonth, SCHEDULE_DELETE_ERROR, SCHEDULES_LOAD_ERROR } from './schedules-page-utils';

export function useSchedulesPageState() {
  const initial = getInitialYearMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(getToday());
  const [currentYear, setCurrentYear] = useState(initial.year);
  const [currentMonth, setCurrentMonth] = useState(initial.month);
  const [filters, setFilters] = useState<ScheduleFilters>(() => createInitialScheduleFilters());
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [instructorAttendanceModalOpen, setInstructorAttendanceModalOpen] = useState(false);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; slot: TimeSlot } | null>(null);
  const [extraDayModalOpen, setExtraDayModalOpen] = useState(false);
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [instructorStats, setInstructorStats] = useState<Record<string, DailyInstructorStats>>({});
  const [consultations, setConsultations] = useState<Record<string, Consultation[]>>({});
  const [canViewOvertimeApproval, setCanViewOvertimeApproval] = useState(false);
  const [canEditSchedules, setCanEditSchedules] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    setSchedulesError(null);
    try {
      setSchedules(await fetchSchedulesForPage(filters));
    } catch {
      setSchedules([]);
      setSchedulesError(SCHEDULES_LOAD_ERROR);
    } finally {
      setSchedulesLoading(false);
    }
  }, [filters]);

  const loadPendingCount = useCallback(async () => {
    if (!canViewOvertimeApproval) return;
    try {
      setPendingCount(await fetchPendingOvertimeCount());
    } catch {
      setPendingCount(0);
    }
  }, [canViewOvertimeApproval]);

  const loadInstructorStats = useCallback(async () => {
    try {
      setInstructorStats(await fetchMonthlyInstructorStats(currentYear, currentMonth));
    } catch {
      setInstructorStats({});
    }
  }, [currentMonth, currentYear]);

  const loadConsultations = useCallback(async () => {
    try {
      const { start, end } = getMonthRange(currentYear, currentMonth);
      setConsultations(await fetchConsultationEvents(start, end));
    } catch {
      setConsultations({});
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    setCanViewOvertimeApproval(canView('overtime_approval'));
    setCanEditSchedules(canEdit('schedules'));
    const savedPanelState = localStorage.getItem('instructor_panel_expanded');
    if (savedPanelState !== null) setIsPanelExpanded(savedPanelState === 'true');
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  useEffect(() => {
    loadInstructorStats();
    loadConsultations();
  }, [loadConsultations, loadInstructorStats]);

  const togglePanel = () => {
    setIsPanelExpanded((current) => {
      const next = !current;
      localStorage.setItem('instructor_panel_expanded', String(next));
      return next;
    });
  };

  const changeMonth = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    const { start, end } = getMonthRange(year, month);
    setFilters((current) => ({ ...current, start_date: start, end_date: end }));
  };

  const selectSlot = (date: string, slot: TimeSlot) => {
    setSelectedSlot({ date, slot });
    setSlotModalOpen(true);
  };

  const refreshScheduleSurface = async () => {
    await Promise.all([loadSchedules(), loadInstructorStats()]);
  };

  const deleteSchedule = async (scheduleId: number) => {
    try {
      await deleteScheduleForPage(scheduleId);
      toast.success('수업이 삭제되었습니다.');
      await loadSchedules();
      return true;
    } catch {
      toast.error(SCHEDULE_DELETE_ERROR);
      return false;
    }
  };

  const refreshAfterApproval = async () => {
    await loadPendingCount();
    await refreshScheduleSurface();
  };

  return {
    approvalsModalOpen,
    canEditSchedules,
    canViewOvertimeApproval,
    changeMonth,
    consultations,
    currentMonth,
    currentYear,
    deleteSchedule,
    extraDayModalOpen,
    instructorAttendanceModalOpen,
    instructorStats,
    isPanelExpanded,
    loadInstructorStats,
    pendingCount,
    refreshAfterApproval,
    refreshScheduleSurface,
    schedules,
    schedulesError,
    schedulesLoading,
    selectedDate,
    selectedSlot,
    selectSlot,
    setApprovalsModalOpen,
    setExtraDayModalOpen,
    setInstructorAttendanceModalOpen,
    setSelectedDate,
    setSelectedSlot,
    setSlotModalOpen,
    slotModalOpen,
    togglePanel,
  };
}
