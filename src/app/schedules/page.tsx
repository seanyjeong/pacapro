'use client';

/**
 * 수업 목록/캘린더 페이지
 * - 모든 날에 오전/오후/저녁 슬롯 표시
 * - 학생 타임 이동 기능
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, List, Loader2, CalendarPlus, UserCheck, UserCog, Bell, PhoneCall, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { ScheduleCalendarV2 } from '@/components/schedules/schedule-calendar-v2';
import { ScheduleList } from '@/components/schedules/schedule-list';
import { BulkScheduleModal } from '@/components/schedules/bulk-schedule-modal';
import { InstructorAttendanceModal } from '@/components/schedules/instructor-attendance-modal';
import { TimeSlotDetailModal } from '@/components/schedules/time-slot-detail-modal';
import { InstructorSchedulePanel } from '@/components/schedules/instructor-schedule-panel';
import { ExtraDayRequestModal } from '@/components/schedules/extra-day-request-modal';
import { PendingApprovalsModal } from '@/components/schedules/pending-approvals-modal';
import { useSchedules, useDeleteSchedule } from '@/hooks/use-schedules';
import { instructorsAPI } from '@/lib/api/instructors';
import { schedulesApi, type DailyInstructorStats } from '@/lib/api/schedules';
import { getCalendarEvents } from '@/lib/api/consultations';
import type { ScheduleFilters, ClassSchedule, TimeSlot } from '@/lib/types/schedule';
import type { Consultation } from '@/lib/types/consultation';
import { getMonthRange, getToday } from '@/lib/utils/schedule-helpers';
import { toast } from 'sonner';
import { canView, canEdit } from '@/lib/utils/permissions';

export default function SchedulesPage() {
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

  // Modal states
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [instructorAttendanceModalOpen, setInstructorAttendanceModalOpen] = useState(false);

  // 타임슬롯 상세 모달
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; slot: TimeSlot } | null>(null);

  // 미배정 출근 요청/승인 모달
  const [extraDayModalOpen, setExtraDayModalOpen] = useState(false);
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // 캘린더 강사 통계
  const [instructorStats, setInstructorStats] = useState<Record<string, DailyInstructorStats>>({});

  // 상담 일정
  const [consultations, setConsultations] = useState<Record<string, Consultation[]>>({});

  // 권한 체크 (클라이언트에서만 체크하여 hydration 불일치 방지)
  const [canViewOvertimeApproval, setCanViewOvertimeApproval] = useState(false);
  const [canEditSchedules, setCanEditSchedules] = useState(false);

  // 강사 근무 배정 패널 펼침 상태
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  useEffect(() => {
    setCanViewOvertimeApproval(canView('overtime_approval'));
    setCanEditSchedules(canEdit('schedules'));
    // localStorage에서 패널 상태 복원
    const savedPanelState = localStorage.getItem('instructor_panel_expanded');
    if (savedPanelState !== null) {
      setIsPanelExpanded(savedPanelState === 'true');
    }
  }, []);

  const togglePanel = () => {
    setIsPanelExpanded(prev => {
      const newState = !prev;
      localStorage.setItem('instructor_panel_expanded', String(newState));
      return newState;
    });
  };

  // 데이터 조회
  const { data: schedules = [], isLoading, refetch } = useSchedules(filters);
  const deleteSchedule = useDeleteSchedule();

  // 대기 중인 승인 요청 수 조회 (초과근무 승인 권한이 있을 때만)
  useEffect(() => {
    if (!canViewOvertimeApproval) return;

    const loadPendingCount = async () => {
      try {
        const response = await instructorsAPI.getPendingOvertimes();
        setPendingCount(response.requests?.length || 0);
      } catch (err) {
        console.error('Failed to load pending count:', err);
      }
    };
    loadPendingCount();
  }, [canViewOvertimeApproval]);

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
      const { start, end } = getMonthRange(currentYear, currentMonth);
      const response = await getCalendarEvents(start, end);
      setConsultations(response.events || {});
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

  // 수업 수정 핸들러
  const handleEditSchedule = (scheduleId: number) => {
    router.push(`/schedules/${scheduleId}/edit`);
  };

  // 수업 삭제 핸들러
  const handleDeleteSchedule = async (scheduleId: number, scheduleName: string) => {
    if (!confirm(`"${scheduleName}" 수업을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteSchedule.mutateAsync(scheduleId);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  // 일괄 생성 성공 핸들러
  const handleBulkSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  // 출근 체크 성공 핸들러
  const handleAttendanceSuccess = useCallback(() => {
    refetch();
    loadInstructorStats();
  }, [refetch, loadInstructorStats]);

  // 승인 성공 핸들러
  const handleApprovalSuccess = useCallback(() => {
    instructorsAPI.getPendingOvertimes().then((res) => {
      setPendingCount(res.requests?.length || 0);
    });
    refetch();
    loadInstructorStats();
  }, [refetch, loadInstructorStats]);

  // 타임슬롯 클릭 핸들러
  const handleSlotClick = (date: string, slot: TimeSlot) => {
    setSelectedSlot({ date, slot });
    setSlotModalOpen(true);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">수업 관리</h1>
          <p className="text-muted-foreground mt-1">
            수업 일정을 관리하고 출석을 체크하세요
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* 승인 대기 버튼 - 초과근무 승인 권한 있을 때만 */}
          {canViewOvertimeApproval && (
            <Button
              variant="outline"
              onClick={() => setApprovalsModalOpen(true)}
              className="relative"
            >
              <Bell className="h-4 w-4 mr-2" />
              승인 대기
              {pendingCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 text-xs"
                >
                  {pendingCount}
                </Badge>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setInstructorAttendanceModalOpen(true)}
            disabled={!selectedDate}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            강사 출근
          </Button>
          <Button variant="outline" onClick={() => setBulkModalOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            일괄 생성
          </Button>
          <Button onClick={() => router.push('/schedules/new')}>
            <Plus className="h-4 w-4 mr-2" />
            개별수업등록
          </Button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 탭 */}
      {!isLoading && (
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList>
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
          <TabsContent value="calendar" className="space-y-6">
            <div className="flex gap-4">
              {/* 캘린더 (펼침 상태에 따라 너비 변경) */}
              <div className={`flex-1 transition-all duration-300 ${isPanelExpanded ? '' : 'w-full'}`}>
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
              </div>

              {/* 강사 근무 배정 패널 (접기/펼치기) */}
              <div className={`hidden lg:flex flex-col transition-all duration-300 ${isPanelExpanded ? 'w-80' : 'w-10'}`}>
                {/* 토글 버튼 */}
                <button
                  onClick={togglePanel}
                  className="flex items-center justify-center h-10 mb-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  title={isPanelExpanded ? '패널 접기' : '강사 근무 배정 펼치기'}
                >
                  {isPanelExpanded ? (
                    <>
                      <PanelRightClose className="w-4 h-4 mr-2" />
                      <span className="text-sm">접기</span>
                    </>
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </button>

                {/* 패널 내용 */}
                {isPanelExpanded && (
                  <InstructorSchedulePanel
                    date={selectedDate}
                    onRequestExtraDay={() => setExtraDayModalOpen(true)}
                    onSave={() => {
                      loadInstructorStats();
                    }}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* 목록 뷰 */}
          <TabsContent value="list">
            <ScheduleList
              schedules={schedules}
              onScheduleClick={(schedule) => handleScheduleClick(schedule.id)}
              onEdit={(schedule) => handleEditSchedule(schedule.id)}
              onDelete={(schedule) =>
                handleDeleteSchedule(
                  schedule.id,
                  schedule.title || `${schedule.instructor_name} 수업`
                )
              }
              emptyMessage="수업이 없습니다."
            />
          </TabsContent>
        </Tabs>
      )}

      {/* 모달들 */}
      <BulkScheduleModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={handleBulkSuccess}
      />

      <InstructorAttendanceModal
        open={instructorAttendanceModalOpen}
        date={selectedDate}
        onClose={() => {
          setInstructorAttendanceModalOpen(false);
          handleAttendanceSuccess(); // 모달 닫을 때도 데이터 갱신
        }}
        onSuccess={handleAttendanceSuccess}
      />

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

      {/* 미배정 출근 요청 모달 */}
      <ExtraDayRequestModal
        open={extraDayModalOpen}
        date={selectedDate}
        onClose={() => setExtraDayModalOpen(false)}
        onSuccess={() => {
          // 요청 후 pending count 다시 로드 (권한 있을 때만)
          if (canViewOvertimeApproval) {
            instructorsAPI.getPendingOvertimes().then((res) => {
              setPendingCount(res.requests?.length || 0);
            });
          }
        }}
      />

      {/* 승인 대기 목록 모달 - 초과근무 승인 권한 있을 때만 */}
      {canViewOvertimeApproval && (
        <PendingApprovalsModal
          open={approvalsModalOpen}
          onClose={() => setApprovalsModalOpen(false)}
          onApproved={handleApprovalSuccess}
        />
      )}
    </div>
  );
}
