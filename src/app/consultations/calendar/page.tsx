'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Phone,
  List, Loader2, ArrowLeft
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
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS
} from '@/lib/types/consultation';

export default function ConsultationCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedConsultations, setSelectedConsultations] = useState<Consultation[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

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

  // 날짜 클릭
  const handleDateClick = (date: Date) => {
    const dayConsultations = getConsultationsForDate(date);
    if (dayConsultations.length > 0) {
      setSelectedDate(date);
      setSelectedConsultations(dayConsultations);
      setDetailModalOpen(true);
    }
  };

  // 상태 배지
  const StatusBadge = ({ status }: { status: ConsultationStatus }) => (
    <Badge className={`${CONSULTATION_STATUS_COLORS[status]} text-xs`}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );

  // 상태별 색상 점
  const getStatusDot = (status: ConsultationStatus) => {
    const colors: Record<ConsultationStatus, string> = {
      pending: 'bg-yellow-400',
      confirmed: 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-gray-400',
      no_show: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-400';
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

                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[100px] border rounded-lg p-1 cursor-pointer transition-colors ${
                        dayConsultations.length > 0 ? 'hover:bg-blue-50' : 'hover:bg-gray-50'
                      } ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                      onClick={() => handleDateClick(date)}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        dayOfWeek === 0 ? 'text-red-500' :
                        dayOfWeek === 6 ? 'text-blue-500' :
                        'text-gray-700'
                      }`}>
                        {format(date, 'd')}
                      </div>

                      {/* 상담 목록 */}
                      <div className="space-y-1">
                        {dayConsultations.slice(0, 3).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-1 text-xs truncate"
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(c.status)}`} />
                            <span className="truncate">{c.student_name}</span>
                          </div>
                        ))}
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
              <div className="flex items-center gap-4 mt-4 pt-4 border-t justify-center">
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span>대기중</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>확정</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>완료</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span>취소</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>노쇼</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 날짜별 상담 상세 모달 */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
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
                      {consultations.map((c) => (
                        <Link
                          key={c.id}
                          href={`/consultations/${c.id}/conduct`}
                          className="block"
                          onClick={() => setDetailModalOpen(false)}
                        >
                          <Card className="hover:shadow-md transition-all cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(c.status)}`} />
                                  <span className="font-medium text-gray-900">{c.student_name}</span>
                                  <span className="text-sm text-gray-500">{c.student_grade}</span>
                                  <StatusBadge status={c.status} />
                                </div>
                                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5" />
                                  {c.student_phone || c.parent_phone}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
