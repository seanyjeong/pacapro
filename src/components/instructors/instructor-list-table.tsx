/**
 * Instructor List Table Component
 * 강사 목록 테이블 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Banknote, Calendar, Eye, Mail, Phone, Users } from 'lucide-react';
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
      <Card className="rounded-md">
        <CardContent className="p-12 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">강사 목록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (instructors.length === 0) {
    return (
      <Card className="rounded-md">
        <CardContent className="p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">강사가 없습니다</h3>
          <p className="text-muted-foreground">
            강사를 등록하시면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-md">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                  강사 정보
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                  급여타입
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                  시급/월급
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                  세금타입
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                  입사일
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-normal text-muted-foreground">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {instructors.map((instructor) => (
                <tr
                  key={instructor.id}
                  onClick={() => onInstructorClick(instructor.id)}
                  className="cursor-pointer transition-colors hover:bg-muted/60"
                >
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex items-center">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${
                        instructor.gender === 'male'
                          ? 'bg-slate-800'
                          : instructor.gender === 'female'
                          ? 'bg-rose-700'
                          : 'bg-primary'
                      }`}>
                        <span className="text-white font-bold text-sm">
                          {instructor.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-foreground">
                          {instructor.name}
                        </div>
                        <div className="mt-1 flex items-center text-xs text-muted-foreground">
                          <Phone className="mr-1 h-3 w-3" />
                          {instructor.phone ? formatPhoneNumber(instructor.phone) : '-'}
                        </div>
                        {instructor.email && (
                          <div className="mt-0.5 flex items-center text-xs text-muted-foreground">
                            <Mail className="mr-1 h-3 w-3" />
                            {instructor.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                      {SALARY_TYPE_LABELS[instructor.salary_type]}
                    </span>
                    {instructor.salary_type === 'hourly' && instructor.instructor_type && (
                      <span className={`ml-1 inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                        instructor.instructor_type === 'assistant'
                          ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200'
                      }`}>
                        {INSTRUCTOR_TYPE_LABELS[instructor.instructor_type]}
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    {instructor.salary_type === 'hourly' || instructor.salary_type === 'per_class' || instructor.salary_type === 'mixed' ? (
                      <div>
                        <div className="flex items-center text-sm font-medium text-foreground">
                          <Banknote className="mr-1 h-4 w-4 text-muted-foreground" />
                          {formatCurrency(parseFloat(instructor.hourly_rate || '0'))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {instructor.salary_type === 'per_class' ? '수업당' : '시급'}
                        </div>
                      </div>
                    ) : null}
                    {instructor.salary_type === 'monthly' || instructor.salary_type === 'mixed' ? (
                      <div className={instructor.salary_type === 'mixed' ? 'mt-1' : ''}>
                        <div className="text-sm font-medium text-foreground flex items-center">
                          <Banknote className="w-4 h-4 mr-1" />
                          {formatCurrency(parseFloat(instructor.base_salary || '0'))}
                        </div>
                        <div className="text-xs text-muted-foreground">월급</div>
                      </div>
                    ) : null}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <span className="text-sm text-foreground">
                      {TAX_TYPE_LABELS[instructor.tax_type]}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                        instructor.status
                      )}`}
                    >
                      {INSTRUCTOR_STATUS_LABELS[instructor.status]}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex items-center text-sm text-foreground">
                      <Calendar className="mr-1 h-4 w-4 text-muted-foreground" />
                      {instructor.hire_date ? formatDate(instructor.hire_date) : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {instructor.hire_date ? `근속 ${calculateYearsOfService(instructor.hire_date)}년` : '-'}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <Button
                      aria-label={`${instructor.name} 상세 보기`}
                      className="gap-2"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onInstructorClick(instructor.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      상세
                    </Button>
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
