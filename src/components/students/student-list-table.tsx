/**
 * Student List Table Component
 * 학생 목록 테이블 컴포넌트 - DB 스키마와 일치
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, Sparkles } from 'lucide-react';
import type { Student } from '@/lib/types/student';
import {
  formatStudentNumber,
  formatPhoneNumber,
  getStudentDisplayInfo,
  formatClassDays,
  formatCurrency,
  getStatusColor,
  formatDate,
} from '@/lib/utils/student-helpers';
import {
  ADMISSION_TYPE_LABELS,
  STATUS_LABELS,
  STUDENT_TYPE_LABELS,
  GENDER_LABELS,
} from '@/lib/types/student';

interface StudentListTableProps {
  students: Student[];
  loading?: boolean;
  onStudentClick: (id: number) => void;
  hideMonthlyTuition?: boolean;
}

export function StudentListTable({ students, loading, onStudentClick, hideMonthlyTuition }: StudentListTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">학생 목록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-muted-foreground mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">학생이 없습니다</h3>
          <p className="text-muted-foreground">
            학생을 등록하시면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  학생 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  성별
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  입시유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  수업일
                </th>
                {!hideMonthlyTuition && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    월 학원비
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  등록일
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {students.map((student) => {
                // discount_rate는 string이므로 parseFloat
                const discountRate = parseFloat(student.discount_rate) || 0;

                return (
                  <tr
                    key={student.id}
                    onClick={() => onStudentClick(student.id)}
                    className="hover:bg-muted cursor-pointer transition-colors"
                  >
                    {/* 학생 정보 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          student.gender === 'male'
                            ? 'bg-gradient-to-br from-sky-400 to-sky-600'
                            : student.gender === 'female'
                            ? 'bg-gradient-to-br from-pink-400 to-pink-600'
                            : 'bg-gradient-to-br from-gray-400 to-gray-600'
                        }`}>
                          <span className="text-white font-bold text-sm">
                            {student.name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            {student.name}
                            {!!student.is_trial && (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs flex items-center gap-1 px-1.5 py-0">
                                <Sparkles className="h-3 w-3" />
                                체험
                              </Badge>
                            )}
                          </div>
                          {student.student_number && student.student_number !== '0' && student.student_number !== '00' && (
                            <div className="text-sm text-muted-foreground">
                              {formatStudentNumber(student.student_number)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground flex items-center mt-1">
                            <Phone className="w-3 h-3 mr-1" />
                            {formatPhoneNumber(student.phone)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 성별 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.gender ? (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          student.gender === 'male'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {GENDER_LABELS[student.gender]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>

                    {/* 학생 유형/학년 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          student.student_type === 'exam' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}>
                          {STUDENT_TYPE_LABELS[student.student_type]}
                        </span>
                        <span className="ml-2">{getStudentDisplayInfo(student)}</span>
                      </div>
                    </td>

                    {/* 입시유형 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        student.admission_type === 'regular'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : student.admission_type === 'early'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}>
                        {ADMISSION_TYPE_LABELS[student.admission_type] || student.admission_type}
                      </span>
                    </td>

                    {/* 수업일 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {formatClassDays(student.class_days)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        주 {student.weekly_count}회
                      </div>
                    </td>

                    {/* 월 학원비 */}
                    {!hideMonthlyTuition && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(student.monthly_tuition)}
                        </div>
                        {discountRate > 0 && (
                          <div className="text-xs text-red-500">
                            {discountRate}% 할인
                          </div>
                        )}
                      </td>
                    )}

                    {/* 상태 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                            student.status
                          )}`}
                        >
                          {STATUS_LABELS[student.status] || student.status}
                        </span>
                        {/* 휴원생 휴식기간 표시 */}
                        {student.status === 'paused' && student.rest_start_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDate(student.rest_start_date)}
                            {student.rest_end_date
                              ? ` ~ ${formatDate(student.rest_end_date)}`
                              : ' ~ (무기한)'}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 등록일 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(student.enrollment_date)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
