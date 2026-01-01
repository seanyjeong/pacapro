'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User
} from 'lucide-react';

interface Schedule {
  id: number;
  class_date: string;
  time_slot: string;
  instructor_id: number | null;
  instructor_name: string | null;
  student_count: number;
  students?: Array<{
    student_id: number;
    student_name: string;
    grade: string;
    attendance_status: string | null;
  }>;
}

type ViewMode = 'day' | 'week';

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁'
};

const TIME_SLOT_COLORS: Record<string, string> = {
  morning: 'bg-amber-100 border-amber-300',
  afternoon: 'bg-sky-100 border-sky-300',
  evening: 'bg-violet-100 border-violet-300'
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function TabletSchedulePage() {
  const orientation = useOrientation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expandedSchedule, setExpandedSchedule] = useState<number | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      let startDate = selectedDate;
      let endDate = selectedDate;

      if (viewMode === 'week') {
        const date = new Date(selectedDate);
        const dayOfWeek = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        startDate = monday.toISOString().split('T')[0];
        endDate = sunday.toISOString().split('T')[0];
      }

      const res = await apiClient.get<{ schedules: Schedule[] }>('/schedules', {
        params: { start_date: startDate, end_date: endDate }
      });
      setSchedules(res.schedules || []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleDateChange = (delta: number) => {
    const date = new Date(selectedDate);
    if (viewMode === 'day') {
      date.setDate(date.getDate() + delta);
    } else {
      date.setDate(date.getDate() + (delta * 7));
    }
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
  };

  const formatWeekRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // 일별 뷰: 시간대별 그룹화
  const schedulesByTimeSlot = schedules.reduce((acc, schedule) => {
    const slot = schedule.time_slot;
    if (!acc[slot]) acc[slot] = [];
    acc[slot].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  // 주간 뷰: 날짜별 그룹화
  const schedulesByDate = schedules.reduce((acc, schedule) => {
    const date = schedule.class_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const handleScheduleClick = async (scheduleId: number) => {
    if (expandedSchedule === scheduleId) {
      setExpandedSchedule(null);
      return;
    }

    // 학생 목록 가져오기
    try {
      const res = await apiClient.get<{ schedule: Schedule }>(`/schedules/${scheduleId}`);
      const updatedSchedule = res.schedule;
      setSchedules(prev =>
        prev.map(s => s.id === scheduleId ? { ...s, students: updatedSchedule.students } : s)
      );
      setExpandedSchedule(scheduleId);
    } catch (error) {
      console.error('Failed to fetch schedule details:', error);
    }
  };

  const getTotalStudents = () => {
    return schedules.reduce((sum, s) => sum + (s.student_count || 0), 0);
  };

  return (
    <div className="space-y-4">
      {/* 날짜 선택 및 뷰 모드 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">
              {viewMode === 'day' ? formatDate(selectedDate) : formatWeekRange(selectedDate)}
            </p>
            {isToday && viewMode === 'day' && (
              <span className="text-sm text-blue-500 font-medium">오늘</span>
            )}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* 뷰 모드 전환 */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('day')}
            className={`flex-1 py-2 rounded-xl font-medium transition ${
              viewMode === 'day'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            일별
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 py-2 rounded-xl font-medium transition ${
              viewMode === 'week'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            주간
          </button>
          <button
            onClick={fetchSchedules}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={18} className="text-blue-500" />
            <span className="text-sm text-slate-500">수업 수</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{schedules.length}개</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users size={18} className="text-blue-500" />
            <span className="text-sm text-slate-500">총 학생</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{getTotalStudents()}명</p>
        </div>
      </div>

      {/* 스케줄 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">배정된 수업이 없습니다</p>
        </div>
      ) : viewMode === 'day' ? (
        /* 일별 뷰 */
        <div className="space-y-4">
          {(['morning', 'afternoon', 'evening'] as const).map(slot => {
            const slotSchedules = schedulesByTimeSlot[slot] || [];
            if (slotSchedules.length === 0) return null;

            return (
              <div key={slot} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{TIME_SLOT_LABELS[slot]}</span>
                  <span className="text-sm text-slate-400">({slotSchedules.length}개)</span>
                </div>

                <div className={`grid gap-3 ${orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                  {slotSchedules.map(schedule => (
                    <div
                      key={schedule.id}
                      className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${TIME_SLOT_COLORS[slot]}`}
                    >
                      <button
                        onClick={() => handleScheduleClick(schedule.id)}
                        className="w-full p-4 text-left active:bg-slate-50 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-500" />
                            <span className="font-bold text-slate-800">{schedule.student_count}명</span>
                          </div>
                          {schedule.instructor_name && (
                            <span className="text-sm text-slate-500">
                              {schedule.instructor_name}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* 학생 목록 (확장시) */}
                      {expandedSchedule === schedule.id && schedule.students && (
                        <div className="border-t border-slate-100 p-3 bg-slate-50">
                          <div className="space-y-2">
                            {schedule.students.map(student => (
                              <div
                                key={student.student_id}
                                className="flex items-center gap-2 py-1"
                              >
                                <User size={14} className="text-slate-400" />
                                <span className="text-sm text-slate-700">{student.student_name}</span>
                                <span className="text-xs text-slate-400">{student.grade}</span>
                                {student.attendance_status && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    student.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                                    student.attendance_status === 'absent' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {student.attendance_status === 'present' ? '출석' :
                                     student.attendance_status === 'absent' ? '결석' :
                                     student.attendance_status === 'late' ? '지각' : '사유'}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 주간 뷰 */
        <div className="space-y-4">
          {Object.entries(schedulesByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateSchedules]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{formatDate(date)}</span>
                  <span className="text-sm text-slate-400">({dateSchedules.length}개)</span>
                </div>

                <div className={`grid gap-3 ${orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                  {dateSchedules.map(schedule => (
                    <div
                      key={schedule.id}
                      className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${TIME_SLOT_COLORS[schedule.time_slot]}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-lg text-sm font-medium ${
                            schedule.time_slot === 'morning' ? 'bg-amber-100 text-amber-700' :
                            schedule.time_slot === 'afternoon' ? 'bg-sky-100 text-sky-700' :
                            'bg-violet-100 text-violet-700'
                          }`}>
                            {TIME_SLOT_LABELS[schedule.time_slot]}
                          </span>
                          <div className="flex items-center gap-1">
                            <Users size={16} className="text-slate-500" />
                            <span className="font-medium text-slate-800">{schedule.student_count}명</span>
                          </div>
                        </div>
                        {schedule.instructor_name && (
                          <span className="text-sm text-slate-500">{schedule.instructor_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
