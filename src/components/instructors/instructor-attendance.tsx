/**
 * Instructor Attendance Component
 * 강사 출퇴근 기록 컴포넌트
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, LogIn, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import type { InstructorAttendance } from '@/lib/types/instructor';

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

const STATUS_LABELS: Record<string, string> = {
  present: '출근',
  absent: '결근',
  late: '지각',
  day_off: '휴무',
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return '-';
  return timeStr.substring(0, 5); // HH:mm:ss -> HH:mm
};

interface InstructorAttendanceProps {
  attendances: InstructorAttendance[];
  loading?: boolean;
}

export function InstructorAttendanceComponent({ attendances, loading }: InstructorAttendanceProps) {
  // 현재 년월 상태
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);

  // 해당 월의 출퇴근 기록만 필터링
  const filteredAttendances = useMemo(() => {
    return attendances.filter((att) => {
      if (!att.work_date) return false;
      const date = new Date(att.work_date);
      return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
    });
  }, [attendances, currentYear, currentMonth]);

  // 이전 월로 이동
  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // 다음 월로 이동
  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 오늘 월로 이동
  const goToCurrentMonth = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>출퇴근 기록</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">출퇴근 기록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  // 월 네비게이션 UI
  const MonthNavigation = () => (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="sm" onClick={goToPrevMonth}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="min-w-[100px]">
        {currentYear}년 {currentMonth}월
      </Button>
      <Button variant="outline" size="sm" onClick={goToNextMonth}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );

  if (attendances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>출퇴근 기록</CardTitle>
            <MonthNavigation />
          </div>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Calendar className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">출퇴근 기록이 없습니다</h3>
          <p className="text-gray-600">출퇴근 기록이 추가되면 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>출퇴근 기록</CardTitle>
          <div className="flex items-center space-x-4">
            <MonthNavigation />
            <div className="text-sm text-gray-600">
              {currentYear}년 {currentMonth}월: <span className="font-semibold text-gray-900">{filteredAttendances.length}</span>건
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시간대
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출근
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  퇴근
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  메모
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {currentYear}년 {currentMonth}월에 출퇴근 기록이 없습니다.
                  </td>
                </tr>
              ) : filteredAttendances.map((attendance) => (
                <tr key={attendance.id} className="hover:bg-gray-50">
                  {/* 날짜 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {formatDate(attendance.work_date)}
                      </span>
                    </div>
                  </td>

                  {/* 시간대 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      attendance.time_slot === 'morning' ? 'bg-yellow-100 text-yellow-800' :
                      attendance.time_slot === 'afternoon' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {TIME_SLOT_LABELS[attendance.time_slot] || attendance.time_slot}
                    </span>
                  </td>

                  {/* 상태 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      attendance.attendance_status === 'present' ? 'bg-green-100 text-green-800' :
                      attendance.attendance_status === 'absent' ? 'bg-red-100 text-red-800' :
                      attendance.attendance_status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {STATUS_LABELS[attendance.attendance_status || 'present']}
                    </span>
                  </td>

                  {/* 출근시간 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attendance.check_in_time ? (
                      <div className="flex items-center space-x-2">
                        <LogIn className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-900">
                          {formatTime(attendance.check_in_time)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* 퇴근시간 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attendance.check_out_time ? (
                      <div className="flex items-center space-x-2">
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-gray-900">
                          {formatTime(attendance.check_out_time)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* 메모 */}
                  <td className="px-4 py-3">
                    {attendance.notes ? (
                      <span className="text-sm text-gray-600">{attendance.notes}</span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
