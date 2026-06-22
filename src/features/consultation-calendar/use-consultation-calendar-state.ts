import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, isSameDay, parseISO, subMonths } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { getConsultations } from '@/lib/api/consultations';
import type { Consultation, LearningType } from '@/lib/types/consultation';
import { createDefaultLearningForm } from './consultation-calendar-constants';
import { getCalendarErrorMessage, SILENT_CONFIG } from './consultation-calendar-error-utils';
import type {
  CalendarStudent,
  LearningConsultationForm,
  StudentConsultationMemo,
} from './consultation-calendar-types';
import {
  getCalendarDays,
  getConsultationsForDate,
  getInitialMonth,
  getMemosForDate,
  getMonthRange,
  getStartPadding,
} from './consultation-calendar-utils';

export function useConsultationCalendarState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSchedule = searchParams.get('from') === 'schedule';
  const dateParam = searchParams.get('date');

  const [currentMonth, setCurrentMonth] = useState(() => getInitialMonth(dateParam));
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [studentMemos, setStudentMemos] = useState<StudentConsultationMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedConsultations, setSelectedConsultations] = useState<Consultation[]>([]);
  const [dayListModalOpen, setDayListModalOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [learningModalOpen, setLearningModalOpen] = useState(false);
  const [learningModalDate, setLearningModalDate] = useState<Date | null>(null);
  const [students, setStudents] = useState<CalendarStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [learningForm, setLearningForm] = useState<LearningConsultationForm>(() => createDefaultLearningForm());
  const [submitting, setSubmitting] = useState(false);

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);
  const startPadding = useMemo(() => getStartPadding(currentMonth), [currentMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { startStr, endStr } = getMonthRange(currentMonth);
      const [consultationsRes, memosRes] = await Promise.all([
        getConsultations({
          startDate: startStr,
          endDate: endStr,
          limit: 100,
        }, SILENT_CONFIG),
        apiClient.get<{ consultations: StudentConsultationMemo[] }>(
          '/student-consultations/calendar',
          {
            ...SILENT_CONFIG,
            params: { startDate: startStr, endDate: endStr },
          },
        ),
      ]);

      setConsultations(consultationsRes.consultations);
      setStudentMemos(memosRes.consultations || []);
    } catch {
      setConsultations([]);
      setStudentMemos([]);
      setLoadError(getCalendarErrorMessage());
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!dateParam || consultations.length === 0) return;
    try {
      const targetDate = parseISO(dateParam);
      const dayConsultations = consultations.filter((consultation) => (
        isSameDay(parseISO(consultation.preferred_date), targetDate)
      ));
      if (dayConsultations.length > 0) {
        setSelectedDate(targetDate);
        setSelectedConsultations(dayConsultations);
        setDayListModalOpen(true);
      }
    } catch {
      return;
    }
  }, [consultations, dateParam]);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const response = await apiClient.get<{ students: CalendarStudent[] }>('/students', {
        ...SILENT_CONFIG,
        params: { status: 'active', limit: 500 },
      });
      setStudents(response.students || []);
    } catch {
      toast.error('학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const openLearningModal = useCallback((date: Date) => {
    setLearningModalDate(date);
    setLearningForm(createDefaultLearningForm());
    setLearningModalOpen(true);
    if (students.length === 0) {
      loadStudents();
    }
  }, [loadStudents, students.length]);

  const updateLearningForm = <K extends keyof LearningConsultationForm>(
    field: K,
    value: LearningConsultationForm[K],
  ) => {
    setLearningForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLearningSubmit = useCallback(async () => {
    if (!learningForm.studentId || !learningModalDate) {
      toast.error('학생을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(
        '/consultations/learning',
        {
          studentId: Number.parseInt(learningForm.studentId, 10),
          preferredDate: format(learningModalDate, 'yyyy-MM-dd'),
          preferredTime: learningForm.preferredTime,
          learningType: learningForm.learningType,
          adminNotes: learningForm.adminNotes || null,
        },
        SILENT_CONFIG,
      );

      toast.success('재원생 상담이 등록되었습니다.');
      setLearningModalOpen(false);
      loadData();
    } catch {
      toast.error('재원생 상담 등록에 실패했습니다. 입력값을 확인한 뒤 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [learningForm, learningModalDate, loadData]);

  const handleDateClick = useCallback((date: Date) => {
    const dayConsultations = getConsultationsForDate(consultations, date);
    if (dayConsultations.length > 0) {
      setSelectedDate(date);
      setSelectedConsultations(dayConsultations);
      setDayListModalOpen(true);
    }
  }, [consultations]);

  const openDetailModal = useCallback((consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setDayListModalOpen(false);
    setDetailModalOpen(true);
  }, []);

  const handleBack = useCallback(() => {
    router.push(fromSchedule ? '/schedules' : '/consultations');
  }, [fromSchedule, router]);

  return {
    fromSchedule,
    currentMonth,
    consultations,
    studentMemos,
    loading,
    loadError,
    selectedDate,
    selectedConsultations,
    dayListModalOpen,
    selectedConsultation,
    detailModalOpen,
    learningModalOpen,
    learningModalDate,
    students,
    studentsLoading,
    learningForm,
    submitting,
    calendarDays,
    startPadding,
    setDayListModalOpen,
    setDetailModalOpen,
    setLearningModalOpen,
    setCurrentMonth,
    updateLearningForm,
    handleBack,
    handleDateClick,
    openDetailModal,
    openLearningModal,
    handleLearningSubmit,
    getConsultationsForDate: (date: Date) => getConsultationsForDate(consultations, date),
    getMemosForDate: (date: Date) => getMemosForDate(studentMemos, date),
    previousMonth: () => setCurrentMonth((prev) => subMonths(prev, 1)),
    nextMonth: () => setCurrentMonth((prev) => addMonths(prev, 1)),
    reopenDayList: () => {
      setDetailModalOpen(false);
      setDayListModalOpen(true);
    },
    setLearningType: (value: LearningType) => updateLearningForm('learningType', value),
  };
}
