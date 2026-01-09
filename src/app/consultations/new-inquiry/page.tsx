'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, Clock, User, Phone, Search, Plus, Eye, Edit, Trash2,
  ChevronDown, MoreHorizontal, Loader2, RefreshCw, CheckSquare, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">신규상담</h1>
          <p className="text-muted-foreground">신규 학생 상담 관리</p>
        </div>
        <div className="flex items-center gap-2">
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
                placeholder="학생명, 연락처 검색..."
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
                        <span className="font-medium">{c.student_name}</span>
                        <Badge variant="outline">{c.student_grade}</Badge>
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
                        {c.parent_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {c.parent_phone}
                          </span>
                        )}
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
            <DialogTitle>상담 상세</DialogTitle>
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
                {selectedConsultation.parent_phone && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">연락처</Label>
                    <p className="font-medium">{selectedConsultation.parent_phone}</p>
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
