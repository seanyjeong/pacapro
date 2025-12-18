'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, Clock, User, Phone, Search, Filter, Settings,
  ChevronDown, ChevronRight, Eye, Edit, Trash2, Link2,
  MessageSquare, MoreHorizontal, Loader2, RefreshCw, Plus,
  CheckSquare, Square, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  CONSULTATION_TYPE_LABELS,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS
} from '@/lib/types/consultation';

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // 필터
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // 상세 모달
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 상태 변경 모달
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ConsultationStatus>('pending');
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  // 일정 변경
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [editBookedTimes, setEditBookedTimes] = useState<string[]>([]);
  const [loadingEditBookedTimes, setLoadingEditBookedTimes] = useState(false);

  // 삭제 확인 모달
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 직접 등록 모달
  const [directRegisterOpen, setDirectRegisterOpen] = useState(false);
  const [directForm, setDirectForm] = useState({
    studentName: '',
    phone: '',
    grade: '',
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });
  const [registering, setRegistering] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingBookedTimes, setLoadingBookedTimes] = useState(false);

  // 운영 시간 설정
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);

  // 선택한 날짜의 요일에 맞는 시간 옵션 생성
  const getTimeOptionsForDate = (dateStr: string): string[] => {
    if (!dateStr || weeklyHours.length === 0) return [];

    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0=일, 1=월, ...
    const hourConfig = weeklyHours.find(h => h.dayOfWeek === dayOfWeek);

    if (!hourConfig || !hourConfig.isAvailable) return [];

    const startHour = parseInt(hourConfig.startTime?.substring(0, 2) || '09');
    const startMin = parseInt(hourConfig.startTime?.substring(3, 5) || '00');
    const endHour = parseInt(hourConfig.endTime?.substring(0, 2) || '18');
    const endMin = parseInt(hourConfig.endTime?.substring(3, 5) || '00');

    const times: string[] = [];
    let currentMin = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // 30분 단위로 생성
    while (currentMin < endMinutes) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      currentMin += 30;
    }
    return times;
  };

  const timeOptions = getTimeOptionsForDate(directForm.preferredDate);

  // 체험 등록 모달
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialDates, setTrialDates] = useState<{ date: string; timeSlot: string }[]>([
    { date: '', timeSlot: '' },
    { date: '', timeSlot: '' }
  ]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getConsultations({
        search: search || undefined,
        status: statusFilter || undefined,
        consultationType: typeFilter || undefined,
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
  }, [search, statusFilter, typeFilter, pagination.page]);

  // 운영 시간 설정 로드
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

  // 일정 변경용 시간 옵션
  const editTimeOptions = getTimeOptionsForDate(newDate);

  // 일정 변경 시 날짜 선택
  const handleEditDateChange = async (date: string) => {
    setNewDate(date);
    setNewTime('');
    if (!date) {
      setEditBookedTimes([]);
      return;
    }

    setLoadingEditBookedTimes(true);
    try {
      const response = await getBookedTimes(date);
      // 현재 상담의 시간은 제외 (자기 자신은 선택 가능)
      const currentTime = selectedConsultation?.preferred_time?.substring(0, 5);
      const currentDate = selectedConsultation?.preferred_date;
      const booked = response.bookedTimes || [];
      // 같은 날짜의 같은 시간이면 제외
      if (date === currentDate && currentTime) {
        setEditBookedTimes(booked.filter((t: string) => t !== currentTime));
      } else {
        setEditBookedTimes(booked);
      }
    } catch (error) {
      console.error('예약 시간 조회 오류:', error);
      setEditBookedTimes([]);
    } finally {
      setLoadingEditBookedTimes(false);
    }
  };

  // 상태/일정 변경
  const handleStatusChange = async () => {
    if (!selectedConsultation) return;

    // 일정 변경 시 중복 체크
    if (newDate && newTime && editBookedTimes.includes(newTime)) {
      toast.error('해당 시간에 이미 상담이 예약되어 있습니다.');
      return;
    }

    setUpdating(true);
    try {
      const updateData: {
        status: ConsultationStatus;
        adminNotes: string;
        preferredDate?: string;
        preferredTime?: string;
      } = {
        status: newStatus,
        adminNotes
      };

      // 일정 변경이 있으면 추가
      if (newDate) {
        updateData.preferredDate = newDate;
      }
      if (newTime) {
        updateData.preferredTime = newTime;
      }

      await updateConsultation(selectedConsultation.id, updateData);
      toast.success(newDate || newTime ? '상담 정보가 수정되었습니다.' : '상태가 변경되었습니다.');
      setStatusModalOpen(false);
      setNewDate('');
      setNewTime('');
      loadData();
    } catch (error) {
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
    } catch (error) {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  // 날짜 변경 시 예약된 시간 조회
  const handleDateChange = async (date: string) => {
    setDirectForm({ ...directForm, preferredDate: date, preferredTime: '' });
    if (!date) {
      setBookedTimes([]);
      return;
    }

    setLoadingBookedTimes(true);
    try {
      const response = await getBookedTimes(date);
      setBookedTimes(response.bookedTimes || []);
    } catch (error) {
      console.error('예약 시간 조회 오류:', error);
      setBookedTimes([]);
    } finally {
      setLoadingBookedTimes(false);
    }
  };

  // 직접 등록
  const handleDirectRegister = async () => {
    if (!directForm.studentName || !directForm.phone || !directForm.grade ||
        !directForm.preferredDate || !directForm.preferredTime) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }

    // 관리자 직접 등록은 동시 상담 허용 (친구끼리 같이 상담 등)

    setRegistering(true);
    try {
      await createDirectConsultation(directForm);
      toast.success('상담이 등록되었습니다.');
      setDirectRegisterOpen(false);
      setDirectForm({
        studentName: '',
        phone: '',
        grade: '',
        preferredDate: '',
        preferredTime: '',
        notes: ''
      });
      setBookedTimes([]);
      loadData();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || '등록에 실패했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  // 체험 학생 등록
  const handleConvertToTrial = async () => {
    if (!selectedConsultation) return;

    // 검증
    if (!trialDates[0].date || !trialDates[0].timeSlot ||
        !trialDates[1].date || !trialDates[1].timeSlot) {
      toast.error('체험 일정 2개를 모두 선택해주세요.');
      return;
    }

    setConvertingToTrial(true);
    try {
      const result = await convertToTrialStudent(selectedConsultation.id, trialDates);
      toast.success('체험 학생으로 등록되었습니다.');
      setTrialModalOpen(false);
      setDetailOpen(false);
      setTrialDates([{ date: '', timeSlot: '' }, { date: '', timeSlot: '' }]);
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

  // 상태 배지
  const StatusBadge = ({ status }: { status: ConsultationStatus }) => (
    <Badge className={CONSULTATION_STATUS_COLORS[status]}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">상담 관리</h1>
          <p className="text-muted-foreground">상담 신청 내역을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDirectRegisterOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            직접 등록
          </Button>
          <Link href="/consultations/calendar">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              달력 보기
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              상담 설정
            </Button>
          </Link>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('')}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {Object.values(stats).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-sm text-muted-foreground">전체</p>
          </CardContent>
        </Card>
        {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
          <Card
            key={status}
            className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === status ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">{stats[status] || 0}</div>
              <p className="text-sm text-muted-foreground">{CONSULTATION_STATUS_LABELS[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="이름, 전화번호로 검색..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="상담 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
                <SelectItem value="new_registration">신규 등록</SelectItem>
                <SelectItem value="learning">학습 상담</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 목록 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              상담 신청이 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {consultations.map((c) => (
                <div
                  key={c.id}
                  className="p-4 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => openDetailModal(c)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{c.student_name}</span>
                        <span className="text-sm text-muted-foreground">{c.student_grade}</span>
                        <StatusBadge status={c.status} />
                        <Badge variant="outline">
                          {CONSULTATION_TYPE_LABELS[c.consultation_type]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {c.student_phone || c.parent_phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(parseISO(c.preferred_date), 'M/d (EEE)', { locale: ko })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {c.preferred_time.substring(0, 5)}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          openDetailModal(c);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          상세 보기
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConsultation(c);
                          setNewStatus(c.status);
                          setAdminNotes(c.admin_notes || '');
                          setStatusModalOpen(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          상태 변경
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>상담 신청 상세</DialogTitle>
          </DialogHeader>

          {selectedConsultation && (
            <div className="space-y-6 px-6 py-4">
              {/* 상태 */}
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedConsultation.status} />
                <Badge variant="outline">
                  {CONSULTATION_TYPE_LABELS[selectedConsultation.consultation_type]}
                </Badge>
                {selectedConsultation.linked_student_name && !selectedConsultation.linked_student_is_trial && (
                  <Badge variant="secondary" className="gap-1">
                    <Link2 className="h-3 w-3" />
                    기존 학생: {selectedConsultation.linked_student_name}
                  </Badge>
                )}
              </div>

              {/* 일정 */}
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">상담 일정</h4>
                <div className="flex items-center gap-4 text-blue-800 dark:text-blue-200">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(parseISO(selectedConsultation.preferred_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {selectedConsultation.preferred_time.substring(0, 5)}
                  </span>
                </div>
              </div>

              {/* 학생 정보 */}
              <div>
                <h4 className="font-medium text-foreground mb-2">학생 정보</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p className="text-foreground"><span className="text-muted-foreground">이름:</span> {selectedConsultation.student_name}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">연락처:</span> {selectedConsultation.student_phone || selectedConsultation.parent_phone}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">학년:</span> {selectedConsultation.student_grade}</p>
                  {selectedConsultation.student_school && (
                    <p className="text-foreground"><span className="text-muted-foreground">학교:</span> {selectedConsultation.student_school}</p>
                  )}
                </div>
              </div>

              {/* 성적 정보 - 실제 값이 있을 때만 표시 */}
              {selectedConsultation.academicScores && (() => {
                const scores = selectedConsultation.academicScores;

                // 새 구조: mockTestGrades, schoolGradeAvg, admissionType
                const hasMockGrades = scores.mockTestGrades &&
                  Object.values(scores.mockTestGrades).some(v => v !== null && v !== undefined && v !== -1);
                const hasSchoolGradeAvg = scores.schoolGradeAvg !== null &&
                  scores.schoolGradeAvg !== undefined && scores.schoolGradeAvg !== -1;
                const hasAdmissionType = scores.admissionType;

                // 어떤 성적 정보도 없으면 표시 안 함
                if (!hasMockGrades && !hasSchoolGradeAvg && !hasAdmissionType) return null;

                // 입시유형 한글 변환
                const admissionTypeLabel = scores.admissionType === 'early' ? '수시' :
                  scores.admissionType === 'regular' ? '정시' : scores.admissionType;

                // 등급 표시 함수 (-1이면 "미응시")
                const gradeDisplay = (value: number | undefined | null) => {
                  if (value === null || value === undefined) return '-';
                  if (value === -1) return '미응시';
                  return `${value}등급`;
                };

                return (
                  <div>
                    <h4 className="font-medium text-foreground mb-3">성적 정보</h4>
                    <div className="bg-muted rounded-lg p-4 space-y-4">
                      {/* 기본 정보: 내신 평균 + 입시 유형 */}
                      <div className="flex gap-6">
                        {hasSchoolGradeAvg && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">내신 평균</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{gradeDisplay(scores.schoolGradeAvg)}</span>
                          </div>
                        )}
                        {hasAdmissionType && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">입시 유형</span>
                            <span className="font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{admissionTypeLabel}</span>
                          </div>
                        )}
                      </div>

                      {/* 모의고사 등급 표 */}
                      {hasMockGrades && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">모의고사 등급</p>
                          <div className="grid grid-cols-4 gap-2">
                            {['korean', 'math', 'english', 'exploration'].map((subject) => {
                              const labels: Record<string, string> = {
                                korean: '국어',
                                math: '수학',
                                english: '영어',
                                exploration: '탐구'
                              };
                              const value = scores.mockTestGrades?.[subject as keyof typeof scores.mockTestGrades];
                              return (
                                <div key={subject} className="bg-card rounded-lg p-3 text-center border border-border">
                                  <div className="text-xs text-muted-foreground mb-1">{labels[subject]}</div>
                                  <div className={`font-bold text-lg ${value === -1 ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {value === -1 ? '-' : value ?? '-'}
                                  </div>
                                  {value !== -1 && value !== null && value !== undefined && (
                                    <div className="text-xs text-muted-foreground">등급</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 기타 정보 */}
              <div className="space-y-2 text-sm">
                {selectedConsultation.target_school && (
                  <p className="text-foreground"><span className="text-muted-foreground">목표 학교:</span> {selectedConsultation.target_school}</p>
                )}
                {selectedConsultation.referrer_student && (
                  <p className="text-foreground"><span className="text-muted-foreground">추천 원생:</span> {selectedConsultation.referrer_student}</p>
                )}
                {selectedConsultation.referralSources && selectedConsultation.referralSources.length > 0 && (
                  <p className="text-foreground"><span className="text-muted-foreground">알게 된 경로:</span> {selectedConsultation.referralSources.join(', ')}</p>
                )}
              </div>

              {/* 문의 내용 */}
              {selectedConsultation.inquiry_content && (
                <div>
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    문의 내용
                  </h4>
                  <p className="text-sm bg-muted rounded p-3 whitespace-pre-wrap text-foreground">
                    {selectedConsultation.inquiry_content}
                  </p>
                </div>
              )}

              {/* 관리자 메모 */}
              {selectedConsultation.admin_notes && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">관리자 메모</h4>
                  <p className="text-sm bg-yellow-50 dark:bg-yellow-950 rounded p-3 whitespace-pre-wrap text-foreground">
                    {selectedConsultation.admin_notes}
                  </p>
                </div>
              )}

              {/* 신청일 */}
              <p className="text-xs text-muted-foreground">
                신청일: {format(parseISO(selectedConsultation.created_at), 'yyyy-MM-dd HH:mm')}
              </p>

              {/* 상담 진행 섹션 - 모든 상태에서 표시 */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    상담 진행
                  </h4>
                  <Link href={`/consultations/${selectedConsultation.id}/conduct`}>
                    <Button size="sm" className="gap-2">
                      상담 진행 페이지로 이동
                    </Button>
                  </Link>
                </div>
              </div>

              {/* 체험 학생으로 등록된 경우 */}
              {selectedConsultation.linked_student_id && selectedConsultation.linked_student_is_trial && (
                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    체험 학생으로 등록 완료
                    {selectedConsultation.linked_student_name && (
                      <Badge variant="secondary">{selectedConsultation.linked_student_name}</Badge>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewStatus(selectedConsultation?.status || 'pending');
                setAdminNotes(selectedConsultation?.admin_notes || '');
                setStatusModalOpen(true);
                setDetailOpen(false);
              }}
            >
              상태 변경
            </Button>
            <Button onClick={() => setDetailOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상태/일정 변경 모달 */}
      <Dialog open={statusModalOpen} onOpenChange={(open) => {
        setStatusModalOpen(open);
        if (!open) {
          setNewDate('');
          setNewTime('');
          setEditBookedTimes([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>상담 정보 변경</DialogTitle>
            <DialogDescription>
              {selectedConsultation?.student_name}님의 상담 상태/일정을 변경합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {/* 현재 일정 표시 */}
            {selectedConsultation && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">현재 일정: </span>
                <span className="font-medium text-foreground">
                  {selectedConsultation.preferred_date} {selectedConsultation.preferred_time.substring(0, 5)}
                </span>
              </div>
            )}

            {/* 상태 */}
            <div>
              <Label>상태</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ConsultationStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder={CONSULTATION_STATUS_LABELS[newStatus]} />
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

            {/* 일정 변경 */}
            <div className="border-t border-border pt-4">
              <Label className="text-sm font-medium">일정 변경 (선택)</Label>
              <p className="text-xs text-muted-foreground mb-2">변경이 필요한 경우에만 선택하세요</p>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">날짜</Label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => handleEditDateChange(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {newDate && (
                  <div>
                    <Label className="text-xs">시간</Label>
                    {loadingEditBookedTimes ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        예약 현황 확인 중...
                      </div>
                    ) : editTimeOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {editTimeOptions.map((time) => {
                          const isBooked = editBookedTimes.includes(time);
                          const isSelected = newTime === time;
                          const isCurrent = selectedConsultation?.preferred_date === newDate &&
                            selectedConsultation?.preferred_time?.substring(0, 5) === time;
                          return (
                            <Button
                              key={time}
                              type="button"
                              size="sm"
                              variant={isSelected ? 'default' : isBooked ? 'secondary' : 'outline'}
                              onClick={() => setNewTime(time)}
                              className={`${isCurrent ? 'ring-2 ring-blue-300' : ''} ${isBooked ? 'border-orange-300 dark:border-orange-700' : ''}`}
                            >
                              {time}
                              {isBooked && <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">●</span>}
                              {isCurrent && <span className="ml-1 text-xs">(현재)</span>}
                            </Button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-orange-600 dark:text-orange-400 py-2">해당 요일은 휴무입니다</p>
                    )}
                    {editBookedTimes.length > 0 && editTimeOptions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        * <span className="text-orange-600 dark:text-orange-400">●</span> 표시: 기존 상담 있음 (동시 상담 가능)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 관리자 메모 */}
            <div>
              <Label>관리자 메모</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleStatusChange} disabled={updating}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상담 신청 삭제</DialogTitle>
            <DialogDescription>
              {selectedConsultation?.student_name}님의 상담 신청을 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 직접 등록 모달 */}
      <Dialog open={directRegisterOpen} onOpenChange={setDirectRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상담 직접 등록</DialogTitle>
            <DialogDescription>
              전화 상담 등 직접 예약을 잡아줄 때 사용합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>학생명 *</Label>
              <Input
                value={directForm.studentName}
                onChange={(e) => setDirectForm({ ...directForm, studentName: e.target.value })}
                placeholder="학생 이름"
              />
            </div>

            <div>
              <Label>전화번호 *</Label>
              <Input
                value={directForm.phone}
                onChange={(e) => setDirectForm({ ...directForm, phone: e.target.value })}
                placeholder="010-1234-5678"
              />
            </div>

            <div>
              <Label>학년 *</Label>
              <Select
                value={directForm.grade}
                onValueChange={(v) => setDirectForm({ ...directForm, grade: v })}
              >
                <SelectTrigger>
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
              <Label>상담 날짜 *</Label>
              <Input
                type="date"
                value={directForm.preferredDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <div>
              <Label>상담 시간 *</Label>
              {loadingBookedTimes ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  예약 현황 확인 중...
                </div>
              ) : directForm.preferredDate ? (
                <div className="space-y-2">
                  {/* 시간 버튼 */}
                  {timeOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {timeOptions.map((time) => {
                        const isBooked = bookedTimes.includes(time);
                        const isSelected = directForm.preferredTime === time;
                        return (
                          <Button
                            key={time}
                            type="button"
                            size="sm"
                            variant={isSelected ? 'default' : isBooked ? 'secondary' : 'outline'}
                            onClick={() => setDirectForm({ ...directForm, preferredTime: time })}
                            className={isBooked ? 'border-orange-300 dark:border-orange-700' : ''}
                          >
                            {time}
                            {isBooked && <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">●</span>}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-orange-600 dark:text-orange-400 py-2">해당 요일은 휴무입니다</p>
                  )}
                  {bookedTimes.length > 0 && timeOptions.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      * <span className="text-orange-600 dark:text-orange-400">●</span> 표시: 기존 상담 있음 (동시 상담 가능)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">날짜를 먼저 선택하세요</p>
              )}
            </div>

            <div>
              <Label>메모</Label>
              <Textarea
                value={directForm.notes}
                onChange={(e) => setDirectForm({ ...directForm, notes: e.target.value })}
                placeholder="메모 (선택)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDirectRegisterOpen(false)}>
              취소
            </Button>
            <Button onClick={handleDirectRegister} disabled={registering}>
              {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 체험 일정 선택 모달 */}
      <Dialog open={trialModalOpen} onOpenChange={setTrialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>체험 수업 일정 선택</DialogTitle>
            <DialogDescription>
              {selectedConsultation?.student_name}님의 체험 수업 일정 2회를 선택해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 첫 번째 체험일 */}
            <div className="space-y-3">
              <Label className="text-base font-medium">첫 번째 체험일</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">날짜</Label>
                  <Input
                    type="date"
                    value={trialDates[0].date}
                    onChange={(e) => {
                      const newDates = [...trialDates];
                      newDates[0].date = e.target.value;
                      setTrialDates(newDates);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-sm">시간대</Label>
                  <Select
                    value={trialDates[0].timeSlot}
                    onValueChange={(v) => {
                      const newDates = [...trialDates];
                      newDates[0].timeSlot = v;
                      setTrialDates(newDates);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="시간대 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">오전 (09:00~12:00)</SelectItem>
                      <SelectItem value="afternoon">오후 (13:00~17:00)</SelectItem>
                      <SelectItem value="evening">저녁 (18:00~21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 두 번째 체험일 */}
            <div className="space-y-3">
              <Label className="text-base font-medium">두 번째 체험일</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">날짜</Label>
                  <Input
                    type="date"
                    value={trialDates[1].date}
                    onChange={(e) => {
                      const newDates = [...trialDates];
                      newDates[1].date = e.target.value;
                      setTrialDates(newDates);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-sm">시간대</Label>
                  <Select
                    value={trialDates[1].timeSlot}
                    onValueChange={(v) => {
                      const newDates = [...trialDates];
                      newDates[1].timeSlot = v;
                      setTrialDates(newDates);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="시간대 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">오전 (09:00~12:00)</SelectItem>
                      <SelectItem value="afternoon">오후 (13:00~17:00)</SelectItem>
                      <SelectItem value="evening">저녁 (18:00~21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
              체험 학생으로 등록되면:
              <ul className="mt-1 ml-4 list-disc">
                <li>학생 관리에 체험생으로 추가됩니다</li>
                <li>출석 체크 시 체험 횟수가 차감됩니다</li>
                <li>2회 체험 후 정식 등록을 권유합니다</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleConvertToTrial} disabled={convertingToTrial}>
              {convertingToTrial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              체험 학생 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
