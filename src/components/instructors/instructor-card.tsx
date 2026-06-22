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
    <Card className="rounded-md">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="text-base tracking-normal">기본 정보</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        {/* 이름 & 상태 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary">
              <span className="text-xl font-bold text-white">
                {instructor.name.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">{instructor.name}</h3>
              <p className="text-sm text-muted-foreground">강사</p>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">전화번호</div>
              <div className="text-sm font-medium text-foreground">
                {instructor.phone ? formatPhoneNumber(instructor.phone) : '-'}
              </div>
            </div>
          </div>

          {instructor.email && (
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">이메일</div>
                <div className="text-sm font-medium text-foreground">{instructor.email}</div>
              </div>
            </div>
          )}
        </div>

        {/* 입사일 & 근속년수 */}
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">입사일</div>
            <div className="text-sm font-medium text-foreground">
              {instructor.hire_date ? `${formatDate(instructor.hire_date)} (근속 ${calculateYearsOfService(instructor.hire_date)}년)` : '-'}
            </div>
          </div>
        </div>

        {/* 급여 정보 */}
        <div className="space-y-4 border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground">급여 정보</h4>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 급여타입 */}
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Banknote className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">급여타입</div>
                <div className="text-sm font-medium text-foreground">
                  {SALARY_TYPE_LABELS[instructor.salary_type]}
                </div>
              </div>
            </div>

            {/* 세금타입 */}
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">세금타입</div>
                <div className="text-sm font-medium text-foreground">
                  {TAX_TYPE_LABELS[instructor.tax_type]}
                </div>
              </div>
            </div>

            {/* 시급/수업료 */}
            {(instructor.salary_type === 'hourly' ||
              instructor.salary_type === 'per_class' ||
              instructor.salary_type === 'mixed') &&
              parseFloat(instructor.hourly_rate || '0') > 0 && (
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Banknote className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {instructor.salary_type === 'per_class' ? '수업료' : '시급'}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(parseFloat(instructor.hourly_rate || '0'))}
                    </div>
                  </div>
                </div>
              )}

            {/* 월급 */}
            {(instructor.salary_type === 'monthly' || instructor.salary_type === 'mixed') &&
              parseFloat(instructor.base_salary || '0') > 0 && (
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Banknote className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">월급</div>
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(parseFloat(instructor.base_salary || '0'))}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* 계좌 정보 */}
        {(instructor.bank_name || instructor.account_number) && (
          <div className="space-y-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground">계좌 정보</h4>

            <div className="space-y-2">
              {instructor.bank_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">은행명</span>
                  <span className="text-sm font-medium text-foreground">{instructor.bank_name}</span>
                </div>
              )}
              {instructor.account_number && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">계좌번호</span>
                  <span className="text-sm font-medium text-foreground">
                    {instructor.account_number}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 주소 */}
        {instructor.address && (
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">주소</div>
              <div className="text-sm font-medium text-foreground">{instructor.address}</div>
            </div>
          </div>
        )}

        {/* 메모 */}
        {instructor.notes && (
          <div className="border-t border-border pt-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">메모</h4>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{instructor.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
