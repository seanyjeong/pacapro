/**
 * Instructor Card Component
 * 강사 기본 정보 카드 컴포넌트
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, Calendar, Banknote, CreditCard, MapPin } from 'lucide-react';
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
} from '@/lib/types/instructor';

interface InstructorCardProps {
  instructor: Instructor;
}

export function InstructorCard({ instructor }: InstructorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 정보</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 이름 & 상태 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">
                {instructor.name.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{instructor.name}</h3>
              <p className="text-sm text-gray-600">강사</p>
            </div>
          </div>
          <span
            className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(
              instructor.status
            )}`}
          >
            {INSTRUCTOR_STATUS_LABELS[instructor.status]}
          </span>
        </div>

        {/* 연락처 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">전화번호</div>
              <div className="text-sm font-medium text-gray-900">
                {instructor.phone ? formatPhoneNumber(instructor.phone) : '-'}
              </div>
            </div>
          </div>

          {instructor.email && (
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">이메일</div>
                <div className="text-sm font-medium text-gray-900">{instructor.email}</div>
              </div>
            </div>
          )}
        </div>

        {/* 입사일 & 근속년수 */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">입사일</div>
            <div className="text-sm font-medium text-gray-900">
              {instructor.hire_date ? `${formatDate(instructor.hire_date)} (근속 ${calculateYearsOfService(instructor.hire_date)}년)` : '-'}
            </div>
          </div>
        </div>

        {/* 급여 정보 */}
        <div className="pt-4 border-t border-gray-200 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">급여 정보</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 급여타입 */}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Banknote className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">급여타입</div>
                <div className="text-sm font-medium text-gray-900">
                  {SALARY_TYPE_LABELS[instructor.salary_type]}
                </div>
              </div>
            </div>

            {/* 세금타입 */}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">세금타입</div>
                <div className="text-sm font-medium text-gray-900">
                  {TAX_TYPE_LABELS[instructor.tax_type]}
                </div>
              </div>
            </div>

            {/* 시급/수업료 */}
            {(instructor.salary_type === 'hourly' ||
              instructor.salary_type === 'per_class' ||
              instructor.salary_type === 'mixed') &&
              parseFloat(instructor.hourly_rate || '0') > 0 && (
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Banknote className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      {instructor.salary_type === 'per_class' ? '수업료' : '시급'}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(parseFloat(instructor.hourly_rate || '0'))}
                    </div>
                  </div>
                </div>
              )}

            {/* 월급 */}
            {(instructor.salary_type === 'monthly' || instructor.salary_type === 'mixed') &&
              parseFloat(instructor.base_salary || '0') > 0 && (
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Banknote className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">월급</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(parseFloat(instructor.base_salary || '0'))}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* 계좌 정보 */}
        {(instructor.bank_name || instructor.account_number) && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">계좌 정보</h4>

            <div className="space-y-2">
              {instructor.bank_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">은행명</span>
                  <span className="text-sm font-medium text-gray-900">{instructor.bank_name}</span>
                </div>
              )}
              {instructor.account_number && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">계좌번호</span>
                  <span className="text-sm font-medium text-gray-900">
                    {instructor.account_number}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 주소 */}
        {instructor.address && (
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <MapPin className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">주소</div>
              <div className="text-sm font-medium text-gray-900">{instructor.address}</div>
            </div>
          </div>
        )}

        {/* 메모 */}
        {instructor.notes && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">메모</h4>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{instructor.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
