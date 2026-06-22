'use client';

import { useState, useEffect, useMemo } from 'react';
import apiClient from '@/lib/api/client';
import { seasonsApi } from '@/lib/api/seasons';
import type { Student, StudentFormData, StudentType, Grade, AdmissionType, StudentStatus, TrialDate } from '@/lib/types/student';
import type { Season } from '@/lib/types/season';
import { EXAM_ADMISSION_OPTIONS, ADULT_ADMISSION_OPTIONS } from '@/lib/types/student';
import type { ClassDaySlot } from '@/lib/types/student';
import { parseClassDaysWithSlots, extractDayNumbers } from '@/lib/utils/student-helpers';
import { AcademySettings, TuitionByWeeklyCount, DEFAULT_TUITION } from '../_types';

interface StudentFormProps {
  mode: 'create' | 'edit';
  initialData?: Student;
  initialIsTrial?: boolean;
  onSubmit: (data: StudentFormData) => Promise<void>;
}

export function useStudentForm({ mode, initialData, initialIsTrial = false, onSubmit }: StudentFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restModalOpen, setRestModalOpen] = useState(false);

  // 학원 설정
  const [academySettings, setAcademySettings] = useState<AcademySettings>({
    exam_tuition: { ...DEFAULT_TUITION },
    adult_tuition: { ...DEFAULT_TUITION },
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 시즌
  const [availableSeasons, setAvailableSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [enrollInSeason, setEnrollInSeason] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  // 체험생
  const [isTrial, setIsTrial] = useState(initialData?.is_trial || initialIsTrial);
  const [trialDates, setTrialDates] = useState<TrialDate[]>(() => {
    if (initialData?.trial_dates) {
      const dates = typeof initialData.trial_dates === 'string'
        ? JSON.parse(initialData.trial_dates)
        : initialData.trial_dates;
      return Array.isArray(dates) ? dates : [];
    }
    return [];
  });

  // 폼 데이터
  const [formData, setFormData] = useState<StudentFormData>({
    student_number: initialData?.student_number || '',
    name: initialData?.name || '',
    gender: initialData?.gender || undefined,
    student_type: (initialData?.student_type || 'exam') as StudentType,
    phone: initialData?.phone || '',
    parent_phone: initialData?.parent_phone || '',
    school: initialData?.school || '',
    grade: initialData?.grade as Grade | undefined,
    age: initialData?.age || undefined,
    admission_type: (initialData?.admission_type || 'regular') as AdmissionType,
    class_days: initialData ? parseClassDaysWithSlots(initialData.class_days, initialData.time_slot || 'evening') : [],
    weekly_count: initialData?.weekly_count || 0,
    monthly_tuition: initialData ? parseFloat(initialData.monthly_tuition) : 0,
    discount_rate: initialData ? parseFloat(initialData.discount_rate) : 0,
    discount_reason: initialData?.discount_reason || '',
    payment_due_day: initialData?.payment_due_day || undefined,
    enrollment_date: initialData?.enrollment_date || new Date().toISOString().split('T')[0],
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    memo: initialData?.memo || '',
    status: (initialData?.status || 'active') as StudentStatus,
    rest_start_date: initialData?.rest_start_date || '',
    rest_end_date: initialData?.rest_end_date || '',
    rest_reason: initialData?.rest_reason || '',
    time_slot: (initialData?.time_slot || 'evening') as 'morning' | 'afternoon' | 'evening',
  });

  const [isIndefiniteRest, setIsIndefiniteRest] = useState(!initialData?.rest_end_date && initialData?.status === 'paused');

  // 적용 시작월
  const [effectiveFrom, setEffectiveFrom] = useState('immediate');
  const effectiveMonthOptions = useMemo(() => {
    const now = new Date();
    const options: { value: string; label: string }[] = [
      { value: 'immediate', label: '즉시 적용 (이번 달)' },
    ];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      options.push({
        value: `${year}-${String(month).padStart(2, '0')}-01`,
        label: `${year}년 ${month}월부터`,
      });
    }
    return options;
  }, []);

  // 수업요일 변경 감지
  const classDaysChanged = useMemo(() => {
    if (mode !== 'edit' || !initialData) return false;
    const oldDays = parseClassDaysWithSlots(initialData.class_days, initialData.time_slot || 'evening');
    const newDays = formData.class_days;
    if (oldDays.length !== newDays.length) return true;
    return newDays.some(nd => {
      const od = oldDays.find(o => o.day === nd.day);
      return !od || od.timeSlot !== nd.timeSlot;
    });
  }, [mode, initialData, formData.class_days]);

  // 시즌 대상 학년
  const isSeasonTarget = formData.student_type === 'exam' && (formData.grade === '고3' || formData.grade === 'N수');

  // Effects
  useEffect(() => { loadAcademySettings(); }, []);
  useEffect(() => {
    if (mode === 'create' && initialIsTrial && trialDates.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      setTrialDates([{ date: today, time_slot: 'afternoon' }]);
    }
  }, [initialIsTrial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isSeasonTarget && mode === 'create') {
      loadAvailableSeasons();
    }
  }, [isSeasonTarget, mode]);

  // 로더
  const loadAvailableSeasons = async () => {
    try {
      setSeasonsLoading(true);
      const seasons = await seasonsApi.getActiveSeasons();
      setAvailableSeasons(seasons);
    } catch (err) {
      console.error('Failed to load seasons:', err);
    } finally {
      setSeasonsLoading(false);
    }
  };

  const loadAcademySettings = async () => {
    try {
      const response = await apiClient.get<{ settings: AcademySettings }>('/settings/academy', { suppressErrorToast: true });
      if (response.settings) {
        setAcademySettings({
          exam_tuition: response.settings.exam_tuition || { ...DEFAULT_TUITION },
          adult_tuition: response.settings.adult_tuition || { ...DEFAULT_TUITION },
          tuition_due_day: response.settings.tuition_due_day,
          morning_class_time: response.settings.morning_class_time,
          afternoon_class_time: response.settings.afternoon_class_time,
          evening_class_time: response.settings.evening_class_time,
        });
      }
    } catch {
      // 설정이 없으면 기본값 사용
    } finally {
      setSettingsLoaded(true);
    }
  };

  // 헬퍼
  const getTuitionByWeeklyCount = (studentType: StudentType, weeklyCount: number): number => {
    if (weeklyCount < 1 || weeklyCount > 7) return 0;
    const tuitionTable = studentType === 'exam'
      ? academySettings.exam_tuition
      : academySettings.adult_tuition;
    const key = `weekly_${weeklyCount}` as keyof TuitionByWeeklyCount;
    return tuitionTable[key] || 0;
  };

  const finalTuition = useMemo(() => {
    const base = formData.monthly_tuition || 0;
    const discountRate = formData.discount_rate || 0;
    const discountAmount = Math.round(base * (discountRate / 100));
    return base - discountAmount;
  }, [formData.monthly_tuition, formData.discount_rate]);

  const formatTimeLabel = (timeRange: string | undefined, defaultRange: string): string => {
    const range = timeRange || defaultRange;
    const [start, end] = range.split('-');
    return `${start || '00:00'}~${end || '00:00'}`;
  };

  const timeSlotLabels: Record<string, string> = {
    morning: `오전 (${formatTimeLabel(academySettings.morning_class_time, '09:00-12:00')})`,
    afternoon: `오후 (${formatTimeLabel(academySettings.afternoon_class_time, '13:00-18:00')})`,
    evening: `저녁 (${formatTimeLabel(academySettings.evening_class_time, '18:00-21:00')})`,
  };

  const admissionOptions = formData.student_type === 'exam' ? EXAM_ADMISSION_OPTIONS : ADULT_ADMISSION_OPTIONS;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원';

  // 핸들러
  const handleChange = (field: keyof StudentFormData, value: unknown) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === 'student_type') {
        if (value === 'adult') {
          newData.grade = undefined;
          newData.admission_type = 'civil_service';
        } else {
          newData.age = undefined;
          newData.admission_type = 'regular';
        }
        if (settingsLoaded && newData.weekly_count > 0) {
          newData.monthly_tuition = getTuitionByWeeklyCount(value as StudentType, newData.weekly_count);
        }
      }
      return newData;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleClassDayToggle = (day: number) => {
    const current = formData.class_days;
    const currentDayNums = extractDayNumbers(current);
    const defaultTimeSlot = formData.time_slot || 'evening';
    let newDays: ClassDaySlot[];
    if (currentDayNums.includes(day)) {
      newDays = current.filter((d) => d.day !== day);
    } else {
      newDays = [...current, { day, timeSlot: defaultTimeSlot }].sort((a, b) => a.day - b.day);
    }
    const newWeeklyCount = newDays.length;
    const newTuition = settingsLoaded
      ? getTuitionByWeeklyCount(formData.student_type, newWeeklyCount)
      : formData.monthly_tuition;
    setFormData((prev) => ({
      ...prev,
      class_days: newDays,
      weekly_count: newWeeklyCount,
      monthly_tuition: newTuition,
    }));
  };

  const handleDayTimeSlotChange = (day: number, timeSlot: 'morning' | 'afternoon' | 'evening') => {
    setFormData((prev) => ({
      ...prev,
      class_days: prev.class_days.map((d) =>
        d.day === day ? { ...d, timeSlot } : d
      ),
    }));
  };

  const formatPhoneNumber = (value: string): string => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const isValidPhoneNumber = (phone: string): boolean => /^\d{3}-\d{3,4}-\d{4}$/.test(phone);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = '이름을 입력해주세요.';
    if (!formData.phone?.trim()) {
      newErrors.phone = '전화번호를 입력해주세요.';
    } else if (!isValidPhoneNumber(formData.phone)) {
      newErrors.phone = '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)';
    }
    if (formData.parent_phone?.trim() && !isValidPhoneNumber(formData.parent_phone)) {
      newErrors.parent_phone = '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)';
    }
    if (formData.student_type === 'exam') {
      if (!formData.grade) newErrors.grade = '학년을 선택해주세요.';
    } else {
      if (!formData.age || formData.age < 1) newErrors.age = '나이를 입력해주세요.';
    }
    if ((formData.discount_rate || 0) > 0 && !formData.discount_reason?.trim()) {
      newErrors.discount_reason = '할인 사유를 입력해주세요.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementById(`field-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }
    return Object.keys(newErrors).length === 0;
  };

  const extractErrorMessage = (): string => {
    return '학생 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';
  };

  const isSameNameWarning = (err: unknown): { isWarning: boolean; existingStudent?: { name: string; phone: string; gender?: string } } => {
    if (err && typeof err === 'object') {
      const axiosError = err as { response?: { data?: { code?: string; existingStudent?: { name: string; phone: string; gender?: string } } } };
      if (axiosError.response?.data?.code === 'SAME_NAME_EXISTS') {
        return { isWarning: true, existingStudent: axiosError.response.data.existingStudent };
      }
    }
    return { isWarning: false };
  };

  const addTrialDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setTrialDates([...trialDates, { date: today, time_slot: 'afternoon' }]);
  };

  const removeTrialDate = (index: number) => {
    setTrialDates(trialDates.filter((_, i) => i !== index));
  };

  const updateTrialDate = (index: number, field: keyof TrialDate, value: string) => {
    const updated = [...trialDates];
    updated[index] = { ...updated[index], [field]: value };
    setTrialDates(updated);
  };

  const handleSubmit = async (e: React.FormEvent, forceSubmit = false) => {
    e.preventDefault();
    if (!validate()) return;
    if (mode === 'edit' && classDaysChanged && effectiveFrom === 'immediate') {
      if (!confirm('수업요일을 즉시 변경하시겠습니까?\n\n변경 즉시 출석부에 반영됩니다.\n예약 적용을 원하시면 적용 시작월을 변경해주세요.')) return;
    }
    const trialRemaining = trialDates.filter(td => !td.attended).length || trialDates.length || 2;
    const submitData = {
      ...formData,
      enroll_in_season: enrollInSeason && !!selectedSeasonId,
      selected_season_id: enrollInSeason ? selectedSeasonId ?? undefined : undefined,
      confirm_force: forceSubmit,
      is_trial: isTrial,
      trial_remaining: isTrial ? trialRemaining : undefined,
      trial_dates: isTrial ? trialDates : undefined,
      time_slot: formData.time_slot,
      effective_from: classDaysChanged && effectiveFrom !== 'immediate' ? effectiveFrom : undefined,
    };
    try {
      setSubmitting(true);
      await onSubmit(submitData);
    } catch (err: unknown) {
      console.warn('학생 정보 저장에 실패했습니다.');
      const sameNameCheck = isSameNameWarning(err);
      if (sameNameCheck.isWarning && sameNameCheck.existingStudent) {
        const existing = sameNameCheck.existingStudent;
        const genderText = existing.gender === 'male' ? '남' : existing.gender === 'female' ? '여' : '';
        const confirmMessage = `같은 이름의 학생이 이미 존재합니다.\n\n` +
          `기존 학생: ${existing.name} ${genderText ? `(${genderText})` : ''}\n` +
          `전화번호: ${existing.phone || '없음'}\n\n` +
          `그래도 등록하시겠습니까?`;
        if (confirm(confirmMessage)) {
          handleSubmit(e, true);
        }
        return;
      }
      const errorMessage = extractErrorMessage();
      setErrors({ submit: errorMessage });
      setTimeout(() => {
        const errorElement = document.querySelector('[class*="bg-red-50"]');
        if (errorElement) errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    // state
    submitting, errors, setErrors,
    restModalOpen, setRestModalOpen,
    academySettings,
    availableSeasons, seasonsLoading,
    enrollInSeason, setEnrollInSeason,
    selectedSeasonId, setSelectedSeasonId,
    isTrial, setIsTrial,
    trialDates, setTrialDates,
    formData, setFormData,
    isIndefiniteRest, setIsIndefiniteRest,
    effectiveFrom, setEffectiveFrom,
    // derived
    effectiveMonthOptions,
    classDaysChanged,
    isSeasonTarget,
    finalTuition,
    timeSlotLabels,
    admissionOptions,
    // handlers
    handleChange,
    handleClassDayToggle,
    handleDayTimeSlotChange,
    formatPhoneNumber,
    handleSubmit,
    addTrialDate,
    removeTrialDate,
    updateTrialDate,
    formatCurrency,
  };
}
