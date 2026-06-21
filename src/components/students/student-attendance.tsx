'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useStudentAttendance } from '@/hooks/use-students';
import type { StudentAttendanceRecord } from '@/lib/types/student';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  late: 'bg-yellow-500',
  excused: 'bg-blue-500',
};

const STATUS_LABELS: Record<string, string> = {
  present: '출석',
  absent: '결석',
  late: '지각',
  excused: '공결',
};

const SLOT_ORDER = ['morning', 'afternoon', 'evening'] as const;

interface Props {
  studentId: number;
}

export function StudentAttendanceComponent({ studentId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const { data, loading, error } = useStudentAttendance(studentId, yearMonth);

  // Group records by date
  const recordsByDate = useMemo(() => {
    if (!data?.records) return {};
    const map: Record<string, StudentAttendanceRecord[]> = {};
    for (const r of data.records) {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    }
    return map;
  }, [data?.records]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const goPrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const goNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[120px] text-center">
            {year}년 {month}월
          </h3>
          <Button variant="outline" size="icon" onClick={goNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" onClick={goToday} className="text-xs ml-1">
              오늘
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {data?.summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCard label="전체" value={data.summary.total} color="bg-gray-100 dark:bg-gray-800" textColor="text-foreground" />
          <StatCard label="출석" value={data.summary.present} color="bg-green-50 dark:bg-green-900/30" textColor="text-green-700 dark:text-green-400" />
          <StatCard label="결석" value={data.summary.absent} color="bg-red-50 dark:bg-red-900/30" textColor="text-red-700 dark:text-red-400" />
          <StatCard label="지각" value={data.summary.late} color="bg-yellow-50 dark:bg-yellow-900/30" textColor="text-yellow-700 dark:text-yellow-400" />
          <StatCard label="공결" value={data.summary.excused} color="bg-blue-50 dark:bg-blue-900/30" textColor="text-blue-700 dark:text-blue-400" />
          <StatCard
            label="출석률"
            value={`${data.summary.attendance_rate}%`}
            color="bg-primary-50 dark:bg-primary-900/30"
            textColor="text-primary-700 dark:text-primary-400"
          />
        </div>
      )}

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              출결 데이터를 불러올 수 없습니다.
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-16" />;
                  }
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const records = recordsByDate[dateStr] || [];
                  const isToday = isCurrentMonth && day === today.getDate();
                  const dow = new Date(year, month - 1, day).getDay();

                  return (
                    <div
                      key={day}
                      className={`h-16 border border-border/50 p-1 relative ${
                        isToday ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <span className={`text-xs font-medium ${
                        dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-foreground'
                      } ${isToday ? 'bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                        {day}
                      </span>
                      {records.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {records
                            .sort((a, b) => SLOT_ORDER.indexOf(a.time_slot as typeof SLOT_ORDER[number]) - SLOT_ORDER.indexOf(b.time_slot as typeof SLOT_ORDER[number]))
                            .map((r, i) => (
                              <div
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[r.attendance_status || ''] || 'bg-gray-300'}`}
                                title={`${TIME_SLOT_LABELS[r.time_slot] || r.time_slot}: ${STATUS_LABELS[r.attendance_status || ''] || '미체크'}${r.is_makeup ? ' (보충)' : ''}`}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detailed list */}
      {data?.records && data.records.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              상세 기록
            </h4>
            <div className="space-y-1">
              {data.records.map((r, i) => {
                const d = new Date(r.date + 'T00:00:00');
                const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="text-muted-foreground w-24 shrink-0">
                      {r.date.slice(5)} ({dow})
                    </span>
                    <span className="text-muted-foreground w-10 shrink-0">
                      {TIME_SLOT_LABELS[r.time_slot] || r.time_slot}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[r.attendance_status || ''] || 'bg-gray-300'}`} />
                      {STATUS_LABELS[r.attendance_status || ''] || '미체크'}
                    </span>
                    {r.is_makeup && (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded">보충</span>
                    )}
                    {r.notes && (
                      <span className="text-xs text-muted-foreground truncate">{r.notes}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && data?.records?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {month}월 출결 기록이 없습니다.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, textColor }: { label: string; value: number | string; color: string; textColor: string }) {
  return (
    <div className={`rounded-lg p-2.5 ${color}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${textColor}`}>{value}</div>
    </div>
  );
}
