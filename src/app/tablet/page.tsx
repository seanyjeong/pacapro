'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  Users,
  CalendarCheck,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface TodayStats {
  totalStudents: number;
  attendedCount: number;
  absentCount: number;
  notMarkedCount: number;
  unpaidCount: number;
  todaySchedules: number;
}

interface TimeSlotStats {
  morning: { total: number; attended: number };
  afternoon: { total: number; attended: number };
  evening: { total: number; attended: number };
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁'
};

export default function TabletDashboard() {
  const orientation = useOrientation();
  const [stats, setStats] = useState<TodayStats>({
    totalStudents: 0,
    attendedCount: 0,
    absentCount: 0,
    notMarkedCount: 0,
    unpaidCount: 0,
    todaySchedules: 0
  });
  const [timeSlotStats, setTimeSlotStats] = useState<TimeSlotStats>({
    morning: { total: 0, attended: 0 },
    afternoon: { total: 0, attended: 0 },
    evening: { total: 0, attended: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayData();
  }, []);

  const fetchTodayData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's schedules with attendance
      const scheduleRes = await apiClient.get<{
        schedules: Array<{
          id: number;
          time_slot: string;
          student_count: number;
          attendance_taken: boolean;
        }>;
      }>('/schedules', {
        params: { start_date: today, end_date: today }
      });

      const schedules = scheduleRes.schedules || [];

      // Calculate stats per time slot
      const slotStats: TimeSlotStats = {
        morning: { total: 0, attended: 0 },
        afternoon: { total: 0, attended: 0 },
        evening: { total: 0, attended: 0 }
      };

      let totalStudents = 0;
      let todaySchedules = schedules.length;

      schedules.forEach(schedule => {
        const slot = schedule.time_slot as keyof TimeSlotStats;
        if (slotStats[slot]) {
          slotStats[slot].total += schedule.student_count || 0;
          totalStudents += schedule.student_count || 0;
        }
      });

      // Calculate attendance from schedules data
      let attendedCount = 0;
      let absentCount = 0;
      let notMarkedCount = 0;

      // Fetch detailed schedules with attendances
      for (const schedule of schedules) {
        try {
          const detailRes = await apiClient.get<{
            schedule: {
              time_slot: string;
              attendances: Array<{
                attendance_status: string | null;
              }>;
            };
          }>(`/schedules/${schedule.id}`);

          const slot = detailRes.schedule.time_slot as keyof TimeSlotStats;
          (detailRes.schedule.attendances || []).forEach(att => {
            if (att.attendance_status === 'present' || att.attendance_status === 'late') {
              attendedCount++;
              if (slotStats[slot]) slotStats[slot].attended++;
            } else if (att.attendance_status === 'absent' || att.attendance_status === 'excused') {
              absentCount++;
            } else {
              notMarkedCount++;
            }
          });
        } catch {
          // Skip if schedule detail fetch fails
        }
      }

      // Fetch unpaid count
      const currentMonth = new Date().toISOString().slice(0, 7);
      const paymentRes = await apiClient.get<{
        payments: Array<{
          payment_status: string;
        }>;
      }>('/payments', {
        params: { year_month: currentMonth }
      });

      const unpaidCount = (paymentRes.payments || []).filter(
        p => p.payment_status === 'unpaid' || p.payment_status === 'partial'
      ).length;

      setStats({
        totalStudents,
        attendedCount,
        absentCount,
        notMarkedCount,
        unpaidCount,
        todaySchedules
      });
      setTimeSlotStats(slotStats);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStr = dayNames[today.getDay()];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 날짜 헤더 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{dateStr}</h2>
            <p className="text-slate-500">{dayStr}요일</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-orange-500">{stats.todaySchedules}</p>
            <p className="text-sm text-slate-500">오늘 수업</p>
          </div>
        </div>
      </div>

      {/* 출석 현황 요약 */}
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <Link
          href="/tablet/attendance"
          className="bg-white rounded-2xl p-5 shadow-sm active:scale-98 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.attendedCount}</p>
              <p className="text-sm text-slate-500">출석</p>
            </div>
          </div>
        </Link>

        <Link
          href="/tablet/attendance"
          className="bg-white rounded-2xl p-5 shadow-sm active:scale-98 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.absentCount}</p>
              <p className="text-sm text-slate-500">결석</p>
            </div>
          </div>
        </Link>

        <Link
          href="/tablet/attendance"
          className="bg-white rounded-2xl p-5 shadow-sm active:scale-98 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.notMarkedCount}</p>
              <p className="text-sm text-slate-500">미체크</p>
            </div>
          </div>
        </Link>

        <Link
          href="/tablet/payments"
          className="bg-white rounded-2xl p-5 shadow-sm active:scale-98 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <CreditCard className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.unpaidCount}</p>
              <p className="text-sm text-slate-500">미납</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 시간대별 현황 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4">시간대별 출석</h3>
        <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {(['morning', 'afternoon', 'evening'] as const).map(slot => {
            const slotData = timeSlotStats[slot];
            const percentage = slotData.total > 0
              ? Math.round((slotData.attended / slotData.total) * 100)
              : 0;

            return (
              <div key={slot} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-slate-400" />
                    <span className="font-medium text-slate-700">{TIME_SLOT_LABELS[slot]}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {slotData.attended}/{slotData.total}명
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-right text-xs text-slate-400 mt-1">{percentage}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <Link
          href="/tablet/attendance"
          className="bg-orange-500 text-white rounded-2xl p-6 shadow-sm active:scale-98 transition"
        >
          <CalendarCheck size={32} className="mb-2" />
          <p className="font-bold">출석체크</p>
          <p className="text-sm opacity-80">출결 관리</p>
        </Link>

        <Link
          href="/tablet/students"
          className="bg-blue-500 text-white rounded-2xl p-6 shadow-sm active:scale-98 transition"
        >
          <Users size={32} className="mb-2" />
          <p className="font-bold">학생조회</p>
          <p className="text-sm opacity-80">학생 검색</p>
        </Link>

        <Link
          href="/tablet/payments"
          className="bg-emerald-500 text-white rounded-2xl p-6 shadow-sm active:scale-98 transition"
        >
          <CreditCard size={32} className="mb-2" />
          <p className="font-bold">결제확인</p>
          <p className="text-sm opacity-80">납부 현황</p>
        </Link>

        <Link
          href="/tablet/schedule"
          className="bg-purple-500 text-white rounded-2xl p-6 shadow-sm active:scale-98 transition"
        >
          <Clock size={32} className="mb-2" />
          <p className="font-bold">스케줄</p>
          <p className="text-sm opacity-80">일정 확인</p>
        </Link>
      </div>
    </div>
  );
}
