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
  createDirectConsultation, convertToTrialStudent, getBookedTimes
} from '@/lib/api/consultations';
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

  // 자주 쓰는 상담 시간 프리셋
  const TIME_PRESETS = [
    '09:00', '10:00', '11:00',
    '14:00', '15:00', '16:00',
    '17:00', '18:00', '19:00'
  ];

  // 상담 진행 상태
  const [conductMode, setConductMode] = useState(false);
  const [checklist, setChecklist] = useState<{ id: number; text: string; checked: boolean }[]>([
    { id: 1, text: '학생 현재 상태 파악 (성적, 목표)', checked: false },
    { id: 2, text: '학원 커리큘럼 설명', checked: false },
    { id: 3, text: '수업료 및 시간표 안내', checked: false },
    { id: 4, text: '체험 수업 일정 확정', checked: false },
    { id: 5, text: '질의응답', checked: false },
  ]);
  const [consultationMemo, setConsultationMemo] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

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

  // 상태 변경
  const handleStatusChange = async () => {
    if (!selectedConsultation) return;

    setUpdating(true);
    try {
      await updateConsultation(selectedConsultation.id, {
        status: newStatus,
        adminNotes
      });
      toast.success('상태가 변경되었습니다.');
      setStatusModalOpen(false);
      loadData();
    } catch (error) {
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

    // 이미 예약된 시간인지 확인
    if (bookedTimes.includes(directForm.preferredTime)) {
      toast.error('해당 시간에 이미 상담이 예약되어 있습니다.');
      return;
    }

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

  // 체크리스트 토글
  const toggleChecklistItem = (id: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  // 상담 진행 상태 저장
  const saveConsultationProgress = async () => {
    if (!selectedConsultation) return;

    setSavingProgress(true);
    try {
      await updateConsultation(selectedConsultation.id, {
        checklist,
        consultationMemo
      });
      toast.success('저장되었습니다.');
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSavingProgress(false);
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

  // 상담 상세 열 때 체크리스트/메모 초기화
  const openDetailModal = (c: Consultation) => {
    setSelectedConsultation(c);
    // 기존 체크리스트/메모가 있으면 로드
    if (c.checklist && Array.isArray(c.checklist) && c.checklist.length > 0) {
      setChecklist(c.checklist);
    } else {
      setChecklist([
        { id: 1, text: '학생 현재 상태 파악 (성적, 목표)', checked: false },
        { id: 2, text: '학원 커리큘럼 설명', checked: false },
        { id: 3, text: '수업료 및 시간표 안내', checked: false },
        { id: 4, text: '체험 수업 일정 확정', checked: false },
        { id: 5, text: '질의응답', checked: false },
      ]);
    }
    setConsultationMemo(c.consultation_memo || '');
    setConductMode(false);
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
          <h1 className="text-2xl font-bold">상담 관리</h1>
          <p className="text-gray-500">상담 신청 내역을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDirectRegisterOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            직접 등록
          </Button>
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
            <p className="text-sm text-gray-500">전체</p>
          </CardContent>
        </Card>
        {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
          <Card
            key={status}
            className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === status ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats[status] || 0}</div>
              <p className="text-sm text-gray-500">{CONSULTATION_STATUS_LABELS[status]}</p>
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
            <div className="text-center py-16 text-gray-500">
              상담 신청이 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {consultations.map((c) => (
                <div
                  key={c.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openDetailModal(c)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.student_name}</span>
                        <span className="text-sm text-gray-500">{c.student_grade}</span>
                        <StatusBadge status={c.status} />
                        <Badge variant="outline">
                          {CONSULTATION_TYPE_LABELS[c.consultation_type]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {c.parent_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {c.parent_phone}
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
                {selectedConsultation.linked_student_name && (
                  <Badge variant="secondary" className="gap-1">
                    <Link2 className="h-3 w-3" />
                    기존 학생: {selectedConsultation.linked_student_name}
                  </Badge>
                )}
              </div>

              {/* 일정 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">상담 일정</h4>
                <div className="flex items-center gap-4 text-blue-800">
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

              {/* 학부모/학생 정보 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">학부모 정보</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">이름:</span> {selectedConsultation.parent_name}</p>
                    <p><span className="text-gray-500">연락처:</span> {selectedConsultation.parent_phone}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">학생 정보</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">이름:</span> {selectedConsultation.student_name}</p>
                    <p><span className="text-gray-500">학년:</span> {selectedConsultation.student_grade}</p>
                    {selectedConsultation.student_school && (
                      <p><span className="text-gray-500">학교:</span> {selectedConsultation.student_school}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 성적 정보 */}
              {selectedConsultation.academicScores && (
                <div>
                  <h4 className="font-medium mb-2">성적 정보</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {selectedConsultation.academicScores.school_grades && Object.keys(selectedConsultation.academicScores.school_grades).length > 0 && (
                      <div className="bg-gray-50 rounded p-3">
                        <p className="font-medium text-gray-700 mb-1">내신 등급</p>
                        {Object.entries(selectedConsultation.academicScores.school_grades).map(([key, value]) => (
                          value && (
                            <p key={key}>
                              {key === 'korean' ? '국어' : key === 'math' ? '수학' : key === 'english' ? '영어' : '탐구'}: {value}등급
                            </p>
                          )
                        ))}
                      </div>
                    )}
                    {selectedConsultation.academicScores.mock_exam_grades && Object.keys(selectedConsultation.academicScores.mock_exam_grades).length > 0 && (
                      <div className="bg-gray-50 rounded p-3">
                        <p className="font-medium text-gray-700 mb-1">모의고사 등급</p>
                        {Object.entries(selectedConsultation.academicScores.mock_exam_grades).map(([key, value]) => (
                          value && (
                            <p key={key}>
                              {key === 'korean' ? '국어' : key === 'math' ? '수학' : key === 'english' ? '영어' : '탐구'}: {value}등급
                            </p>
                          )
                        ))}
                      </div>
                    )}
                    {selectedConsultation.academicScores.percentiles && Object.keys(selectedConsultation.academicScores.percentiles).length > 0 && (
                      <div className="bg-gray-50 rounded p-3">
                        <p className="font-medium text-gray-700 mb-1">백분위</p>
                        {Object.entries(selectedConsultation.academicScores.percentiles).map(([key, value]) => (
                          value && (
                            <p key={key}>
                              {key === 'korean' ? '국어' : key === 'math' ? '수학' : key === 'english' ? '영어' : '탐구'}: {value}%
                            </p>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 기타 정보 */}
              <div className="space-y-2 text-sm">
                {selectedConsultation.target_school && (
                  <p><span className="text-gray-500">목표 학교:</span> {selectedConsultation.target_school}</p>
                )}
                {selectedConsultation.referrer_student && (
                  <p><span className="text-gray-500">추천 원생:</span> {selectedConsultation.referrer_student}</p>
                )}
                {selectedConsultation.referralSources && selectedConsultation.referralSources.length > 0 && (
                  <p><span className="text-gray-500">알게 된 경로:</span> {selectedConsultation.referralSources.join(', ')}</p>
                )}
              </div>

              {/* 문의 내용 */}
              {selectedConsultation.inquiry_content && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    문의 내용
                  </h4>
                  <p className="text-sm bg-gray-50 rounded p-3 whitespace-pre-wrap">
                    {selectedConsultation.inquiry_content}
                  </p>
                </div>
              )}

              {/* 관리자 메모 */}
              {selectedConsultation.admin_notes && (
                <div>
                  <h4 className="font-medium mb-2">관리자 메모</h4>
                  <p className="text-sm bg-yellow-50 rounded p-3 whitespace-pre-wrap">
                    {selectedConsultation.admin_notes}
                  </p>
                </div>
              )}

              {/* 신청일 */}
              <p className="text-xs text-gray-400">
                신청일: {format(parseISO(selectedConsultation.created_at), 'yyyy-MM-dd HH:mm')}
              </p>

              {/* 상담 진행 섹션 */}
              {(selectedConsultation.status === 'confirmed' || selectedConsultation.status === 'pending') && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      상담 진행
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConductMode(!conductMode)}
                    >
                      {conductMode ? '접기' : '펼치기'}
                    </Button>
                  </div>

                  {conductMode && (
                    <div className="space-y-4">
                      {/* 체크리스트 */}
                      <div className="space-y-2">
                        {checklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleChecklistItem(item.id)}
                          >
                            {item.checked ? (
                              <CheckSquare className="h-5 w-5 text-green-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                            <span className={item.checked ? 'text-gray-500 line-through' : ''}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 상담 메모 */}
                      <div>
                        <Label>상담 메모</Label>
                        <Textarea
                          value={consultationMemo}
                          onChange={(e) => setConsultationMemo(e.target.value)}
                          placeholder="상담 중 메모를 작성하세요..."
                          rows={3}
                        />
                      </div>

                      {/* 저장 버튼 */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={saveConsultationProgress}
                          disabled={savingProgress}
                        >
                          {savingProgress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          저장
                        </Button>
                        <Button
                          onClick={() => {
                            setTrialModalOpen(true);
                          }}
                          className="gap-2"
                          disabled={!!selectedConsultation.linked_student_id}
                        >
                          <Sparkles className="h-4 w-4" />
                          상담 완료 → 체험 등록
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 이미 체험 학생으로 등록된 경우 */}
              {selectedConsultation.linked_student_id && (
                <div className="bg-green-50 rounded-lg p-4 mt-4">
                  <p className="text-green-800 flex items-center gap-2">
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

      {/* 상태 변경 모달 */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상태 변경</DialogTitle>
            <DialogDescription>
              {selectedConsultation?.student_name}님의 상담 상태를 변경합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
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

            <div>
              <Label>관리자 메모</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={3}
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
                <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  예약 현황 확인 중...
                </div>
              ) : directForm.preferredDate ? (
                <div className="space-y-2">
                  {/* 시간 프리셋 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    {TIME_PRESETS.map((time) => {
                      const isBooked = bookedTimes.includes(time);
                      const isSelected = directForm.preferredTime === time;
                      return (
                        <Button
                          key={time}
                          type="button"
                          size="sm"
                          variant={isSelected ? 'default' : isBooked ? 'outline' : 'secondary'}
                          disabled={isBooked}
                          onClick={() => setDirectForm({ ...directForm, preferredTime: time })}
                          className={isBooked ? 'opacity-50 line-through' : ''}
                        >
                          {time}
                        </Button>
                      );
                    })}
                  </div>
                  {/* 직접 입력 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">또는 직접 입력:</span>
                    <Input
                      type="time"
                      value={directForm.preferredTime}
                      onChange={(e) => setDirectForm({ ...directForm, preferredTime: e.target.value })}
                      className="w-32"
                    />
                  </div>
                  {bookedTimes.length > 0 && (
                    <p className="text-xs text-gray-500">
                      * 흐린 시간은 이미 예약됨
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-2">날짜를 먼저 선택하세요</p>
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

            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
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
