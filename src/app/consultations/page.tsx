'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, Clock, User, Phone, Search, Filter, Settings,
  ChevronDown, ChevronRight, Eye, Edit, Trash2, Link2,
  MessageSquare, MoreHorizontal, Loader2, RefreshCw
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

import { getConsultations, updateConsultation, deleteConsultation } from '@/lib/api/consultations';
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
        <Link href="/consultations/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            상담 설정
          </Button>
        </Link>
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
                  onClick={() => {
                    setSelectedConsultation(c);
                    setDetailOpen(true);
                  }}
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
                          setSelectedConsultation(c);
                          setDetailOpen(true);
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
    </div>
  );
}
