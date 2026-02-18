'use client';

/**
 * 태블릿 수업 관리 페이지
 * - PC 컴포넌트 재사용
 * - 태블릿에 최적화된 레이아웃
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, List, Loader2, ChevronLeft, ChevronRight, Users, Clock, UserCheck, AlertCircle, UserCog } from 'lucide-react';
import { ScheduleCalendarV2 } from '@/components/schedules/schedule-calendar-v2';
import { ScheduleList } from '@/components/schedules/schedule-list';
import { TimeSlotDetailModal } from '@/components/schedules/time-slot-detail-modal';
import { InstructorScheduleModal } from '@/components/schedules/instructor-schedule-modal';
import { useSchedules } from '@/hooks/use-schedules';
import { schedulesApi, type DailyInstructorStats } from '@/lib/api/schedules';
import { getCalendarEvents } from '@/lib/api/consultations';
import type { ScheduleFilters, TimeSlot } from '@/lib/types/schedule';
import type { Consultation } from '@/lib/types/consultation';
import { getMonthRange, getToday } from '@/lib/utils/schedule-helpers';

export default function TabletSchedulePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(getToday());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [filters, setFilters] = useState<ScheduleFilters>(() => {
    const { start, end } = getMonthRange(
      new Date().getFullYear(),
      new Date().getMonth()
    );
    return { start_date: start, end_date: end };
  });

  // 타임슬롯 상세 모달
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; slot: TimeSlot } | null>(null);

  // 강사 배정 모달
  const [instructorModalOpen, setInstructorModalOpen] = useState(false);

  // 캘린더 강사 통계
  const [instructorStats, setInstructorStats] = useState<Record<string, DailyInstructorStats>>({});

  // 상담 일정
  const [consultations, setConsultations] = useState<Record<string, Consultation[]>>({});

  // 데이터 조회
  const { data: schedules = [], isLoading, refetch } = useSchedules(filters);

  // 월별 강사 통계 조회
  const loadInstructorStats = useCallback(async () => {
    try {
      const response = await schedulesApi.getMonthlyInstructorStats(currentYear, currentMonth);
      setInstructorStats(response.schedules || {});
    } catch (err) {
      console.error('Failed to load instructor stats:', err);
    }
  }, [currentYear, currentMonth]);

  // 월별 상담 일정 조회
  const loadConsultations = useCallback(async () => {
    try {
      const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const events = await getCalendarEvents(yearMonth);
      const grouped: Record<string, Consultation[]> = {};
      events.forEach(evt => {
        const date = (evt as { date?: string }).date || '';
        if (date) {
          if (!grouped[date]) grouped[date] = [];
          grouped[date].push(evt as unknown as Consultation);
        }
      });
      setConsultations(grouped);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    loadInstructorStats();
    loadConsultations();
  }, [loadInstructorStats, loadConsultations]);

  // 선택된 날짜의 수업 필터링
  const selectedDateSchedules = useMemo(() => {
    if (!selectedDate) return schedules;
    return schedules.filter((schedule) => schedule.class_date === selectedDate);
  }, [schedules, selectedDate]);

  // 월 변경 핸들러
  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    const { start, end } = getMonthRange(year, month);
    setFilters((prev) => ({ ...prev, start_date: start, end_date: end }));
  };

  // 수업 클릭 핸들러
  const handleScheduleClick = (scheduleId: number) => {
    router.push(`/schedules/${scheduleId}`);
  };

  // 타임슬롯 클릭 핸들러
  const handleSlotClick = (date: string, slot: TimeSlot) => {
    setSelectedSlot({ date, slot });
    setSlotModalOpen(true);
  };

  // 통계 계산
  const totalStudents = useMemo(() => {
    return selectedDateSchedules.reduce((sum, s) => sum + (s.student_count || 0), 0);
  }, [selectedDateSchedules]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">수업 관리</h1>
          <p className="text-muted-foreground">수업 일정 확인</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          새로고침
        </Button>
      </div>

      {/* 날짜 선택 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const date = new Date(selectedDate || getToday());
                date.setDate(date.getDate() - 1);
                setSelectedDate(date.toISOString().split('T')[0]);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <button
              className="text-center flex-1 mx-4 py-2 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
              onClick={() => setInstructorModalOpen(true)}
            >
              <p className="text-lg font-bold text-foreground">
                {selectedDate ? formatDate(selectedDate) : '날짜 선택'}
              </p>
              {isToday && (
                <Badge variant="secondary" className="mt-1">오늘</Badge>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <UserCog className="h-3 w-3" />
                탭하여 강사 배정
              </p>
            </button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const date = new Date(selectedDate || getToday());
                date.setDate(date.getDate() + 1);
                setSelectedDate(date.toISOString().split('T')[0]);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">수업 수</p>
                <p className="text-xl font-bold text-foreground">{selectedDateSchedules.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 학생</p>
                <p className="text-xl font-bold text-foreground">{totalStudents}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            캘린더
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            목록
          </TabsTrigger>
        </TabsList>

        {/* 캘린더 뷰 */}
        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-4">
              <ScheduleCalendarV2
                schedules={schedules}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onMonthChange={handleMonthChange}
                onSlotClick={handleSlotClick}
                instructorStats={instructorStats}
                consultations={consultations}
                currentYear={currentYear}
                currentMonth={currentMonth}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 목록 뷰 */}
        <TabsContent value="list">
          {selectedDateSchedules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">선택한 날짜에 수업이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            <ScheduleList
              schedules={selectedDateSchedules}
              onScheduleClick={(schedule) => handleScheduleClick(schedule.id)}
              emptyMessage="수업이 없습니다."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* 타임슬롯 상세 모달 */}
      <TimeSlotDetailModal
        open={slotModalOpen}
        date={selectedSlot?.date || null}
        timeSlot={selectedSlot?.slot || null}
        onClose={() => {
          setSlotModalOpen(false);
          setSelectedSlot(null);
        }}
        onStudentMoved={() => refetch()}
      />

      {/* 강사 배정 모달 */}
      <InstructorScheduleModal
        open={instructorModalOpen}
        date={selectedDate}
        onClose={() => setInstructorModalOpen(false)}
        onSave={() => {
          loadInstructorStats();
          refetch();
        }}
      />
    </div>
  );
}
