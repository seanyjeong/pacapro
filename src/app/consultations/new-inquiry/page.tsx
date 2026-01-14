'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, Clock, Phone, Search, Plus, Eye, Edit, Trash2,
  MoreHorizontal, Loader2, RefreshCw, CheckSquare,
  UserCheck, UserX, Dumbbell, ChevronDown, ChevronRight, User, School,
  Settings, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

import {
  getConsultations, updateConsultation, deleteConsultation,
  createDirectConsultation, convertToTrialStudent, getBookedTimes,
  getConsultationSettings
} from '@/lib/api/consultations';
import type { WeeklyHour } from '@/lib/types/consultation';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS
} from '@/lib/types/consultation';

export default function NewInquiryConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // 필터
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

  // 완료 탭 필터 (전체/등록/체험중/미등록) - 기존 유지
  const [completedTab, setCompletedTab] = useState<'all' | 'registered' | 'trial_ongoing' | 'unregistered'>('all');

  // 태그 필터 (다중 선택 가능)
  type TagFilter = 'registered' | 'trial_completed' | 'trial_ongoing' | 'unregistered' | 'no_trial';
  const [selectedTags, setSelectedTags] = useState<TagFilter[]>([]);

  // 월별 접기/펼치기 (현재 달만 기본 펼침)
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

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

  // 신규상담 등록 모달
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    studentName: '',
    phone: '',
    grade: '',
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });
  const [creating, setCreating] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingBookedTimes, setLoadingBookedTimes] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);

  // 체험 등록 모달
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialConsultation, setTrialConsultation] = useState<Consultation | null>(null);
  const [trialDates, setTrialDates] = useState<{ date: string; timeSlot: string }[]>([
    { date: '', timeSlot: '' }
  ]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const response = await getConsultations({
        search: search || undefined,
        status: statusFilter || undefined,
        consultationType: 'new_registration', // 신규상담만
        startDate,
        endDate,
        page: pagination.page,
        limit: pagination.limit
      });

      setConsultations(response.consultations);
      setStats(response.stats);
      setPagination(response.pagination);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, dateFilter, pagination.page]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getConsultationSettings();
        if (response.weeklyHours) {
          setWeeklyHours(response.weeklyHours);
        }
      } catch (error) {
        console.error('운영시간 설정 로드 오류:', error);
      }
    };
    loadSettings();
  }, []);

  // 예약된 시간 로드
  const loadBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingBookedTimes(true);
    try {
      const response = await getBookedTimes(date);
      setBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 로드 오류:', error);
    } finally {
      setLoadingBookedTimes(false);
    }
  };

  // 수정용 예약된 시간 로드
  const loadEditBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingEditBookedTimes(true);
    try {
      const response = await getBookedTimes(date);
      setEditBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 로드 오류:', error);
    } finally {
      setLoadingEditBookedTimes(false);
    }
  };

  // 시간 슬롯 생성
  const generateTimeSlots = (date: string) => {
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
  };

  // 신규상담 등록
  const handleCreateConsultation = async () => {
    if (!createForm.studentName || !createForm.preferredDate || !createForm.preferredTime) {
      toast.error('필수 항목을 입력해주세요.');
      return;
    }

    setCreating(true);
    try {
      await createDirectConsultation({
        studentName: createForm.studentName,
        phone: createForm.phone,
        grade: createForm.grade,
        preferredDate: createForm.preferredDate,
        preferredTime: createForm.preferredTime,
        notes: createForm.notes || undefined
      });

      toast.success('상담이 등록되었습니다.');
      setCreateModalOpen(false);
      setCreateForm({
        studentName: '',
        phone: '',
        grade: '',
        preferredDate: '',
        preferredTime: '',
        notes: ''
      });
      loadData();
    } catch (error) {
      console.error('상담 등록 오류:', error);
      toast.error('상담 등록에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  // 상태 변경
  const handleStatusChange = async () => {
    if (!selectedConsultation) return;

    setUpdating(true);
    try {
      await updateConsultation(selectedConsultation.id, {
        status: newStatus,
        adminNotes: adminNotes || undefined,
        preferredDate: newDate || undefined,
        preferredTime: newTime || undefined
      });

      toast.success('상담 상태가 변경되었습니다.');
      setStatusModalOpen(false);
      setDetailOpen(false);
      loadData();
    } catch (error) {
      console.error('상태 변경 오류:', error);
      toast.error('상태 변경에 실패했습니다.');
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
      toast.success('상담이 삭제되었습니다.');
      setDeleteModalOpen(false);
      setDetailOpen(false);
      loadData();
    } catch (error) {
      console.error('삭제 오류:', error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  // 체험 일정 추가
  const addTrialDate = () => {
    setTrialDates([...trialDates, { date: '', timeSlot: '' }]);
  };

  // 체험 일정 삭제
  const removeTrialDate = (index: number) => {
    if (trialDates.length > 1) {
      setTrialDates(trialDates.filter((_, i) => i !== index));
    }
  };

  // 체험 등록
  const handleConvertToTrial = async () => {
    if (!trialConsultation) return;
    if (!trialDates.some(td => td.date && td.timeSlot)) {
      toast.error('최소 하나의 체험 일정을 입력해주세요.');
      return;
    }

    setConvertingToTrial(true);
    try {
      await convertToTrialStudent(trialConsultation.id, trialDates.filter(td => td.date && td.timeSlot));

      toast.success('체험생으로 등록되었습니다.');
      setTrialModalOpen(false);
      setDetailOpen(false);
      setTrialDates([{ date: '', timeSlot: '' }]);
      loadData();
    } catch (error) {
      console.error('체험 등록 오류:', error);
      toast.error('체험 등록에 실패했습니다.');
    } finally {
      setConvertingToTrial(false);
    }
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // 완료된 상담 중 등록/체험중/미등록 통계 계산 (matched_student_status 사용)
  const completedStats = useMemo(() => {
    const completedList = consultations.filter(c => c.status === 'completed');
    // 등록 = 체험 후 등록 + 바로 등록
    const registered = completedList.filter(c =>
      c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'registered_direct'
    );
    // 체험중 = 현재 체험 진행 중
    const trialOngoing = completedList.filter(c => c.matched_student_status === 'trial_ongoing');
    // 미등록 = 체험완료 미등록 + 미체험
    const unregistered = completedList.filter(c =>
      c.matched_student_status === 'trial_completed' || c.matched_student_status === 'no_trial' || !c.matched_student_status
    );
    return {
      total: completedList.length,
      registered: registered.length,
      trialOngoing: trialOngoing.length,
      unregistered: unregistered.length
    };
  }, [consultations]);

  // 태그 토글
  const toggleTag = (tag: TagFilter) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // 태그 필터에 맞는지 확인
  const matchesTagFilter = (c: Consultation) => {
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
  };

  // 필터링된 상담 목록 (상태 필터 + 태그 필터)
  const filteredConsultations = useMemo(() => {
    let result = consultations;

    // 완료 상태일 때 탭 필터 적용
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

    // 태그 필터 적용 (완료 상태에서만)
    if (selectedTags.length > 0) {
      result = result.filter(c => c.status === 'completed' && matchesTagFilter(c));
    }

    return result;
  }, [consultations, statusFilter, completedTab, selectedTags]);

  // 월별로 그룹화된 상담 목록
  const groupedByMonth = useMemo(() => {
    const groups: { [key: string]: { label: string; consultations: typeof filteredConsultations } } = {};

    filteredConsultations.forEach(c => {
      const date = parseISO(c.preferred_date);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'yyyy년 M월', { locale: ko });

      if (!groups[key]) {
        groups[key] = { label, consultations: [] };
      }
      groups[key].consultations.push(c);
    });

    // 최신순 정렬
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredConsultations]);

  // 현재 달 키 계산
  const currentMonthKey = format(new Date(), 'yyyy-MM');

  // 월별 펼침 상태 확인 (현재 달만 기본 펼침)
  const isMonthExpanded = (monthKey: string) => {
    if (expandedMonths[monthKey] !== undefined) {
      return expandedMonths[monthKey];
    }
    return monthKey === currentMonthKey;
  };

  // 월별 접기/펼치기 토글
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !isMonthExpanded(monthKey)
    }));
  };

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">신규상담</h1>
          <p className="text-muted-foreground">신규 학생 상담 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/consultations">
            <Button variant="outline">
              <ClipboardList className="h-4 w-4 mr-2" />
              상담 관리
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              상담 설정
            </Button>
          </Link>
          <Link href="/consultations/calendar?type=new">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              캘린더
            </Button>
          </Link>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            신규상담 등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">전체</div>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">대기중</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">확정</div>
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">완료</div>
            <div className="text-2xl font-bold text-green-600">{stats.completed || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5" />
              등록완료
            </div>
            <div className="text-2xl font-bold text-primary">{completedStats.registered}</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="학생명, 연락처 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => {
              setStatusFilter(v);
              setCompletedTab('all'); // 상태 변경 시 탭 초기화
            }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
                <SelectItem value="pending">대기중</SelectItem>
                <SelectItem value="confirmed">확정</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="cancelled">취소</SelectItem>
                <SelectItem value="no_show">노쇼</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="week">이번 주</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 완료 상태일 때 미등록/체험/등록 탭 */}
      {statusFilter === 'completed' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground mr-2">완료 상담 분류:</span>
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={completedTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompletedTab('all')}
                  className="h-8"
                >
                  전체
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {completedStats.total}
                  </Badge>
                </Button>
                <Button
                  variant={completedTab === 'unregistered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompletedTab('unregistered')}
                  className={cn(
                    "h-8",
                    completedTab !== 'unregistered' && "text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:hover:bg-orange-950"
                  )}
                >
                  <UserX className="h-3.5 w-3.5 mr-1" />
                  미등록
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {completedStats.unregistered}
                  </Badge>
                </Button>
                <Button
                  variant={completedTab === 'trial_ongoing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompletedTab('trial_ongoing')}
                  className={cn(
                    "h-8",
                    completedTab !== 'trial_ongoing' && "text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-950"
                  )}
                >
                  <Dumbbell className="h-3.5 w-3.5 mr-1" />
                  체험중
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {completedStats.trialOngoing}
                  </Badge>
                </Button>
                <Button
                  variant={completedTab === 'registered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompletedTab('registered')}
                  className={cn(
                    "h-8",
                    completedTab !== 'registered' && "text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950"
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  등록
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {completedStats.registered}
                  </Badge>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 태그 필터 (다중 선택) */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">태그 필터:</span>
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={selectedTags.includes('registered') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTag('registered')}
                className={cn(
                  "h-7 text-xs",
                  !selectedTags.includes('registered') && "text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
                )}
              >
                <UserCheck className="h-3 w-3 mr-1" />
                등록
              </Button>
              <Button
                variant={selectedTags.includes('trial_completed') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTag('trial_completed')}
                className={cn(
                  "h-7 text-xs",
                  !selectedTags.includes('trial_completed') && "text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950"
                )}
              >
                <Dumbbell className="h-3 w-3 mr-1" />
                체험완료
              </Button>
              <Button
                variant={selectedTags.includes('trial_ongoing') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTag('trial_ongoing')}
                className={cn(
                  "h-7 text-xs",
                  !selectedTags.includes('trial_ongoing') && "text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                )}
              >
                <Dumbbell className="h-3 w-3 mr-1" />
                체험중
              </Button>
              <Button
                variant={selectedTags.includes('unregistered') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTag('unregistered')}
                className={cn(
                  "h-7 text-xs",
                  !selectedTags.includes('unregistered') && "text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950"
                )}
              >
                <UserX className="h-3 w-3 mr-1" />
                미등록
              </Button>
              <Button
                variant={selectedTags.includes('no_trial') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTag('no_trial')}
                className={cn(
                  "h-7 text-xs",
                  !selectedTags.includes('no_trial') && "text-gray-600 border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                )}
              >
                미체험
              </Button>
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTags([])}
                  className="h-7 text-xs text-muted-foreground"
                >
                  초기화
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {statusFilter === 'completed' && completedTab !== 'all'
                ? (completedTab === 'registered'
                    ? '등록된 상담이 없습니다.'
                    : completedTab === 'trial_ongoing'
                      ? '체험중인 상담이 없습니다.'
                      : '미등록 상담이 없습니다.')
                : '상담 내역이 없습니다.'}
            </div>
          ) : (
            <div>
              {groupedByMonth.map((group) => (
                <div key={group.key}>
                  {/* 월별 헤더 (클릭하면 접기/펼치기) */}
                  <div
                    className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => toggleMonth(group.key)}
                  >
                    <div className="flex items-center gap-2">
                      {isMonthExpanded(group.key) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm">{group.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {group.consultations.length}명
                    </Badge>
                  </div>
                  {/* 해당 월의 상담 목록 (펼쳐진 경우만 표시) */}
                  {isMonthExpanded(group.key) && (
                  <div className="divide-y">
                    {group.consultations.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedConsultation(c);
                          setDetailOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{c.student_name}</span>
                              <Badge variant="outline">{c.student_grade}</Badge>
                              <Badge className={CONSULTATION_STATUS_COLORS[c.status]}>
                                {CONSULTATION_STATUS_LABELS[c.status]}
                              </Badge>
                              {c.status === 'completed' && (
                                <>
                                  {/* 체험완료 태그 (체험 후 등록 또는 체험완료 미등록) */}
                                  {(c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'trial_completed') && (
                                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1">
                                      <Dumbbell className="h-3 w-3" />
                                      체험완료
                                    </Badge>
                                  )}
                                  {/* 등록 태그 (체험 후 등록 또는 바로 등록) */}
                                  {(c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'registered_direct') && (
                                    <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 flex items-center gap-1">
                                      <UserCheck className="h-3 w-3" />
                                      등록
                                    </Badge>
                                  )}
                                  {/* 체험중 태그 */}
                                  {c.matched_student_status === 'trial_ongoing' && (
                                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1">
                                      <Dumbbell className="h-3 w-3" />
                                      체험중
                                    </Badge>
                                  )}
                                  {/* 미등록 태그 (체험완료 미등록 또는 미체험) */}
                                  {(c.matched_student_status === 'trial_completed' || c.matched_student_status === 'no_trial' || !c.matched_student_status) && (
                                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 flex items-center gap-1">
                                      <UserX className="h-3 w-3" />
                                      미등록
                                    </Badge>
                                  )}
                                  {/* 미체험 태그 (체험 신청 안함) */}
                                  {c.matched_student_status === 'no_trial' && (
                                    <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 flex items-center gap-1">
                                      미체험
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(parseISO(c.preferred_date), 'M월 d일 (EEE)', { locale: ko })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {c.preferred_time?.slice(0, 5)}
                              </span>
                              {c.parent_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5" />
                                  {c.parent_phone}
                                </span>
                              )}
                            </div>
                            {c.admin_notes && (
                              <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded mt-1">
                                <span className="font-medium">메모:</span> {c.admin_notes}
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConsultation(c);
                                setDetailOpen(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                상세보기
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConsultation(c);
                                setNewStatus(c.status);
                                setAdminNotes(c.admin_notes || '');
                                setNewDate(c.preferred_date);
                                setNewTime(c.preferred_time || '');
                                setStatusModalOpen(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                상태변경
                              </DropdownMenuItem>
                              {c.status === 'completed' && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setTrialConsultation(c);
                                  setTrialDates([{ date: '', timeSlot: '' }]);
                                  setTrialModalOpen(true);
                                }}>
                                  <CheckSquare className="h-4 w-4 mr-2" />
                                  체험등록
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedConsultation(c);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            이전
          </Button>
          <span className="flex items-center px-4">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            다음
          </Button>
        </div>
      )}

      {/* 상세 모달 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl py-6 px-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              상담 상세정보
            </DialogTitle>
          </DialogHeader>
          {selectedConsultation && (
            <div className="space-y-6">
              {/* 상태 및 일정 */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className={CONSULTATION_STATUS_COLORS[selectedConsultation.status]}>
                    {CONSULTATION_STATUS_LABELS[selectedConsultation.status]}
                  </Badge>
                  {selectedConsultation.status === 'completed' && selectedConsultation.matched_student_status && (
                    <>
                      {(selectedConsultation.matched_student_status === 'registered_with_trial' || selectedConsultation.matched_student_status === 'registered_direct') && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">등록완료</Badge>
                      )}
                      {selectedConsultation.matched_student_status === 'trial_ongoing' && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">체험중</Badge>
                      )}
                      {(selectedConsultation.matched_student_status === 'trial_completed' || selectedConsultation.matched_student_status === 'no_trial') && (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">미등록</Badge>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(selectedConsultation.preferred_date), 'yyyy.MM.dd (EEE)', { locale: ko })}
                  <Clock className="h-4 w-4 ml-2" />
                  {selectedConsultation.preferred_time?.slice(0, 5)}
                </div>
              </div>

              {/* 학생 정보 */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  학생 정보
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 border rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">이름</Label>
                    <p className="font-medium">{selectedConsultation.student_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">학년</Label>
                    <p className="font-medium">{selectedConsultation.student_grade}</p>
                  </div>
                  {(selectedConsultation.parent_phone || selectedConsultation.student_phone) && (
                    <div>
                      <Label className="text-xs text-muted-foreground">연락처</Label>
                      <p className="font-medium">{selectedConsultation.parent_phone || selectedConsultation.student_phone}</p>
                    </div>
                  )}
                  {selectedConsultation.student_school && (
                    <div>
                      <Label className="text-xs text-muted-foreground">학교</Label>
                      <p className="font-medium">{selectedConsultation.student_school}</p>
                    </div>
                  )}
                  {selectedConsultation.gender && (
                    <div>
                      <Label className="text-xs text-muted-foreground">성별</Label>
                      <p className="font-medium">{selectedConsultation.gender === 'male' ? '남자' : '여자'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 성적 정보 */}
              {(selectedConsultation.academic_scores || selectedConsultation.academicScores) && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                    <School className="h-4 w-4" />
                    성적 정보
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 border rounded-lg">
                    {(() => {
                      const scores = selectedConsultation.academic_scores || selectedConsultation.academicScores;
                      const mockTest = scores?.mockTestGrades || scores?.mock_exam_grades;
                      return (
                        <>
                          {scores?.schoolGradeAvg !== undefined && scores.schoolGradeAvg > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">내신평균</Label>
                              <p className="font-medium">{scores.schoolGradeAvg}등급</p>
                            </div>
                          )}
                          {mockTest?.korean && (
                            <div>
                              <Label className="text-xs text-muted-foreground">국어(모의)</Label>
                              <p className="font-medium">{mockTest.korean}등급</p>
                            </div>
                          )}
                          {mockTest?.math && (
                            <div>
                              <Label className="text-xs text-muted-foreground">수학(모의)</Label>
                              <p className="font-medium">{mockTest.math}등급</p>
                            </div>
                          )}
                          {mockTest?.english && (
                            <div>
                              <Label className="text-xs text-muted-foreground">영어(모의)</Label>
                              <p className="font-medium">{mockTest.english}등급</p>
                            </div>
                          )}
                          {mockTest?.exploration && (
                            <div>
                              <Label className="text-xs text-muted-foreground">탐구(모의)</Label>
                              <p className="font-medium">{mockTest.exploration}등급</p>
                            </div>
                          )}
                          {scores?.admissionType && (
                            <div>
                              <Label className="text-xs text-muted-foreground">입시 유형</Label>
                              <p className="font-medium">{scores.admissionType === 'early' ? '수시' : '정시'}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 상담 관련 정보 */}
              {(selectedConsultation.target_school || selectedConsultation.referrer_student || selectedConsultation.inquiry_content) && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">상담 정보</h4>
                  <div className="space-y-3 p-3 border rounded-lg">
                    {selectedConsultation.target_school && (
                      <div>
                        <Label className="text-xs text-muted-foreground">목표 학교</Label>
                        <p className="font-medium">{selectedConsultation.target_school}</p>
                      </div>
                    )}
                    {selectedConsultation.referrer_student && (
                      <div>
                        <Label className="text-xs text-muted-foreground">추천인</Label>
                        <p className="font-medium">{selectedConsultation.referrer_student}</p>
                      </div>
                    )}
                    {((selectedConsultation.referral_sources || selectedConsultation.referralSources)?.length ?? 0) > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">유입 경로</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(selectedConsultation.referral_sources || selectedConsultation.referralSources)?.map((source, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{source}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedConsultation.inquiry_content && (
                      <div>
                        <Label className="text-xs text-muted-foreground">문의 내용</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/50 p-2 rounded">{selectedConsultation.inquiry_content}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 메모 */}
              {(selectedConsultation.admin_notes || selectedConsultation.consultation_memo) && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">메모</h4>
                  <div className="space-y-2 p-3 border rounded-lg">
                    {selectedConsultation.admin_notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">관리자 메모</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{selectedConsultation.admin_notes}</p>
                      </div>
                    )}
                    {selectedConsultation.consultation_memo && (
                      <div>
                        <Label className="text-xs text-muted-foreground">상담 메모</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{selectedConsultation.consultation_memo}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  닫기
                </Button>
                <Link href={`/consultations/${selectedConsultation.id}/conduct`}>
                  <Button>상담 진행</Button>
                </Link>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 상태 변경 모달 */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md py-6 px-6">
          <DialogHeader>
            <DialogTitle>상태 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>상태</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ConsultationStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="confirmed">확정</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                  <SelectItem value="no_show">노쇼</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>일정 변경 (선택)</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    if (e.target.value) {
                      loadEditBookedTimes(e.target.value);
                    }
                  }}
                />
                <Select value={newTime} onValueChange={setNewTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="시간" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeSlots(newDate).map((time) => {
                      const isBooked = editBookedTimes.includes(time);
                      return (
                        <SelectItem key={time} value={time}>
                          {time} {isBooked && '(예약있음)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>메모</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleStatusChange} disabled={updating}>
              {updating ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-sm py-6 px-6">
          <DialogHeader>
            <DialogTitle>상담 삭제</DialogTitle>
            <DialogDescription>
              정말 이 상담을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 신규상담 등록 모달 */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md py-6 px-6">
          <DialogHeader>
            <DialogTitle>신규상담 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>학생명 *</Label>
              <Input
                value={createForm.studentName}
                onChange={(e) => setCreateForm({ ...createForm, studentName: e.target.value })}
                className="mt-1"
                placeholder="학생 이름"
              />
            </div>
            <div>
              <Label>학년</Label>
              <Select
                value={createForm.grade}
                onValueChange={(v) => setCreateForm({ ...createForm, grade: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="학년 선택" />
                </SelectTrigger>
                <SelectContent>
                  {['중1', '중2', '중3', '고1', '고2', '고3', 'N수'].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>연락처</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="mt-1"
                placeholder="010-0000-0000"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>상담일 *</Label>
                <Input
                  type="date"
                  value={createForm.preferredDate}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, preferredDate: e.target.value, preferredTime: '' });
                    if (e.target.value) {
                      loadBookedTimes(e.target.value);
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>시간 *</Label>
                <Select
                  value={createForm.preferredTime}
                  onValueChange={(v) => setCreateForm({ ...createForm, preferredTime: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="시간" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingBookedTimes ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">로딩 중...</div>
                    ) : (
                      generateTimeSlots(createForm.preferredDate).map((time) => {
                        const isBooked = bookedTimes.includes(time);
                        return (
                          <SelectItem key={time} value={time}>
                            {time} {isBooked && '(예약있음)'}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>메모</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateConsultation} disabled={creating}>
              {creating ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 체험 등록 모달 */}
      <Dialog open={trialModalOpen} onOpenChange={setTrialModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>체험 수업 일정 선택</DialogTitle>
            <DialogDescription>
              {trialConsultation?.student_name}님의 체험 수업 일정을 선택해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6 px-6 max-h-[60vh] overflow-y-auto">
            {/* 체험 일정 선택 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>체험 일정 ({trialDates.length}회)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTrialDate}>
                  <Plus className="h-4 w-4 mr-1" />
                  추가
                </Button>
              </div>

              {trialDates.map((trialDate, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-8">{index + 1}회</span>
                  <Input
                    type="date"
                    value={trialDate.date}
                    onChange={(e) => {
                      const newDates = [...trialDates];
                      newDates[index] = { ...newDates[index], date: e.target.value };
                      setTrialDates(newDates);
                    }}
                    className="flex-1"
                  />
                  <Select
                    value={trialDate.timeSlot}
                    onValueChange={(v) => {
                      const newDates = [...trialDates];
                      newDates[index] = { ...newDates[index], timeSlot: v };
                      setTrialDates(newDates);
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <span>{trialDate.timeSlot === 'morning' ? '오전' : trialDate.timeSlot === 'afternoon' ? '오후' : trialDate.timeSlot === 'evening' ? '저녁' : '시간대'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">오전</SelectItem>
                      <SelectItem value="afternoon">오후</SelectItem>
                      <SelectItem value="evening">저녁</SelectItem>
                    </SelectContent>
                  </Select>
                  {trialDates.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTrialDate(index)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
              체험 학생으로 등록되면:
              <ul className="mt-1 ml-4 list-disc">
                <li>학생 관리에 체험생으로 추가됩니다</li>
                <li>출석 체크 시 체험 횟수가 차감됩니다</li>
                <li>체험 완료 후 정식 등록을 권유합니다</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleConvertToTrial} disabled={convertingToTrial}>
              {convertingToTrial ? '등록 중...' : '체험 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
