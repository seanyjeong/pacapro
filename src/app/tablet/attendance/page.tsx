'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw
} from 'lucide-react';

interface Student {
  student_id: number;
  student_name: string;
  grade: string;
  attendance_status: string | null;
  notes: string | null;
  is_trial: boolean;
  trial_remaining: number;
  season_type: string | null;
  is_makeup: boolean;
}

interface Schedule {
  id: number;
  class_date: string;
  time_slot: string;
  students: Student[];
}

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOTS: { key: TimeSlot; label: string }[] = [
  { key: 'morning', label: '오전' },
  { key: 'afternoon', label: '오후' },
  { key: 'evening', label: '저녁' }
];

const STATUS_CONFIG = {
  present: { label: '출석', color: 'bg-green-500', icon: CheckCircle2 },
  absent: { label: '결석', color: 'bg-red-500', icon: XCircle },
  late: { label: '지각', color: 'bg-yellow-500', icon: Clock },
  excused: { label: '사유', color: 'bg-blue-500', icon: AlertCircle },
};

export default function TabletAttendancePage() {
  const orientation = useOrientation();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('evening');
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ schedule: Schedule | null }>('/schedules/slot', {
        params: { date, time_slot: timeSlot }
      });
      setSchedule(res.schedule);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [date, timeSlot]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  const handleDateChange = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().split('T')[0]);
  };

  const handleAttendance = async (studentId: number, status: string) => {
    if (!schedule) return;

    setSaving(studentId);
    try {
      await apiClient.post(`/schedules/${schedule.id}/attendance`, {
        attendance_records: [{
          student_id: studentId,
          attendance_status: status
        }]
      });

      // Update local state
      setSchedule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          students: prev.students.map(s =>
            s.student_id === studentId
              ? { ...s, attendance_status: status }
              : s
          )
        };
      });
    } catch (error) {
      console.error('Failed to update attendance:', error);
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  // Stats
  const stats = schedule?.students.reduce(
    (acc, s) => {
      if (s.attendance_status === 'present' || s.attendance_status === 'late') {
        acc.present++;
      } else if (s.attendance_status === 'absent') {
        acc.absent++;
      } else if (s.attendance_status === 'excused') {
        acc.excused++;
      } else {
        acc.notMarked++;
      }
      return acc;
    },
    { present: 0, absent: 0, excused: 0, notMarked: 0 }
  ) || { present: 0, absent: 0, excused: 0, notMarked: 0 };

  return (
    <div className="space-y-4">
      {/* 날짜 선택 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">{formatDate(date)}</p>
            {isToday && (
              <span className="text-sm text-orange-500 font-medium">오늘</span>
            )}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* 시간대 탭 */}
      <div className="bg-white rounded-2xl p-2 shadow-sm">
        <div className="flex gap-2">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.key}
              onClick={() => setTimeSlot(slot.key)}
              className={`flex-1 py-3 rounded-xl font-medium transition ${
                timeSlot === slot.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 active:bg-slate-200'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 */}
      {schedule && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-slate-800">{schedule.students.length}</p>
            <p className="text-xs text-slate-500">전체</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-green-600">출석</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-red-600">결석</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.notMarked}</p>
            <p className="text-xs text-yellow-600">미체크</p>
          </div>
        </div>
      )}

      {/* 학생 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-orange-500" size={32} />
        </div>
      ) : !schedule || schedule.students.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">배정된 학생이 없습니다</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'
        }`}>
          {schedule.students.map(student => (
            <div
              key={student.student_id}
              className={`bg-white rounded-2xl p-4 shadow-sm ${
                saving === student.student_id ? 'opacity-50' : ''
              }`}
            >
              {/* 학생 정보 */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 truncate">{student.student_name}</p>
                  {student.is_trial && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                      체험
                    </span>
                  )}
                  {student.is_makeup && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                      보충
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{student.grade}</p>
              </div>

              {/* 현재 상태 표시 */}
              {student.attendance_status && (
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm ${
                    STATUS_CONFIG[student.attendance_status as keyof typeof STATUS_CONFIG]?.color || 'bg-slate-400'
                  }`}>
                    {STATUS_CONFIG[student.attendance_status as keyof typeof STATUS_CONFIG]?.label || student.attendance_status}
                  </span>
                </div>
              )}

              {/* 출석 버튼 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAttendance(student.student_id, 'present')}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'present'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-100 text-green-700 active:bg-green-200'
                  }`}
                >
                  출석
                </button>
                <button
                  onClick={() => handleAttendance(student.student_id, 'absent')}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'absent'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-100 text-red-700 active:bg-red-200'
                  }`}
                >
                  결석
                </button>
                <button
                  onClick={() => handleAttendance(student.student_id, 'late')}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'late'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-100 text-yellow-700 active:bg-yellow-200'
                  }`}
                >
                  지각
                </button>
                <button
                  onClick={() => handleAttendance(student.student_id, 'excused')}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'excused'
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-100 text-blue-700 active:bg-blue-200'
                  }`}
                >
                  사유
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
