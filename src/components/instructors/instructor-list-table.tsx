/**
 * Instructor List Table Component
 * 강사 목록 테이블 컴포넌트 (휴대폰: 한 줄 목록, PC: 표)
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/page';
import { ChevronRight, Loader2, Mail, Phone, Users } from 'lucide-react';
import { InstructorInitial, InstructorStatusBadge } from '@/features/instructors/instructor-badges';
import type { Instructor } from '@/lib/types/instructor';
import {
  formatPhoneNumber,
  formatDate,
  formatCurrency,
  calculateYearsOfService,
} from '@/lib/utils/instructor-helpers';
import {
  SALARY_TYPE_LABELS,
  TAX_TYPE_LABELS,
  INSTRUCTOR_TYPE_LABELS,
} from '@/lib/types/instructor';

interface InstructorListTableProps {
  instructors: Instructor[];
  loading?: boolean;
  onInstructorClick: (id: number) => void;
}

const th = 'whitespace-nowrap px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground';
const td = 'whitespace-nowrap px-3 py-3.5';

export function InstructorListTable({ instructors, loading, onInstructorClick }: InstructorListTableProps) {
  const getPaySummary = (instructor: Instructor) => {
    if (instructor.salary_type === 'monthly') {
      return `${formatCurrency(parseFloat(instructor.base_salary || '0'))} / 월급`;
    }
    if (instructor.salary_type === 'mixed') {
      return `${formatCurrency(parseFloat(instructor.hourly_rate || '0'))} + ${formatCurrency(parseFloat(instructor.base_salary || '0'))}`;
    }
    const suffix = instructor.salary_type === 'per_class' ? '수업당' : '시급';
    return `${formatCurrency(parseFloat(instructor.hourly_rate || '0'))} / ${suffix}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-3 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        강사 목록을 불러오는 중이에요
      </div>
    );
  }

  if (instructors.length === 0) {
    return <EmptyState icon={Users} title="강사가 없어요" description="강사를 등록하면 여기에 보여요." />;
  }

  return (
    <>
      <ul className="divide-y divide-border/60 md:hidden" data-testid="instructor-mobile-list">
        {instructors.map((instructor) => (
          <li key={instructor.id}>
            <button
              aria-label={`${instructor.name} 상세 보기`}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors active:bg-muted"
              type="button"
              onClick={() => onInstructorClick(instructor.id)}
            >
              <InstructorInitial instructor={instructor} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[16px] font-bold text-foreground">{instructor.name}</span>
                  <InstructorStatusBadge status={instructor.status} className="shrink-0" />
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-secondary-foreground">
                  {SALARY_TYPE_LABELS[instructor.salary_type]}
                  {instructor.salary_type === 'hourly' && instructor.instructor_type
                    ? ` · ${INSTRUCTOR_TYPE_LABELS[instructor.instructor_type]}`
                    : ''}
                  {' · '}
                  {getPaySummary(instructor)}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                  {instructor.phone ? formatPhoneNumber(instructor.phone) : '-'}
                  {' · '}
                  {TAX_TYPE_LABELS[instructor.tax_type]}
                  {instructor.hire_date ? ` · 입사 ${formatDate(instructor.hire_date)}` : ''}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
            </button>
          </li>
        ))}
      </ul>

      <div className="-mx-5 hidden overflow-x-auto px-2 sm:-mx-6 sm:px-3 md:block" data-testid="instructor-desktop-list">
        <table className="w-full">
          <thead className="border-b border-border/60">
            <tr>
              <th className={th}>강사 정보</th>
              <th className={th}>급여타입</th>
              <th className={th}>시급/월급</th>
              <th className={th}>세금타입</th>
              <th className={th}>상태</th>
              <th className={th}>입사일</th>
              <th className={`${th} text-right`}>작업</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map((instructor) => (
              <tr
                key={instructor.id}
                onClick={() => onInstructorClick(instructor.id)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60"
              >
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <InstructorInitial instructor={instructor} />
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold text-foreground">{instructor.name}</div>
                      <div className="mt-0.5 flex items-center gap-3 text-[13px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3" />
                          {instructor.phone ? formatPhoneNumber(instructor.phone) : '-'}
                        </span>
                        {instructor.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {instructor.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                <td className={td}>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{SALARY_TYPE_LABELS[instructor.salary_type]}</Badge>
                    {instructor.salary_type === 'hourly' && instructor.instructor_type && (
                      <Badge variant={instructor.instructor_type === 'assistant' ? 'default' : 'success'}>
                        {INSTRUCTOR_TYPE_LABELS[instructor.instructor_type]}
                      </Badge>
                    )}
                  </div>
                </td>

                <td className={td}>
                  {instructor.salary_type === 'hourly' || instructor.salary_type === 'per_class' || instructor.salary_type === 'mixed' ? (
                    <div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(parseFloat(instructor.hourly_rate || '0'))}
                      </div>
                      <div className="text-[13px] text-muted-foreground">
                        {instructor.salary_type === 'per_class' ? '수업당' : '시급'}
                      </div>
                    </div>
                  ) : null}
                  {instructor.salary_type === 'monthly' || instructor.salary_type === 'mixed' ? (
                    <div className={instructor.salary_type === 'mixed' ? 'mt-1' : ''}>
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(parseFloat(instructor.base_salary || '0'))}
                      </div>
                      <div className="text-[13px] text-muted-foreground">월급</div>
                    </div>
                  ) : null}
                </td>

                <td className={`${td} text-sm text-foreground`}>
                  {TAX_TYPE_LABELS[instructor.tax_type]}
                </td>

                <td className={td}>
                  <InstructorStatusBadge status={instructor.status} />
                </td>

                <td className={td}>
                  <div className="text-sm tabular-nums text-foreground">
                    {instructor.hire_date ? formatDate(instructor.hire_date) : '-'}
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    {instructor.hire_date ? `근속 ${calculateYearsOfService(instructor.hire_date)}년` : '-'}
                  </div>
                </td>

                <td className={`${td} text-right`}>
                  <Button
                    aria-label={`${instructor.name} 상세 보기`}
                    size="icon-sm"
                    title="상세"
                    type="button"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onInstructorClick(instructor.id);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
