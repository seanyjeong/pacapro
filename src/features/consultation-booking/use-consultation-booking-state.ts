import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import type { ConsultationFormData, ConsultationPageInfo, MockTestGrades, TimeSlot } from '@/lib/types/consultation';
import { fetchBookingPageInfo, fetchBookingSlots, submitBooking } from './booking-api';
import { BOOKING_PAGE_ERROR, BOOKING_SLOTS_ERROR, BOOKING_SUBMIT_ERROR, createInitialBookingForm } from './booking-constants';

export function useConsultationBookingState(slug: string, onSubmitted: () => void) {
  const [pageInfo, setPageInfo] = useState<ConsultationPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ConsultationFormData>(() => createInitialBookingForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reloadPageInfo = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPageInfo(await fetchBookingPageInfo(slug));
    } catch {
      setPageInfo(null);
      setLoadError(BOOKING_PAGE_ERROR);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reloadPageInfo();
  }, [reloadPageInfo]);

  useEffect(() => {
    if (!pageInfo?.academy?.name) return undefined;
    document.title = `${pageInfo.academy.name} - 상담 예약`;
    return () => {
      document.title = 'P-ACA - 체육입시 학원관리시스템';
    };
  }, [pageInfo?.academy?.name]);

  const loadSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedTime('');
    try {
      const response = await fetchBookingSlots(slug, format(date, 'yyyy-MM-dd'));
      setSlots(response.slots || []);
    } catch {
      setSlots([]);
      setSlotsError(BOOKING_SLOTS_ERROR);
    } finally {
      setSlotsLoading(false);
    }
  }, [slug]);

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    loadSlots(date);
  };

  const updateForm = (patch: Partial<ConsultationFormData>) => {
    setFormData((previous) => ({ ...previous, ...patch }));
    setFormError(null);
  };

  const updateMockGrade = (subject: keyof MockTestGrades, value: number | undefined) => {
    setFormData((previous) => ({
      ...previous,
      mockTestGrades: {
        ...previous.mockTestGrades,
        [subject]: value,
      },
    }));
    setFormError(null);
  };

  const goToSchedule = () => {
    const error = validateInfoStep(formData);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setStep(2);
  };

  const goToConfirm = () => {
    if (!selectedDate || !selectedTime) {
      setSlotsError('상담 일정을 선택해주세요.');
      return;
    }
    setSubmitError(null);
    setStep(3);
  };

  const submit = async () => {
    if (!selectedDate || !selectedTime) {
      setSubmitError('상담 일정을 선택해주세요.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitBooking(slug, {
        ...formData,
        preferredDate: format(selectedDate, 'yyyy-MM-dd'),
        preferredTime: selectedTime,
      });
      onSubmitted();
    } catch {
      setSubmitError(BOOKING_SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    currentMonth,
    formData,
    formError,
    goToConfirm,
    goToSchedule,
    loadError,
    loading,
    pageInfo,
    reloadPageInfo,
    selectDate,
    selectedDate,
    selectedTime,
    setCurrentMonth,
    setSelectedTime,
    setStep,
    slots,
    slotsError,
    slotsLoading,
    step,
    submit,
    submitError,
    submitting,
    updateForm,
    updateMockGrade,
  };
}

function validateInfoStep(formData: ConsultationFormData): string | null {
  if (!formData.studentName.trim()) return '학생 이름을 입력해주세요.';
  if (!formData.studentPhone?.trim()) return '연락처를 입력해주세요.';
  if (formData.studentPhone.replace(/\D/g, '').length !== 11) return '전화번호 11자리를 정확히 입력해주세요.';
  if (!formData.studentGrade) return '학년을 선택해주세요.';
  if (!formData.studentSchool?.trim()) return '학교를 입력해주세요.';
  if (!formData.gender) return '성별을 선택해주세요.';
  if (formData.schoolGradeAvg === undefined) return '내신 평균등급을 선택해주세요.';
  if (!formData.admissionType) return '입시 유형을 선택해주세요.';
  if (formData.mockTestGrades?.korean === undefined) return '모의고사 국어 등급을 선택해주세요.';
  if (formData.mockTestGrades?.math === undefined) return '모의고사 수학 등급을 선택해주세요.';
  if (formData.mockTestGrades?.english === undefined) return '모의고사 영어 등급을 선택해주세요.';
  if (formData.mockTestGrades?.exploration === undefined) return '모의고사 탐구 등급을 선택해주세요.';
  return null;
}
