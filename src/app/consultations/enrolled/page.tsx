'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, Clock, User, Search, Plus, Eye, Edit, Trash2,
  MoreHorizontal, Loader2, RefreshCw, GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  getBookedTimes, getConsultationSettings
} from '@/lib/api/consultations';
import type { WeeklyHour, LearningType } from '@/lib/types/consultation';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS,
  LEARNING_TYPE_LABELS
} from '@/lib/types/consultation';
import apiClient from '@/lib/api/client';

interface Student {
  id: number;
  name: string;
  grade: string;
}

export default function EnrolledConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // 필터
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
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

  // 재원생상담 등록 모달
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [createForm, setCreateForm] = useState({
    studentId: '',
    preferredDate: '',
    preferredTime: '',
    learningType: 'regular' as LearningType,
    adminNotes: ''
  });
  const [creating, setCreating] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingBookedTimes, setLoadingBookedTimes] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);

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
      // Backend only supports { status?, date? } — filter rest client-side
      const allConsultations = await getConsultations({
        status: statusFilter || undefined,
      });

      // Client-side filtering: learning type, search, date range
      let filtered = allConsultations.filter(c => c.consultation_type === 'learning');
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(c =>
          c.student_name?.toLowerCase().includes(q) ||
          c.student_phone?.includes(q) ||
          c.parent_phone?.includes(q)
        );
      }
      const { startDate, endDate } = getDateRange();
      if (startDate) {
        filtered = filtered.filter(c => c.date >= startDate);
      }
      if (endDate) {
        filtered = filtered.filter(c => c.date <= endDate);
      }

      // Client-side stats
      const byStatus: Record<string, number> = { total: filtered.length };
      filtered.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
      setStats(byStatus);

      // Client-side pagination
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
      const page = Math.min(pagination.page, totalPages);
      const start = (page - 1) * pagination.limit;
      setConsultations(filtered.slice(start, start + pagination.limit));
      setPagination({ total, page, limit: pagination.limit, totalPages });
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
        if (response?.weekly_hours && Array.isArray(response.weekly_hours)) {
          setWeeklyHours(response.weekly_hours as unknown as WeeklyHour[]);
        }
      } catch (error) {
        console.error('운영시간 설정 로드 오류:', error);
      }
    };
    loadSettings();
  }, []);

  // 재원생 목록 로드
  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const response = await apiClient.get<{ students: Student[] }>('/students?status=active&limit=500');
      setStudents(response.students || []);
    } catch (error) {
      console.error('학생 목록 로드 오류:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  // 예약된 시간 로드
  const loadBookedTimes = async (date: string) => {
    if (!date) return;
    setLoadingBookedTimes(true);
    try {
      const times = await getBookedTimes(date);
      setBookedTimes(times);
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
      const times = await getBookedTimes(date);
      setEditBookedTimes(times);
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

  // 재원생상담 등록
  const handleCreateConsultation = async () => {
    if (!createForm.studentId || !createForm.preferredDate || !createForm.preferredTime) {
      toast.error('필수 항목을 입력해주세요.');
      return;
    }

    setCreating(true);
    try {
      await apiClient.post('/consultations/learning', {
        studentId: parseInt(createForm.studentId),
        preferredDate: createForm.preferredDate,
        preferredTime: createForm.preferredTime,
        learningType: createForm.learningType,
        adminNotes: createForm.adminNotes || undefined
      });

      toast.success('재원생 상담이 등록되었습니다.');
      setCreateModalOpen(false);
      setCreateForm({
        studentId: '',
        preferredDate: '',
        preferredTime: '',
        learningType: 'regular',
        adminNotes: ''
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

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">재원생상담</h1>
          <p className="text-muted-foreground">재원생 학습/진학 상담 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/consultations/calendar?type=learning">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              캘린더
            </Button>
          </Link>
          <Button onClick={() => {
            loadStudents();
            setCreateModalOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            재원생상담 등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="학생명 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

      {/* 목록 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              상담 내역이 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {consultations.map((c) => (
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
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{c.student_name}</span>
                        <Badge variant="outline">{c.student_grade}</Badge>
                        {c.learning_type && (
                          <Badge variant="secondary">{LEARNING_TYPE_LABELS[c.learning_type]}</Badge>
                        )}
                        <Badge className={CONSULTATION_STATUS_COLORS[c.status]}>
                          {CONSULTATION_STATUS_LABELS[c.status]}
                        </Badge>
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
                      </div>
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
        <DialogContent className="max-w-lg py-6 px-6">
          <DialogHeader>
            <DialogTitle>재원생 상담 상세</DialogTitle>
          </DialogHeader>
          {selectedConsultation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">학생명</Label>
                  <p className="font-medium">{selectedConsultation.student_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">학년</Label>
                  <p className="font-medium">{selectedConsultation.student_grade}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">상담일시</Label>
                  <p className="font-medium">
                    {format(parseISO(selectedConsultation.preferred_date), 'yyyy년 M월 d일', { locale: ko })} {selectedConsultation.preferred_time?.slice(0, 5)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">상태</Label>
                  <Badge className={CONSULTATION_STATUS_COLORS[selectedConsultation.status]}>
                    {CONSULTATION_STATUS_LABELS[selectedConsultation.status]}
                  </Badge>
                </div>
                {selectedConsultation.learning_type && (
                  <div>
                    <Label className="text-muted-foreground">상담유형</Label>
                    <Badge variant="secondary">{LEARNING_TYPE_LABELS[selectedConsultation.learning_type]}</Badge>
                  </div>
                )}
                {selectedConsultation.admin_notes && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">메모</Label>
                    <p className="text-sm whitespace-pre-wrap">{selectedConsultation.admin_notes}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
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

      {/* 재원생상담 등록 모달 */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md py-6 px-6">
          <DialogHeader>
            <DialogTitle>재원생상담 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>학생 선택 *</Label>
              {loadingStudents ? (
                <div className="mt-1 p-2 text-sm text-muted-foreground">학생 목록 로딩 중...</div>
              ) : (
                <Select
                  value={createForm.studentId}
                  onValueChange={(v) => setCreateForm({ ...createForm, studentId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="학생 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name} ({s.grade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              <Label>상담 유형</Label>
              <Select
                value={createForm.learningType}
                onValueChange={(v) => setCreateForm({ ...createForm, learningType: v as LearningType })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">정기 상담</SelectItem>
                  <SelectItem value="admission">진학 상담</SelectItem>
                  <SelectItem value="parent">학부모 상담</SelectItem>
                  <SelectItem value="concern">고민 상담</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>메모</Label>
              <Textarea
                value={createForm.adminNotes}
                onChange={(e) => setCreateForm({ ...createForm, adminNotes: e.target.value })}
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
    </div>
  );
}
