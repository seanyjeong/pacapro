import { GraduationCap, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GradeFilter, SmsRecipientsCount, StatusFilter } from './sms-types';

interface AllRecipientFiltersProps {
  statusFilter: StatusFilter;
  gradeFilter: GradeFilter;
  recipientsCount: SmsRecipientsCount;
  onStatusFilterChange: (value: StatusFilter) => void;
  onGradeFilterChange: (value: GradeFilter) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: '재원생', detail: '현재 수업 대상' },
  { value: 'pending', label: '미등록관리', detail: '상담 이후 추적 대상' },
] satisfies Array<{ value: StatusFilter; label: string; detail: string }>;

const GRADE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'junior', label: '1-2학년' },
  { value: 'senior', label: '3학년, N수' },
] satisfies Array<{ value: GradeFilter; label: string }>;

export function AllRecipientFilters({
  statusFilter,
  gradeFilter,
  recipientsCount,
  onStatusFilterChange,
  onGradeFilterChange,
}: AllRecipientFiltersProps) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">전체 발송 필터</h3>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onStatusFilterChange(option.value)}
            className={cn(
              'rounded-md border px-3 py-2 text-left transition-colors',
              statusFilter === option.value
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <span className="block text-sm font-medium text-foreground">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.detail}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">학년</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {GRADE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onGradeFilterChange(option.value)}
              className={cn(
                'rounded-md border px-2 py-2 text-sm font-medium transition-colors',
                gradeFilter === option.value
                  ? 'border-slate-400 bg-slate-100 text-slate-950'
                  : 'border-border bg-background text-foreground hover:border-muted-foreground/50'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-muted px-3 py-2 text-center text-xs">
        <span>전체 {recipientsCount.all}명</span>
        <span>학생 {recipientsCount.students}명</span>
        <span>학부모 {recipientsCount.parents}명</span>
      </div>
    </section>
  );
}
