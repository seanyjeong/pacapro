'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Phone,
  List, Loader2, ArrowLeft, Link2, MessageSquare, CheckSquare, Sparkles,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

import { getConsultations } from '@/lib/api/consultations';
import type { Consultation, ConsultationStatus, LearningType } from '@/lib/types/consultation';
import {
  CONSULTATION_TYPE_LABELS,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS,
  LEARNING_TYPE_LABELS
} from '@/lib/types/consultation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import apiClient from '@/lib/api/client';
import { Plus, UserCheck } from 'lucide-react';

export default function ConsultationCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedConsultations, setSelectedConsultations] = useState<Consultation[]>([]);
  const [dayListModalOpen, setDayListModalOpen] = useState(false);

  // 상담 상세 모달
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 재원생 상담 등록 모달
  const [learningModalOpen, setLearningModalOpen] = useState(false);
  const [learningModalDate, setLearningModalDate] = useState<Date | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [learningForm, setLearningForm] = useState({
    studentId: '',
    preferredTime: '10:00',
    learningType: 'regular' as LearningType,
    adminNotes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      // 현재 월의 시작과 끝 날짜
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const response = await getConsultations({
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        limit: 100
      });

      setConsultations(response.consultations);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  // 재원생 목록 로드
  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const response = await apiClient.get('/students', {
        params: { status: 'active', limit: 500 }
      }) as { data: { students: Array<{ id: number; name: string; grade: string }> } };
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('학생 목록 로드 오류:', error);
    } finally {
      setStudentsLoading(false);
    }
  };

  // 재원생 상담 등록 모달 열기
  const openLearningModal = (date: Date) => {
    setLearningModalDate(date);
    setLearningForm({
      studentId: '',
      preferredTime: '10:00',
      learningType: 'regular',
      adminNotes: ''
    });
    setLearningModalOpen(true);
    if (students.length === 0) {
      loadStudents();
    }
  };

  // 재원생 상담 등록 제출
  const handleLearningSubmit = async () => {
    if (!learningForm.studentId || !learningModalDate) {
      toast.error('학생을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/consultations/learning', {
        studentId: parseInt(learningForm.studentId),
        preferredDate: format(learningModalDate, 'yyyy-MM-dd'),
        preferredTime: learningForm.preferredTime,
        learningType: learningForm.learningType,
        adminNotes: learningForm.adminNotes || null
      });

      toast.success('재원생 상담이 등록되었습니다.');
      setLearningModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '상담 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 날짜별 상담 그룹화
  const getConsultationsForDate = (date: Date): Consultation[] => {
    return consultations.filter(c =>
      isSameDay(parseISO(c.preferred_date), date)
    );
  };

  // 달력 날짜 배열 생성
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 첫 주 시작 패딩
  const startPadding = monthStart.getDay();

  // 날짜 클릭 (해당 일자 상담 목록 모달)
  const handleDateClick = (date: Date) => {
    const dayConsultations = getConsultationsForDate(date);
    if (dayConsultations.length > 0) {
      setSelectedDate(date);
      setSelectedConsultations(dayConsultations);
      setDayListModalOpen(true);
    }
  };

  // 상담 카드 클릭 (상세 모달 열기)
  const openDetailModal = (c: Consultation) => {
    setSelectedConsultation(c);
    setDayListModalOpen(false);
    setDetailModalOpen(true);
  };

  // 상태 배지
  const StatusBadge = ({ status }: { status: ConsultationStatus }) => (
    <Badge className={`${CONSULTATION_STATUS_COLORS[status]} text-xs`}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );

  // 상태별 색상 점 (신규 상담)
  const getStatusDot = (status: ConsultationStatus, isLearning: boolean = false) => {
    if (isLearning) {
      // 재원생 상담은 초록 계열
      const colors: Record<ConsultationStatus, string> = {
        pending: 'bg-emerald-300',
        confirmed: 'bg-emerald-500',
        completed: 'bg-emerald-700',
        cancelled: 'bg-gray-400',
        no_show: 'bg-red-500'
      };
      return colors[status] || 'bg-emerald-400';
    }
    // 신규 상담은 파랑 계열
    const colors: Record<ConsultationStatus, string> = {
      pending: 'bg-yellow-400',
      confirmed: 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-gray-400',
      no_show: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-400';
  };

  // 상담 유형 표시 (재원생/신규)
  const getConsultationTypeIcon = (c: Consultation) => {
    if (c.consultation_type === 'learning') {
      return <UserCheck className="h-3 w-3 text-emerald-600" />;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/consultations">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              목록으로
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">상담 달력</h1>
            <p className="text-gray-500">월별 상담 일정을 확인합니다.</p>
          </div>
        </div>
        <Link href="/consultations">
          <Button variant="outline" className="gap-2">
            <List className="h-4 w-4" />
            목록 보기
          </Button>
        </Link>
      </div>

      {/* 월 네비게이션 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-xl">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                  <div
                    key={day}
                    className={`text-center py-2 text-sm font-medium ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 달력 그리드 */}
              <div className="grid grid-cols-7 gap-1">
                {/* 시작 패딩 */}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="min-h-[100px]" />
                ))}

                {/* 날짜들 */}
                {calendarDays.map((date) => {
                  const dayConsultations = getConsultationsForDate(date);
                  const isToday = isSameDay(date, new Date());
                  const dayOfWeek = date.getDay();
                  const newCount = dayConsultations.filter(c => c.consultation_type !== 'learning').length;
                  const learningCount = dayConsultations.filter(c => c.consultation_type === 'learning').length;

                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[100px] border rounded-lg p-1 transition-colors group relative ${
                        dayConsultations.length > 0 ? 'hover:bg-blue-50' : 'hover:bg-gray-50'
                      } ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div
                          className={`text-sm font-medium cursor-pointer ${
                            dayOfWeek === 0 ? 'text-red-500' :
                            dayOfWeek === 6 ? 'text-blue-500' :
                            'text-gray-700'
                          }`}
                          onClick={() => handleDateClick(date)}
                        >
                          {format(date, 'd')}
                        </div>
                        {/* 재원생 상담 추가 버튼 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openLearningModal(date); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-emerald-100"
                          title="재원생 상담 등록"
                        >
                          <Plus className="h-3.5 w-3.5 text-emerald-600" />
                        </button>
                      </div>

                      {/* 상담 목록 */}
                      <div className="space-y-1 cursor-pointer" onClick={() => handleDateClick(date)}>
                        {dayConsultations.slice(0, 3).map((c) => {
                          const isDone = ['completed', 'cancelled', 'no_show'].includes(c.status);
                          const isLearning = c.consultation_type === 'learning';
                          return (
                            <div
                              key={c.id}
                              className={`flex items-center gap-1 text-xs truncate ${isDone ? 'opacity-60' : ''}`}
                            >
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(c.status, isLearning)}`} />
                              {isLearning && <UserCheck className="h-2.5 w-2.5 text-emerald-600 flex-shrink-0" />}
                              <span className={`truncate ${isDone ? 'line-through text-gray-400' : ''}`}>
                                {c.student_name}
                              </span>
                            </div>
                          );
                        })}
                        {dayConsultations.length > 3 && (
                          <div className="text-xs text-gray-500 pl-3">
                            +{dayConsultations.length - 3}건 더
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 범례 */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t justify-center">
                <div className="flex items-center gap-3 text-xs border-r pr-4">
                  <span className="text-gray-500 font-medium">신규:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span>대기</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>확정</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs border-r pr-4">
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    재원생:
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-300" />
                    <span>대기</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>확정</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>완료</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span>취소</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>노쇼</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 날짜별 상담 목록 모달 */}
      <Dialog open={dayListModalOpen} onOpenChange={setDayListModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              {selectedDate && format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              <Badge variant="secondary" className="ml-2">{selectedConsultations.length}건</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 px-6">
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
              {/* 시간대별 그룹핑 */}
              {(() => {
                const sorted = [...selectedConsultations].sort((a, b) =>
                  a.preferred_time.localeCompare(b.preferred_time)
                );

                // 시간대별로 그룹핑
                const grouped: Record<string, typeof sorted> = {};
                sorted.forEach(c => {
                  const hour = c.preferred_time.substring(0, 2);
                  const timeLabel = `${hour}:00`;
                  if (!grouped[timeLabel]) {
                    grouped[timeLabel] = [];
                  }
                  grouped[timeLabel].push(c);
                });

                return Object.entries(grouped).map(([time, consultations]) => (
                  <div key={time} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-blue-700">{time}</span>
                      </div>
                      <div className="flex-1 border-t border-gray-200" />
                    </div>
                    <div className="space-y-2 pl-2">
                      {consultations.map((c) => {
                        const isDone = ['completed', 'cancelled', 'no_show'].includes(c.status);
                        const isLearning = c.consultation_type === 'learning';
                        return (
                          <div
                            key={c.id}
                            onClick={() => openDetailModal(c)}
                            className="cursor-pointer"
                          >
                            <Card className={`hover:shadow-md transition-all cursor-pointer ${
                              isLearning
                                ? 'hover:border-emerald-300 hover:bg-emerald-50/30 border-l-2 border-l-emerald-500'
                                : 'hover:border-blue-300 hover:bg-blue-50/30'
                            } ${isDone ? 'opacity-60' : ''}`}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(c.status, isLearning)}`} />
                                    {isLearning && <UserCheck className="h-3.5 w-3.5 text-emerald-600" />}
                                    <span className={`font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                      {c.student_name}
                                    </span>
                                    <span className="text-sm text-gray-500">{c.student_grade}</span>
                                    <StatusBadge status={c.status} />
                                    {isLearning && c.learning_type && (
                                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-xs">
                                        {LEARNING_TYPE_LABELS[c.learning_type]}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5" />
                                    {c.student_phone || c.parent_phone}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDayListModalOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상담 상세 모달 */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>상담 신청 상세</DialogTitle>
          </DialogHeader>

          {selectedConsultation && (
            <div className="space-y-6 px-6 py-4">
              {/* 상태 */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selectedConsultation.status} />
                <Badge variant="outline" className={selectedConsultation.consultation_type === 'learning' ? 'text-emerald-700 border-emerald-300' : ''}>
                  {CONSULTATION_TYPE_LABELS[selectedConsultation.consultation_type]}
                </Badge>
                {selectedConsultation.consultation_type === 'learning' && selectedConsultation.learning_type && (
                  <Badge className="bg-emerald-100 text-emerald-800">
                    {LEARNING_TYPE_LABELS[selectedConsultation.learning_type]}
                  </Badge>
                )}
                {selectedConsultation.linked_student_name && !selectedConsultation.linked_student_is_trial && (
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
                    <CalendarIcon className="h-4 w-4" />
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
                <h4 className="font-medium mb-2">학생 정보</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p><span className="text-gray-500">이름:</span> {selectedConsultation.student_name}</p>
                  <p><span className="text-gray-500">연락처:</span> {selectedConsultation.student_phone || selectedConsultation.parent_phone}</p>
                  <p><span className="text-gray-500">학년:</span> {selectedConsultation.student_grade}</p>
                  {selectedConsultation.student_school && (
                    <p><span className="text-gray-500">학교:</span> {selectedConsultation.student_school}</p>
                  )}
                </div>
              </div>

              {/* 성적 정보 */}
              {selectedConsultation.academicScores && (() => {
                const scores = selectedConsultation.academicScores;
                const hasMockGrades = scores.mockTestGrades &&
                  Object.values(scores.mockTestGrades).some(v => v !== null && v !== undefined && v !== -1);
                const hasSchoolGradeAvg = scores.schoolGradeAvg !== null &&
                  scores.schoolGradeAvg !== undefined && scores.schoolGradeAvg !== -1;
                const hasAdmissionType = scores.admissionType;

                if (!hasMockGrades && !hasSchoolGradeAvg && !hasAdmissionType) return null;

                const admissionTypeLabel = scores.admissionType === 'early' ? '수시' :
                  scores.admissionType === 'regular' ? '정시' : scores.admissionType;

                const gradeDisplay = (value: number | undefined | null) => {
                  if (value === null || value === undefined) return '-';
                  if (value === -1) return '미응시';
                  return `${value}등급`;
                };

                return (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      성적 정보
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      <div className="flex gap-6">
                        {hasSchoolGradeAvg && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">내신 평균</span>
                            <span className="font-semibold text-blue-600">{gradeDisplay(scores.schoolGradeAvg)}</span>
                          </div>
                        )}
                        {hasAdmissionType && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">입시 유형</span>
                            <span className="font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{admissionTypeLabel}</span>
                          </div>
                        )}
                      </div>
                      {hasMockGrades && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">모의고사 등급</p>
                          <div className="grid grid-cols-4 gap-2">
                            {['korean', 'math', 'english', 'exploration'].map((subject) => {
                              const labels: Record<string, string> = {
                                korean: '국어', math: '수학', english: '영어', exploration: '탐구'
                              };
                              const value = scores.mockTestGrades?.[subject as keyof typeof scores.mockTestGrades];
                              return (
                                <div key={subject} className="bg-white rounded-lg p-3 text-center border">
                                  <div className="text-xs text-gray-500 mb-1">{labels[subject]}</div>
                                  <div className={`font-bold text-lg ${value === -1 ? 'text-gray-400' : 'text-gray-800'}`}>
                                    {value === -1 ? '-' : value ?? '-'}
                                  </div>
                                  {value !== -1 && value !== null && value !== undefined && (
                                    <div className="text-xs text-gray-400">등급</div>
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
                <div className="bg-green-50 rounded-lg p-4">
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
            <Button variant="outline" onClick={() => {
              setDetailModalOpen(false);
              setDayListModalOpen(true);
            }}>
              목록으로
            </Button>
            <Button onClick={() => setDetailModalOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 재원생 상담 등록 모달 */}
      <Dialog open={learningModalOpen} onOpenChange={setLearningModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              재원생 상담 등록
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 px-6 space-y-4">
            {/* 날짜 표시 */}
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-sm text-emerald-800 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {learningModalDate && format(learningModalDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </p>
            </div>

            {/* 학생 선택 */}
            <div className="space-y-2">
              <Label>학생 선택 *</Label>
              {studentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  학생 목록 로딩중...
                </div>
              ) : (
                <Select
                  value={learningForm.studentId}
                  onValueChange={(v) => setLearningForm(prev => ({ ...prev, studentId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="학생을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name} ({s.grade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 상담 시간 */}
            <div className="space-y-2">
              <Label>상담 시간 *</Label>
              <Select
                value={learningForm.preferredTime}
                onValueChange={(v) => setLearningForm(prev => ({ ...prev, preferredTime: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 9).map((hour) => (
                    <SelectItem key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                      {hour.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 상담 유형 */}
            <div className="space-y-2">
              <Label>상담 유형 *</Label>
              <Select
                value={learningForm.learningType}
                onValueChange={(v) => setLearningForm(prev => ({ ...prev, learningType: v as LearningType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEARNING_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Input
                placeholder="상담 메모를 입력하세요"
                value={learningForm.adminNotes}
                onChange={(e) => setLearningForm(prev => ({ ...prev, adminNotes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLearningModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleLearningSubmit}
              disabled={submitting || !learningForm.studentId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  등록중...
                </>
              ) : (
                '등록'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
