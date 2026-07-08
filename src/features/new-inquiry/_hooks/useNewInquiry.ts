'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

import {
  getConsultations, updateConsultation, deleteConsultation,
  createDirectConsultation, convertToTrialStudent, getBookedTimes,
  getConsultationSettings
} from '@/lib/api/consultations';
import { getConsultationErrorText, SILENT_CONFIG as QUIET_API } from '@/features/consultations/_hooks/consultation-error-utils';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import type { WeeklyHour } from '@/lib/types/consultation';

import type { TagFilter, CreateForm, EditStudentForm, CompletedStats, GroupedMonth } from '../_types';
import { INITIAL_CREATE_FORM } from '../_types';

export function useNewInquiry() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [completedTab, setCompletedTab] = useState<'all' | 'registered' | 'trial_ongoing' | 'unregistered'>('all');
  const [selectedTags, setSelectedTags] = useState<TagFilter[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ConsultationStatus>('pending');
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [editBookedTimes, setEditBookedTimes] = useState<string[]>([]);
  const [loadingEditBookedTimes, setLoadingEditBookedTimes] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(INITIAL_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingBookedTimes, setLoadingBookedTimes] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);

  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialConsultation, setTrialConsultation] = useState<Consultation | null>(null);
  const [trialDates, setTrialDates] = useState<{ date: string; timeSlot: string }[]>([
    { date: '', timeSlot: '' }
  ]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

  const [editStudentModalOpen, setEditStudentModalOpen] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState<EditStudentForm>({
    studentGrade: '',
    parentPhone: '',
    studentSchool: '',
  });
  const [updatingStudent, setUpdatingStudent] = useState(false);

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const getDateRange = useCallback(() => {
    const today = new Date();
    if (dateFilter === 'today') {
      const dateStr = format(today, 'yyyy-MM-dd');
      return { startDate: dateStr, endDate: dateStr };
    } else if (dateFilter === 'week') {
      const start = format(today, 'yyyy-MM-dd');
      const end = format(addDays(today, 7), 'yyyy-MM-dd');
      return { startDate: start, endDate: end };
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateFilter]);

  const generateTimeSlots = useCallback((date: string): string[] => {
    if (!date || weeklyHours.length === 0) return [];
    const dayOfWeek = new Date(date).getDay();
    const hourConfig = weeklyHours.find(h => h.dayOfWeek === dayOfWeek);
    if (!hourConfig || !hourConfig.isAvailable) return [];

    const startHour = parseInt(hourConfig.startTime?.substring(0, 2) || '09');
    const startMin = parseInt(hourConfig.startTime?.substring(3, 5) || '00');
    const endHour = parseInt(hourConfig.endTime?.substring(0, 2) || '18');
    const endMin = parseInt(hourConfig.endTime?.substring(3, 5) || '00');

    const slots: string[] = [];
    let current = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    while (current < end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      current += 30;
    }
    return slots;
  }, [weeklyHours]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { startDate, endDate } = getDateRange();
      const response = await getConsultations({
        search: search || undefined,
        status: statusFilter || undefined,
        consultationType: 'new_registration',
        startDate,
        endDate,
        page: pagination.page,
        limit: pagination.limit
      }, QUIET_API);
      setConsultations(response.consultations);
      setStats(response.stats);
      setPagination(response.pagination);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      setLoadError('상담 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, getDateRange, pagination.page, pagination.limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getConsultationSettings(QUIET_API);
        if (response.weeklyHours) {
          setWeeklyHours(response.weeklyHours);
        }
      } catch (error) {
        console.error('운영시간 설정 로드 오류:', error);
        toast.error('상담 운영시간 설정을 불러오지 못했습니다. 상담 설정을 확인해주세요.');
      }
    };
    loadSettings();
  }, []);

  const loadBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingBookedTimes(true);
    try {
      const response = await getBookedTimes(date, QUIET_API);
      setBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 로드 오류:', error);
      toast.error('예약 시간을 불러오지 못했습니다. 날짜를 다시 선택해주세요.');
    } finally {
      setLoadingBookedTimes(false);
    }
  };

  const loadEditBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingEditBookedTimes(true);
    try {
      const response = await getBookedTimes(date, QUIET_API);
      setEditBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 로드 오류:', error);
      toast.error('예약 시간을 불러오지 못했습니다. 날짜를 다시 선택해주세요.');
    } finally {
      setLoadingEditBookedTimes(false);
    }
  };

  const handleCreateConsultation = async () => {
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
      await createDirectConsultation(createForm, QUIET_API);
      toast.success('상담이 등록되었습니다.');
      setCreateModalOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      loadData();
    } catch (error) {
      console.error('상담 등록 오류:', error);
      toast.error('신규상담 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedConsultation) return;
    setUpdating(true);
    try {
      await updateConsultation(selectedConsultation.id, {
        status: newStatus,
        adminNotes: adminNotes || undefined,
        preferredDate: newDate || undefined,
        preferredTime: newTime || undefined
      }, QUIET_API);
      toast.success('상담 상태가 변경되었습니다.');
      setStatusModalOpen(false);
      setDetailOpen(false);
      loadData();
    } catch (error) {
      console.error('상태 변경 오류:', error);
      toast.error('상담 상태 변경에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConsultation) return;
    setDeleting(true);
    try {
      await deleteConsultation(selectedConsultation.id, QUIET_API);
      toast.success('상담이 삭제되었습니다.');
      setDeleteModalOpen(false);
      setDetailOpen(false);
      loadData();
    } catch (error) {
      console.error('삭제 오류:', error);
      toast.error('상담 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeleting(false);
    }
  };

  const addTrialDate = () => {
    setTrialDates([...trialDates, { date: '', timeSlot: '' }]);
  };

  const removeTrialDate = (index: number) => {
    if (trialDates.length > 1) {
      setTrialDates(trialDates.filter((_, i) => i !== index));
    }
  };

  const handleConvertToTrial = async () => {
    if (!trialConsultation) return;
    if (!trialDates.some(td => td.date && td.timeSlot)) {
      toast.error('최소 하나의 체험 일정을 입력해주세요.');
      return;
    }
    setConvertingToTrial(true);
    try {
      await convertToTrialStudent(trialConsultation.id, trialDates.filter(td => td.date && td.timeSlot), undefined, QUIET_API);
      toast.success('체험생으로 등록되었습니다.');
      setTrialModalOpen(false);
      setDetailOpen(false);
      setTrialDates([{ date: '', timeSlot: '' }]);
      loadData();
    } catch (error) {
      console.error('체험 등록 오류:', error);
      toast.error(getConsultationErrorText(error, '체험생 등록에 실패했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setConvertingToTrial(false);
    }
  };

  const openEditStudentModal = (c: Consultation) => {
    setSelectedConsultation(c);
    setEditStudentForm({
      studentGrade: c.student_grade || '',
      parentPhone: c.parent_phone || c.student_phone || '',
      studentSchool: c.student_school || '',
    });
    setEditStudentModalOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!selectedConsultation) return;
    setUpdatingStudent(true);
    try {
      await updateConsultation(selectedConsultation.id, {
        studentGrade: editStudentForm.studentGrade || undefined,
        parentPhone: editStudentForm.parentPhone || undefined,
        studentSchool: editStudentForm.studentSchool || undefined
      }, QUIET_API);
      toast.success('학생 정보가 수정되었습니다.');
      setEditStudentModalOpen(false);
      loadData();
    } catch (error) {
      console.error('학생 정보 수정 오류:', error);
      toast.error('학생 정보 수정에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setUpdatingStudent(false);
    }
  };

  const toggleTag = (tag: TagFilter) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const matchesTagFilter = useCallback((c: Consultation): boolean => {
    if (selectedTags.length === 0) return true;
    return selectedTags.some(tag => {
      switch (tag) {
        case 'registered':
          return c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'registered_direct';
        case 'trial_completed':
          return c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'trial_completed';
        case 'trial_ongoing':
          return c.matched_student_status === 'trial_ongoing';
        case 'unregistered':
          return c.matched_student_status === 'trial_completed' || c.matched_student_status === 'no_trial' || !c.matched_student_status;
        case 'no_trial':
          return c.matched_student_status === 'no_trial';
        default:
          return true;
      }
    });
  }, [selectedTags]);

  const currentMonthKey = format(new Date(), 'yyyy-MM');

  const isMonthExpanded = (monthKey: string): boolean => {
    if (expandedMonths[monthKey] !== undefined) return expandedMonths[monthKey];
    return monthKey === currentMonthKey;
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !isMonthExpanded(monthKey)
    }));
  };

  const completedStats = useMemo((): CompletedStats => {
    const completedList = consultations.filter(c => c.status === 'completed');
    const registered = completedList.filter(c =>
      c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'registered_direct'
    );
    const trialOngoing = completedList.filter(c => c.matched_student_status === 'trial_ongoing');
    const unregistered = completedList.filter(c =>
      c.matched_student_status === 'trial_completed' || c.matched_student_status === 'no_trial' || !c.matched_student_status
    );
    return {
      total: completedList.length,
      registered: registered.length,
      trialOngoing: trialOngoing.length,
      unregistered: unregistered.length,
    };
  }, [consultations]);

  const filteredConsultations = useMemo((): Consultation[] => {
    let result = consultations;
    if (statusFilter === 'completed' && completedTab !== 'all') {
      if (completedTab === 'registered') {
        result = result.filter(c => c.status === 'completed' &&
          (c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'registered_direct'));
      } else if (completedTab === 'trial_ongoing') {
        result = result.filter(c => c.status === 'completed' && c.matched_student_status === 'trial_ongoing');
      } else if (completedTab === 'unregistered') {
        result = result.filter(c => c.status === 'completed' &&
          (c.matched_student_status === 'trial_completed' || c.matched_student_status === 'no_trial' || !c.matched_student_status));
      }
    }
    if (selectedTags.length > 0) {
      result = result.filter(c => c.status === 'completed' && matchesTagFilter(c));
    }
    return result;
  }, [consultations, statusFilter, completedTab, selectedTags, matchesTagFilter]);

  const groupedByMonth = useMemo((): GroupedMonth[] => {
    const groups: { [key: string]: { label: string; consultations: Consultation[] } } = {};
    filteredConsultations.forEach(c => {
      const date = parseISO(c.preferred_date);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'yyyy년 M월', { locale: ko });
      if (!groups[key]) groups[key] = { label, consultations: [] };
      groups[key].consultations.push(c);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredConsultations]);

  return {
    consultations,
    loading,
    loadError,
    stats,
    pagination,
    setPagination,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    completedTab,
    setCompletedTab,
    selectedTags,
    toggleTag,
    setSelectedTags,
    isMonthExpanded,
    toggleMonth,
    currentMonthKey,
    selectedConsultation,
    setSelectedConsultation,
    detailOpen,
    setDetailOpen,
    statusModalOpen,
    setStatusModalOpen,
    newStatus,
    setNewStatus,
    adminNotes,
    setAdminNotes,
    updating,
    newDate,
    setNewDate,
    newTime,
    setNewTime,
    editBookedTimes,
    loadingEditBookedTimes,
    deleteModalOpen,
    setDeleteModalOpen,
    deleting,
    createModalOpen,
    setCreateModalOpen,
    createForm,
    setCreateForm,
    creating,
    bookedTimes,
    loadingBookedTimes,
    weeklyHours,
    trialModalOpen,
    setTrialModalOpen,
    trialConsultation,
    setTrialConsultation,
    trialDates,
    setTrialDates,
    convertingToTrial,
    editStudentModalOpen,
    setEditStudentModalOpen,
    editStudentForm,
    setEditStudentForm,
    updatingStudent,
    loadData,
    loadBookedTimes,
    loadEditBookedTimes,
    generateTimeSlots,
    handleCreateConsultation,
    handleStatusChange,
    handleDelete,
    addTrialDate,
    removeTrialDate,
    handleConvertToTrial,
    openEditStudentModal,
    handleUpdateStudent,
    completedStats,
    filteredConsultations,
    groupedByMonth,
  };
}
