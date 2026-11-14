'use client';

/**
 * 태블릿 수업 관리 페이지
 * - PC 컴포넌트 재사용
 * - 태블릿에 최적화된 레이아웃
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, List, Loader2, ChevronLeft, ChevronRight, RefreshCw, UserCog } from 'lucide-react';
import { ScheduleCalendarV2 } from '@/components/schedules/schedule-calendar-v2';
import { ScheduleList } from '@/components/schedules/schedule-list';
import { TimeSlotDetailModal } from '@/components/schedules/time-slot-detail-modal';
import { InstructorScheduleModal } from '@/components/schedules/instructor-schedule-modal';
import { TabletScheduleError } from '@/features/tablet-schedule/tablet-schedule-error';
import { TabletScheduleOperations } from '@/features/tablet-schedule/tablet-schedule-operations';
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
  const { data: schedules = [], isLoading, isError, refetch } = useSchedules(filters);

  // 월별 강사 통계 조회
  const loadInstructorStats = useCallback(async () => {
    try {
      const response = await schedulesApi.getMonthlyInstructorStats(currentYear, currentMonth, { suppressErrorToast: true });
      setInstructorStats(response.schedules || {});
    } catch {
      setInstructorStats({});
    }
  }, [currentYear, currentMonth]);

  // 월별 상담 일정 조회
  const loadConsultations = useCallback(async () => {
    try {
      const { start, end } = getMonthRange(currentYear, currentMonth);
      const response = await getCalendarEvents(start, end, { suppressErrorToast: true });
      setConsultations(response.events || {});
    } catch {
      setConsultations({});
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

  const isToday = selectedDate === getToday();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">불러오는 중이에요</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return <TabletScheduleError onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="수업 관리"
        description="수업 일정 확인"
        actions={(
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
        )}
      />

      {/* 날짜 선택 */}
      <section className="flex items-center gap-3 rounded-2xl bg-card p-3" aria-label="날짜 선택">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="이전 날짜"
          onClick={() => {
            const date = new Date(selectedDate || getToday());
            date.setDate(date.getDate() - 1);
            setSelectedDate(date.toISOString().split('T')[0]);
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <button
          type="button"
          className="flex-1 rounded-xl py-2 text-center transition-colors hover:bg-muted active:bg-muted"
          onClick={() => setInstructorModalOpen(true)}
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              {selectedDate ? formatDate(selectedDate) : '날짜 선택'}
            </span>
            {isToday && <Badge variant="default">오늘</Badge>}
          </span>
          <span className="mt-1 flex items-center justify-center gap-1 text-[13px] text-muted-foreground">
            <UserCog className="h-3.5 w-3.5" />
            눌러서 강사 배정
          </span>
        </button>

        <Button
          variant="outline"
          size="icon-lg"
          aria-label="다음 날짜"
          onClick={() => {
            const date = new Date(selectedDate || getToday());
            date.setDate(date.getDate() + 1);
            setSelectedDate(date.toISOString().split('T')[0]);
          }}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </section>

      <TabletScheduleOperations
        dateLabel={selectedDate ? formatDate(selectedDate) : '날짜 선택'}
        isToday={isToday}
        schedules={selectedDateSchedules}
        totalStudents={totalStudents}
        onAssignInstructor={() => setInstructorModalOpen(true)}
      />

      {/* 탭 */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
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
        </TabsContent>

        {/* 목록 뷰 */}
        <TabsContent value="list">
          {selectedDateSchedules.length === 0 ? (
            <div className="rounded-2xl bg-card py-6">
              <EmptyState icon={Calendar} title="선택한 날짜에 수업이 없어요" />
            </div>
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
