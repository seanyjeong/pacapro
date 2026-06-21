import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import {
  deleteConsultation,
  getBookedTimes,
  getConsultationSettings,
  getConsultations,
  updateConsultation,
} from '@/lib/api/consultations';
import type { Consultation, ConsultationStatus, WeeklyHour } from '@/lib/types/consultation';
import {
  createInitialCreateForm,
  createInitialCreateScores,
} from './enrolled-consultations-constants';
import type {
  CreateConsultationForm,
  DateFilter,
  PaginationState,
  ScoreData,
  Student,
} from './enrolled-consultations-types';
import { generateTimeSlots, getDateRange } from './enrolled-consultations-utils';

export function useEnrolledConsultationsState() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<PaginationState>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
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
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const [createForm, setCreateForm] = useState<CreateConsultationForm>(() => createInitialCreateForm());
  const [creating, setCreating] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingBookedTimes, setLoadingBookedTimes] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);
  const [showScores, setShowScores] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [selectedExam, setSelectedExam] = useState('수능');
  const [studentScores, setStudentScores] = useState<ScoreData | null>(null);
  const [createScoresLoading, setCreateScoresLoading] = useState(false);
  const [createScores, setCreateScores] = useState<Record<string, ScoreData | null>>(() => createInitialCreateScores());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(dateFilter);
      const response = await getConsultations(
        {
          search: search || undefined,
          status: statusFilter || undefined,
          consultationType: 'learning',
          startDate,
          endDate,
          page: pagination.page,
          limit: pagination.limit,
        },
        { suppressErrorToast: true },
      );

      setConsultations(response.consultations);
      setStats(response.stats);
      setPagination(response.pagination);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      toast.error('상담 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, pagination.limit, pagination.page, search, statusFilter]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await getConsultationSettings({ suppressErrorToast: true });
      if (response.weeklyHours) setWeeklyHours(response.weeklyHours);
    } catch (error) {
      console.error('운영시간 설정 로드 오류:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadStudentScores = async (studentId: number, exam: string) => {
    setLoadingScores(true);
    try {
      const response = await apiClient.get<{ success: boolean; matched: boolean; scores: ScoreData }>(
        `/jungsi/scores/${studentId}?exam=${encodeURIComponent(exam)}`,
        { suppressErrorToast: true },
      );
      setStudentScores(response.success && response.matched ? response.scores : null);
    } catch (error) {
      console.error('성적 조회 오류:', error);
      setStudentScores(null);
    } finally {
      setLoadingScores(false);
    }
  };

  const loadCreateStudentScores = async (studentId: number) => {
    setCreateScoresLoading(true);
    const results: Record<string, ScoreData | null> = { '3월': null, '6월': null, '9월': null };

    try {
      await Promise.all(['3월', '6월', '9월'].map(async (exam) => {
        try {
          const response = await apiClient.get<{ success: boolean; matched: boolean; scores: ScoreData }>(
            `/jungsi/scores/${studentId}?exam=${encodeURIComponent(exam)}`,
            { suppressErrorToast: true },
          );
          if (response.success && response.matched && response.scores) {
            results[exam] = response.scores;
          }
        } catch {
          // Individual score lookup failures should not block consultation creation.
        }
      }));
      setCreateScores(results);
    } catch (error) {
      console.error('성적 조회 오류:', error);
    } finally {
      setCreateScoresLoading(false);
    }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const response = await apiClient.get<{ students: Student[] }>('/students?status=active&limit=500', {
        suppressErrorToast: true,
      });
      setStudents(response.students || []);
    } catch (error) {
      console.error('학생 목록 로드 오류:', error);
      toast.error('학생 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingBookedTimes(true);
    try {
      const response = await getBookedTimes(date, { suppressErrorToast: true });
      setBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 로드 오류:', error);
      toast.error('예약 시간을 불러오지 못했습니다.');
    } finally {
      setLoadingBookedTimes(false);
    }
  };

  const loadEditBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingEditBookedTimes(true);
    try {
      const response = await getBookedTimes(date, { suppressErrorToast: true });
      setEditBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 로드 오류:', error);
      toast.error('예약 시간을 불러오지 못했습니다.');
    } finally {
      setLoadingEditBookedTimes(false);
    }
  };

  const openCreateModal = () => {
    loadStudents();
    setCreateModalOpen(true);
  };

  const openDetail = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setShowScores(false);
    setStudentScores(null);
    setDetailOpen(true);
  };

  const openStatusModal = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setNewStatus(consultation.status);
    setAdminNotes(consultation.admin_notes || '');
    setNewDate(consultation.preferred_date);
    setNewTime(consultation.preferred_time || '');
    setStatusModalOpen(true);
  };

  const openDeleteModal = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setDeleteModalOpen(true);
  };

  const updateCreateForm = <K extends keyof CreateConsultationForm>(field: K, value: CreateConsultationForm[K]) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectCreateStudent = (student: Student) => {
    updateCreateForm('studentId', student.id.toString());
    setStudentSearch('');
    setStudentDropdownOpen(false);
    loadCreateStudentScores(student.id);
  };

  const setCreatePreferredDate = (date: string) => {
    setCreateForm((prev) => ({ ...prev, preferredDate: date, preferredTime: '' }));
    if (date) loadBookedTimes(date);
  };

  const setCreateScore = (exam: string, subject: string, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      scores: {
        ...prev.scores,
        [exam]: { ...prev.scores[exam], [subject]: value },
      },
    }));
  };

  const resetCreateState = () => {
    setCreateForm(createInitialCreateForm());
    setStudentSearch('');
    setStudentDropdownOpen(false);
    setCreateScores(createInitialCreateScores());
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    resetCreateState();
  };

  const handleCreateConsultation = async () => {
    if (!createForm.studentId || !createForm.preferredDate || !createForm.preferredTime) {
      toast.error('필수 항목을 입력해주세요.');
      return;
    }

    setCreating(true);
    try {
      const filteredScores: Record<string, Record<string, string>> = {};
      for (const [exam, subjects] of Object.entries(createForm.scores)) {
        if (Object.values(subjects).some((value) => value !== '')) {
          filteredScores[exam] = subjects;
        }
      }

      await apiClient.post(
        '/consultations/learning',
        {
          studentId: Number.parseInt(createForm.studentId, 10),
          preferredDate: createForm.preferredDate,
          preferredTime: createForm.preferredTime,
          learningType: createForm.learningType,
          adminNotes: createForm.adminNotes || undefined,
          mockExamScores: Object.keys(filteredScores).length > 0 ? filteredScores : undefined,
        },
        { suppressErrorToast: true },
      );

      toast.success('재원생 상담이 등록되었습니다.');
      setCreateModalOpen(false);
      resetCreateState();
      loadData();
    } catch (error) {
      console.error('상담 등록 오류:', error);
      toast.error('재원생 상담 등록에 실패했습니다.');
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
        preferredTime: newTime || undefined,
      }, { suppressErrorToast: true });

      toast.success('상담 상태가 변경되었습니다.');
      setStatusModalOpen(false);
      setDetailOpen(false);
      loadData();
    } catch (error) {
      console.error('상태 변경 오류:', error);
      toast.error('상담 상태 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConsultation) return;

    setDeleting(true);
    try {
      await deleteConsultation(selectedConsultation.id, { suppressErrorToast: true });
      toast.success('상담이 삭제되었습니다.');
      setDeleteModalOpen(false);
      setDetailOpen(false);
      loadData();
    } catch (error) {
      console.error('삭제 오류:', error);
      toast.error('상담 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const changeSelectedExam = (exam: string) => {
    setSelectedExam(exam);
    if (selectedConsultation?.linked_student_id) {
      loadStudentScores(selectedConsultation.linked_student_id, exam);
    }
  };

  const toggleDetailScores = () => {
    if (!selectedConsultation?.linked_student_id) return;
    if (!showScores) {
      setShowScores(true);
      loadStudentScores(selectedConsultation.linked_student_id, selectedExam);
    } else {
      setShowScores(false);
    }
  };

  return {
    consultations,
    loading,
    stats,
    pagination,
    search,
    statusFilter,
    dateFilter,
    selectedConsultation,
    detailOpen,
    statusModalOpen,
    newStatus,
    adminNotes,
    updating,
    newDate,
    newTime,
    editBookedTimes,
    loadingEditBookedTimes,
    deleteModalOpen,
    deleting,
    createModalOpen,
    students,
    loadingStudents,
    studentSearch,
    studentDropdownOpen,
    studentDropdownRef,
    createForm,
    creating,
    bookedTimes,
    loadingBookedTimes,
    weeklyHours,
    showScores,
    loadingScores,
    selectedExam,
    studentScores,
    createScoresLoading,
    createScores,
    setPagination,
    setSearch,
    setStatusFilter,
    setDateFilter,
    setDetailOpen,
    setStatusModalOpen,
    setNewStatus,
    setAdminNotes,
    setNewDate,
    setNewTime,
    setDeleteModalOpen,
    setCreateModalOpen,
    setStudentSearch,
    setStudentDropdownOpen,
    updateCreateForm,
    setCreatePreferredDate,
    setCreateScore,
    loadData,
    loadEditBookedTimes,
    generateTimeSlots: (date: string) => generateTimeSlots(date, weeklyHours),
    openCreateModal,
    openDetail,
    openStatusModal,
    openDeleteModal,
    selectCreateStudent,
    closeCreateModal,
    handleCreateConsultation,
    handleStatusChange,
    handleDelete,
    changeSelectedExam,
    toggleDetailScores,
  };
}
