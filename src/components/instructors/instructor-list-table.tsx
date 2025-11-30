/**
 * Instructor List Table Component
 * 강사 목록 테이블 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, Calendar, Banknote } from 'lucide-react';
import type { Instructor } from '@/lib/types/instructor';
import {
  formatPhoneNumber,
  formatDate,
  formatCurrency,
  getStatusColor,
  calculateYearsOfService,
} from '@/lib/utils/instructor-helpers';
import {
  SALARY_TYPE_LABELS,
  TAX_TYPE_LABELS,
  INSTRUCTOR_STATUS_LABELS,
  INSTRUCTOR_TYPE_LABELS,
} from '@/lib/types/instructor';

interface InstructorListTableProps {
  instructors: Instructor[];
  loading?: boolean;
  onInstructorClick: (id: number) => void;
}

export function InstructorListTable({ instructors, loading, onInstructorClick }: InstructorListTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">강사 목록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (instructors.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-gray-400 mb-4">
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">강사가 없습니다</h3>
          <p className="text-gray-600">
            강사를 등록하시면 여기에 표시됩니다.
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
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  강사 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  급여타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시급/월급
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  세금타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  입사일
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {instructors.map((instructor) => (
                <tr
                  key={instructor.id}
                  onClick={() => onInstructorClick(instructor.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* 강사 정보 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {instructor.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {instructor.name}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {instructor.phone ? formatPhoneNumber(instructor.phone) : '-'}
                        </div>
                        {instructor.email && (
                          <div className="text-xs text-gray-400 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1" />
                            {instructor.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 급여타입 / 강사유형 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {SALARY_TYPE_LABELS[instructor.salary_type]}
                    </span>
                    {instructor.salary_type === 'hourly' && instructor.instructor_type && (
                      <span className={`ml-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        instructor.instructor_type === 'assistant'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {INSTRUCTOR_TYPE_LABELS[instructor.instructor_type]}
                      </span>
                    )}
                  </td>

                  {/* 시급/월급 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {instructor.salary_type === 'hourly' || instructor.salary_type === 'per_class' || instructor.salary_type === 'mixed' ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          <Banknote className="w-4 h-4 mr-1" />
                          {formatCurrency(parseFloat(instructor.hourly_rate || '0'))}
                        </div>
                        <div className="text-xs text-gray-500">
                          {instructor.salary_type === 'per_class' ? '수업당' : '시급'}
                        </div>
                      </div>
                    ) : null}
                    {instructor.salary_type === 'monthly' || instructor.salary_type === 'mixed' ? (
                      <div className={instructor.salary_type === 'mixed' ? 'mt-1' : ''}>
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          <Banknote className="w-4 h-4 mr-1" />
                          {formatCurrency(parseFloat(instructor.base_salary || '0'))}
                        </div>
                        <div className="text-xs text-gray-500">월급</div>
                      </div>
                    ) : null}
                  </td>

                  {/* 세금타입 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {TAX_TYPE_LABELS[instructor.tax_type]}
                    </span>
                  </td>

                  {/* 상태 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                        instructor.status
                      )}`}
                    >
                      {INSTRUCTOR_STATUS_LABELS[instructor.status]}
                    </span>
                  </td>

                  {/* 입사일 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {instructor.hire_date ? formatDate(instructor.hire_date) : '-'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {instructor.hire_date ? `근속 ${calculateYearsOfService(instructor.hire_date)}년` : '-'}
                    </div>
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
