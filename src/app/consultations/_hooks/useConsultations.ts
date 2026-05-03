'use client';

import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

import {
  getConsultations, updateConsultation, deleteConsultation,
  createDirectConsultation, convertToTrialStudent, getBookedTimes,
  getConsultationSettings
} from '@/lib/api/consultations';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import type { LearningType, WeeklyHour } from '@/lib/types/consultation';
import apiClient from '@/lib/api/client';
import type { EditForm, DirectForm, LearningForm, TrialDate } from '../_types';

const DEFAULT_DIRECT_FORM: DirectForm = {
  studentName: '',
  phone: '',
  grade: '',
  gender: '',
  studentSchool: '',
  schoolGradeAvg: undefined,
  admissionType: '',
  mockTestGrades: { korean: undefined, math: undefined, english: undefined, exploration: undefined },
  targetSchool: '',
  referrerStudent: '',
  preferredDate: '',
  preferredTime: '',
  notes: ''
};

const DEFAULT_LEARNING_FORM: LearningForm = {
  studentId: '',
  preferredDate: '',
  preferredTime: '10:00',
  learningType: 'regular' as LearningType,
  adminNotes: ''
};

export function useConsultations() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // 필터
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

  // 상세 모달
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 상태 변경 모달
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ConsultationStatus>('pending');
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [editBookedTimes, setEditBookedTimes] = useState<string[]>([]);
  const [loadingEditBookedTimes, setLoadingEditBookedTimes] = useState(false);

  // 삭제 확인 모달
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 정보 수정 모달
  const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
  const [editInfoConsultation, setEditInfoConsultation] = useState<Consultation | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    studentName: '',
    studentGrade: '',
    studentSchool: '',
    parentPhone: '',
    gender: '',
    schoolGradeAvg: undefined,
    admissionType: '',
    mockTestGrades: { korean: undefined, math: undefined, english: undefined, exploration: undefined },
    targetSchool: '',
    referrerStudent: ''
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // 직접 등록 모달
  const [directRegisterOpen, setDirectRegisterOpen] = useState(false);
  const [directForm, setDirectForm] = useState<DirectForm>(DEFAULT_DIRECT_FORM);
  const [registering, setRegistering] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingBookedTimes, setLoadingBookedTimes] = useState(false);

  // 유형 선택 모달
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);

  // 재원생 상담 등록 모달
  const [learningModalOpen, setLearningModalOpen] = useState(false);
  const [students, setStudents] = useState<Array<{ id: number; name: string; grade: string }>>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [learningForm, setLearningForm] = useState<LearningForm>(DEFAULT_LEARNING_FORM);
  const [submittingLearning, setSubmittingLearning] = useState(false);

  // 운영 시간 설정
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);

  // 체험 등록 모달
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialDates, setTrialDates] = useState<TrialDate[]>([{ date: '', timeSlot: '' }]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

  // 날짜 필터 계산
  const getDateRange = useCallback(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    if (dateFilter === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    } else if (dateFilter === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return { startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd') };
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateFilter]);

  // 운영 시간 기반 시간 옵션 생성
  const getTimeOptionsForDate = useCallback((dateStr: string): string[] => {
    if (!dateStr || weeklyHours.length === 0) return [];
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const hourConfig = weeklyHours.find(h => h.dayOfWeek === dayOfWeek);
    if (!hourConfig || !hourConfig.isAvailable) return [];
    const startHour = parseInt(hourConfig.startTime?.substring(0, 2) || '09');
    const startMin = parseInt(hourConfig.startTime?.substring(3, 5) || '00');
    const endHour = parseInt(hourConfig.endTime?.substring(0, 2) || '18');
    const endMin = parseInt(hourConfig.endTime?.substring(3, 5) || '00');
    const times: string[] = [];
    let currentMin = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    while (currentMin < endMinutes) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      currentMin += 30;
    }
    return times;
  }, [weeklyHours]);

  const timeOptions = getTimeOptionsForDate(directForm.preferredDate);
  const editTimeOptions = getTimeOptionsForDate(newDate);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const response = await getConsultations({
        search: search || undefined,
        status: statusFilter || undefined,
        consultationType: typeFilter || undefined,
        startDate,
        endDate,
        page: pagination.page,
        limit: pagination.limit
      });
      setConsultations(response.consultations);
      setStats(response.stats);
      setPagination(response.pagination);
    } catch {
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, getDateRange, pagination.page, pagination.limit]);

  useEffect(() => {
    loadData();
  }, [search, statusFilter, typeFilter, dateFilter, pagination.page]);

  // 운영 시간 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getConsultationSettings();
        if (response.weeklyHours) setWeeklyHours(response.weeklyHours);
      } catch {
        // 설정 로드 실패 시 무시 (시간 옵션만 비어있음)
      }
    };
    loadSettings();
  }, []);

  // editInfoConsultation 변경 시 editForm 업데이트 후 모달 열기
  useEffect(() => {
    if (editInfoConsultation) {
      const scores = editInfoConsultation.academicScores || {};
      flushSync(() => {
        setEditForm({
          studentName: editInfoConsultation.student_name || '',
          studentGrade: editInfoConsultation.student_grade || '',
          studentSchool: editInfoConsultation.student_school || '',
          parentPhone: editInfoConsultation.parent_phone || '',
          gender: (editInfoConsultation.gender as '' | 'male' | 'female') || '',
          schoolGradeAvg: scores.schoolGradeAvg ?? undefined,
          admissionType: (scores.admissionType as '' | 'early' | 'regular' | 'both') || '',
          mockTestGrades: {
            korean: scores.mockTestGrades?.korean ?? undefined,
            math: scores.mockTestGrades?.math ?? undefined,
            english: scores.mockTestGrades?.english ?? undefined,
            exploration: scores.mockTestGrades?.exploration ?? undefined
          },
          targetSchool: editInfoConsultation.target_school || '',
          referrerStudent: editInfoConsultation.referrer_student || ''
        });
      });
      setEditInfoModalOpen(true);
    }
  }, [editInfoConsultation]);

  // 일정 변경용 날짜 선택
  const handleEditDateChange = async (date: string) => {
    setNewDate(date);
    setNewTime('');
    if (!date) { setEditBookedTimes([]); return; }
    setLoadingEditBookedTimes(true);
    try {
      const response = await getBookedTimes(date);
      const currentTime = selectedConsultation?.preferred_time?.substring(0, 5);
      const currentDate = selectedConsultation?.preferred_date;
      const booked = response.bookedTimes || [];
      if (date === currentDate && currentTime) {
        setEditBookedTimes(booked.filter((t: string) => t !== currentTime));
      } else {
        setEditBookedTimes(booked);
      }
    } catch {
      setEditBookedTimes([]);
    } finally {
      setLoadingEditBookedTimes(false);
    }
  };

  // 상태/일정 변경
  const handleStatusChange = async () => {
    if (!selectedConsultation) return;
    setUpdating(true);
    try {
      const updateData: {
        status: ConsultationStatus; adminNotes: string;
        preferredDate?: string; preferredTime?: string;
      } = { status: newStatus, adminNotes };
      if (newDate) updateData.preferredDate = newDate;
      if (newTime) updateData.preferredTime = newTime;
      await updateConsultation(selectedConsultation.id, updateData);
      toast.success(newDate || newTime ? '상담 정보가 수정되었습니다.' : '상태가 변경되었습니다.');
      setStatusModalOpen(false);
      setNewDate('');
      setNewTime('');
      loadData();
    } catch {
      toast.error('수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!selectedConsultation) return;
    setDeleting(true);
    try {
      await deleteConsultation(selectedConsultation.id);
      toast.success('상담 신청이 삭제되었습니다.');
      setDeleteModalOpen(false);
      setSelectedConsultation(null);
      loadData();
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  // 정보 수정 모달 열기
  const openEditInfoModal = (c: Consultation) => {
    setEditInfoConsultation({ ...c });
  };

  // 정보 수정 저장
  const handleSaveInfo = async () => {
    if (!editInfoConsultation) return;
    setSavingInfo(true);
    try {
      await updateConsultation(editInfoConsultation.id, {
        studentName: editForm.studentName,
        studentGrade: editForm.studentGrade,
        studentSchool: editForm.studentSchool,
        parentPhone: editForm.parentPhone,
        gender: editForm.gender || undefined,
        schoolGradeAvg: editForm.schoolGradeAvg,
        admissionType: editForm.admissionType || undefined,
        mockTestGrades: editForm.mockTestGrades,
        targetSchool: editForm.targetSchool,
        referrerStudent: editForm.referrerStudent
      });
      toast.success('정보가 수정되었습니다.');
      setEditInfoModalOpen(false);
      setEditInfoConsultation(null);
      setDetailOpen(false);
      loadData();
    } catch {
      toast.error('수정에 실패했습니다.');
    } finally {
      setSavingInfo(false);
    }
  };

  // 날짜 변경 시 예약된 시간 조회 (직접 등록 모달)
  const handleDateChange = async (date: string) => {
    setDirectForm({ ...directForm, preferredDate: date, preferredTime: '' });
    if (!date) { setBookedTimes([]); return; }
    setLoadingBookedTimes(true);
    try {
      const response = await getBookedTimes(date);
      setBookedTimes(response.bookedTimes || []);
    } catch {
      setBookedTimes([]);
    } finally {
      setLoadingBookedTimes(false);
    }
  };

  // 직접 등록
  const handleDirectRegister = async () => {
    const missing: string[] = [];
    if (!directForm.studentName) missing.push('학생명');
    if (!directForm.phone) missing.push('전화번호');
    if (!directForm.grade) missing.push('학년');
    if (!directForm.preferredDate) missing.push('상담일');
    if (!directForm.preferredTime) missing.push('시간');
    if (missing.length > 0) {
      toast.error(`${missing.join(', ')}을(를) 입력해주세요.`);
      return;
    }
    setRegistering(true);
    try {
      await createDirectConsultation(directForm);
      toast.success('상담이 등록되었습니다.');
      setDirectRegisterOpen(false);
      setDirectForm(DEFAULT_DIRECT_FORM);
      setBookedTimes([]);
      loadData();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || '등록에 실패했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  // 재원생 목록 로드
  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const response = await apiClient.get<{ students: Array<{ id: number; name: string; grade: string }> }>('/students', {
        params: { status: 'active', limit: 500 }
      });
      setStudents(response.students || []);
    } catch {
      // 학생 목록 로드 실패 시 빈 배열 유지
    } finally {
      setStudentsLoading(false);
    }
  };

  // 재원생 상담 등록 제출
  const handleLearningSubmit = async () => {
    if (!learningForm.studentId || !learningForm.preferredDate || !learningForm.preferredTime) {
      toast.error('학생, 날짜, 시간을 모두 선택해주세요.');
      return;
    }
    setSubmittingLearning(true);
    try {
      await apiClient.post('/consultations/learning', {
        studentId: parseInt(learningForm.studentId),
        preferredDate: learningForm.preferredDate,
        preferredTime: learningForm.preferredTime,
        learningType: learningForm.learningType,
        adminNotes: learningForm.adminNotes
      });
      toast.success('재원생 상담이 등록되었습니다.');
      setLearningModalOpen(false);
      setLearningForm(DEFAULT_LEARNING_FORM);
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || '상담 등록에 실패했습니다.');
    } finally {
      setSubmittingLearning(false);
    }
  };

  // 체험 일정 추가/삭제
  const addTrialDate = () => setTrialDates([...trialDates, { date: '', timeSlot: '' }]);
  const removeTrialDate = (index: number) => {
    if (trialDates.length <= 1) { toast.error('최소 1개의 체험 일정이 필요합니다.'); return; }
    setTrialDates(trialDates.filter((_, i) => i !== index));
  };

  // 체험 학생 등록
  const handleConvertToTrial = async () => {
    if (!selectedConsultation) return;
    const incompleteDate = trialDates.find(d => !d.date || !d.timeSlot);
    if (incompleteDate) { toast.error('모든 체험 일정의 날짜와 시간대를 선택해주세요.'); return; }
    const dateSet = new Set<string>();
    for (const d of trialDates) {
      const key = `${d.date}-${d.timeSlot}`;
      if (dateSet.has(key)) { toast.error('같은 날짜, 같은 시간대의 체험 일정이 중복됩니다.'); return; }
      dateSet.add(key);
    }
    const dateOnlySet = new Set<string>();
    for (const d of trialDates) {
      if (dateOnlySet.has(d.date)) { toast.error('같은 날에 여러 체험 수업을 등록할 수 없습니다.'); return; }
      dateOnlySet.add(d.date);
    }
    setConvertingToTrial(true);
    try {
      await convertToTrialStudent(selectedConsultation.id, trialDates);
      toast.success('체험 학생으로 등록되었습니다.');
      setTrialModalOpen(false);
      setDetailOpen(false);
      setTrialDates([{ date: '', timeSlot: '' }]);
      loadData();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || '체험 등록에 실패했습니다.');
    } finally {
      setConvertingToTrial(false);
    }
  };

  // 상담 상세 열기
  const openDetailModal = (c: Consultation) => {
    setSelectedConsultation(c);
    setDetailOpen(true);
  };

  return {
    // 데이터
    consultations, loading, stats, pagination, setPagination,
    // 필터
    search, setSearch, statusFilter, setStatusFilter,
    typeFilter, setTypeFilter, dateFilter, setDateFilter,
    // 상세 모달
    selectedConsultation, setSelectedConsultation, detailOpen, setDetailOpen,
    openDetailModal,
    // 상태 변경 모달
    statusModalOpen, setStatusModalOpen,
    newStatus, setNewStatus, adminNotes, setAdminNotes,
    updating, newDate, newTime, setNewTime,
    editBookedTimes, loadingEditBookedTimes,
    editTimeOptions,
    handleEditDateChange, handleStatusChange,
    // 삭제 모달
    deleteModalOpen, setDeleteModalOpen, deleting, handleDelete,
    // 정보 수정 모달
    editInfoModalOpen, setEditInfoModalOpen,
    editInfoConsultation, setEditInfoConsultation,
    editForm, setEditForm, savingInfo,
    openEditInfoModal, handleSaveInfo,
    // 직접 등록 모달
    directRegisterOpen, setDirectRegisterOpen,
    directForm, setDirectForm,
    registering, bookedTimes, loadingBookedTimes,
    timeOptions, handleDateChange, handleDirectRegister,
    // 유형 선택 모달
    typeSelectOpen, setTypeSelectOpen,
    // 재원생 상담 모달
    learningModalOpen, setLearningModalOpen,
    students, studentsLoading, learningForm, setLearningForm,
    submittingLearning, loadStudents, handleLearningSubmit,
    // 체험 등록 모달
    trialModalOpen, setTrialModalOpen,
    trialDates, setTrialDates,
    convertingToTrial,
    addTrialDate, removeTrialDate, handleConvertToTrial,
    // 공통 액션
    loadData,
  };
}
