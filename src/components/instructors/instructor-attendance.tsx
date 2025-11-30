/**
 * Instructor Attendance Component
 * 강사 출퇴근 기록 컴포넌트
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, LogIn, LogOut } from 'lucide-react';
import type { InstructorAttendance } from '@/lib/types/instructor';
import { formatDate, formatTime, formatWorkHours } from '@/lib/utils/instructor-helpers';

interface InstructorAttendanceProps {
  attendances: InstructorAttendance[];
  loading?: boolean;
}

export function InstructorAttendanceComponent({ attendances, loading }: InstructorAttendanceProps) {
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

  if (attendances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>출퇴근 기록</CardTitle>
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

  // 월별 총 근무시간 계산
  const totalWorkHours = attendances.reduce((sum, att) => sum + parseFloat(att.work_hours || '0'), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>출퇴근 기록</CardTitle>
          <div className="text-sm text-gray-600">
            총 근무시간: <span className="font-semibold text-gray-900">{formatWorkHours(totalWorkHours)}</span>
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
                  출근시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  퇴근시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  근무시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  메모
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendances.map((attendance) => (
                <tr key={attendance.id} className="hover:bg-gray-50">
                  {/* 날짜 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {formatDate(attendance.attendance_date)}
                      </span>
                    </div>
                  </td>

                  {/* 출근시간 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attendance.check_in ? (
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-green-100 rounded">
                          <LogIn className="w-3.5 h-3.5 text-green-600" />
                        </div>
                        <span className="text-sm text-gray-900">
                          {formatTime(attendance.check_in)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* 퇴근시간 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attendance.check_out ? (
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-red-100 rounded">
                          <LogOut className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <span className="text-sm text-gray-900">
                          {formatTime(attendance.check_out)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  {/* 근무시간 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attendance.work_hours ? (
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatWorkHours(attendance.work_hours)}
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
