import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createDirectConsultation, getBookedTimes, getConsultations, updateConsultation } from '@/lib/api/consultations';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { canView } from '@/lib/utils/permissions';
import { MOBILE_CONSULTATION_MESSAGES } from './mobile-consultations-constants';
import type { CalendarMonth, CreateConsultationForm, ConsultationStats } from './mobile-consultations-types';
import { getSelectedDateLabel, isFinishedStatus, toLocalDateStr } from './mobile-consultations-utils';

const EMPTY_CREATE_FORM: CreateConsultationForm = {
  studentName: '',
  phone: '',
  grade: '',
  preferredDate: '',
  preferredTime: '',
  notes: '',
};

export function useMobileConsultationsState() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateConsultationForm>(EMPTY_CREATE_FORM);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonth>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});

  const loadConsultations = useCallback(async (date: Date) => {
    setLoading(true);
    setListError(null);
    try {
      const dateStr = toLocalDateStr(date);
      const response = await getConsultations({ startDate: dateStr, endDate: dateStr }, { suppressErrorToast: true });
      const sorted = [...(response.consultations || [])].sort((a, b) =>
        (a.preferred_time || '00:00').localeCompare(b.preferred_time || '00:00')
      );
      setConsultations(sorted);
    } catch {
      setConsultations([]);
      setListError(MOBILE_CONSULTATION_MESSAGES.load);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMonthCounts = useCallback(async (year: number, month: number) => {
    try {
      const startDate = toLocalDateStr(new Date(year, month, 1));
      const endDate = toLocalDateStr(new Date(year, month + 1, 0));
      const response = await getConsultations({ startDate, endDate, limit: 500 }, { suppressErrorToast: true });
      const counts: Record<string, number> = {};
      (response.consultations || []).forEach((consultation) => {
        const dateKey = consultation.preferred_date?.slice(0, 10);
        if (dateKey) counts[dateKey] = (counts[dateKey] || 0) + 1;
      });
      setMonthCounts(counts);
    } catch {
      setMonthCounts({});
    }
  }, []);

  const loadBookedTimes = useCallback(async (date: string) => {
    try {
      const response = await getBookedTimes(date, { suppressErrorToast: true });
      setBookedTimes(response.bookedTimes || []);
    } catch {
      setBookedTimes([]);
      toast.error(MOBILE_CONSULTATION_MESSAGES.bookedTimes);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!canView('consultations')) {
      router.push('/m');
      return;
    }
    setHasPermission(true);
  }, [router]);

  useEffect(() => {
    if (hasPermission) void loadConsultations(selectedDate);
  }, [hasPermission, loadConsultations, selectedDate]);

  useEffect(() => {
    if (hasPermission && showCalendar) void loadMonthCounts(calendarMonth.year, calendarMonth.month);
  }, [calendarMonth.month, calendarMonth.year, hasPermission, loadMonthCounts, showCalendar]);

  const stats: ConsultationStats = useMemo(() => {
    const finished = consultations.filter((consultation) => isFinishedStatus(consultation.status)).length;
    return {
      total: consultations.length,
      active: consultations.length - finished,
      finished,
      pending: consultations.filter((consultation) => consultation.status === 'pending').length,
      confirmed: consultations.filter((consultation) => consultation.status === 'confirmed').length,
    };
  }, [consultations]);

  const selectedDateLabel = useMemo(() => getSelectedDateLabel(selectedDate, today), [selectedDate, today]);

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev.year, prev.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const openCreateForm = () => {
    const date = toLocalDateStr(selectedDate);
    setCreateForm({ ...EMPTY_CREATE_FORM, preferredDate: date });
    setShowCreateForm(true);
    void loadBookedTimes(date);
  };

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setBookedTimes([]);
  };

  const updateCreateForm = (patch: Partial<CreateConsultationForm>) => {
    setCreateForm((prev) => ({ ...prev, ...patch }));
  };

  const changeCreateDate = (preferredDate: string) => {
    updateCreateForm({ preferredDate, preferredTime: '' });
    if (preferredDate) void loadBookedTimes(preferredDate);
  };

  const createConsultation = async () => {
    const missing: string[] = [];
    if (!createForm.studentName) missing.push('학생명');
    if (!createForm.phone) missing.push('연락처');
    if (!createForm.grade) missing.push('학년');
    if (!createForm.preferredDate) missing.push('상담일');
    if (!createForm.preferredTime) missing.push('시간');
    if (missing.length > 0) {
      toast.error(`${missing.join(', ')}을(를) 입력해주세요.`);
      return;
    }

    setCreating(true);
    try {
      await createDirectConsultation(createForm, { suppressErrorToast: true });
      toast.success('상담이 등록되었습니다.');
      closeCreateForm();
      await loadConsultations(selectedDate);
    } catch {
      toast.error(MOBILE_CONSULTATION_MESSAGES.create);
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (consultation: Consultation, status: ConsultationStatus) => {
    if (consultation.status === status) return;
    setUpdatingStatus(true);
    try {
      await updateConsultation(consultation.id, { status }, { suppressErrorToast: true });
      toast.success('상태가 변경되었습니다.');
      setSelectedConsultation({ ...consultation, status });
      setShowStatusChange(false);
      await loadConsultations(selectedDate);
    } catch {
      toast.error(MOBILE_CONSULTATION_MESSAGES.status);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return {
    bookedTimes,
    calendarMonth,
    changeCreateDate,
    changeStatus,
    closeCreateForm,
    consultations,
    createConsultation,
    createForm,
    creating,
    hasPermission,
    listError,
    loadConsultations: () => loadConsultations(selectedDate),
    monthCounts,
    moveCalendarMonth,
    openCreateForm,
    router,
    selectDate,
    selectedConsultation,
    selectedDate,
    selectedDateLabel,
    setCalendarMonth,
    setSelectedConsultation,
    setShowCalendar,
    setShowStatusChange,
    showCalendar,
    showCreateForm,
    showStatusChange,
    stats,
    today,
    updateCreateForm,
    updatingStatus,
    loading,
  };
}
