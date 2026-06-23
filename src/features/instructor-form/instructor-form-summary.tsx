import { CalendarDays, CheckCircle2, CircleAlert, WalletCards } from 'lucide-react';
import {
  INSTRUCTOR_TYPE_LABELS,
  SALARY_TYPE_LABELS,
  WEEKDAY_OPTIONS,
} from '@/lib/types/instructor';
import type { InstructorFormData } from '@/lib/types/instructor';
import type { InstructorFormErrors } from './instructor-form-types';

interface InstructorFormSummaryProps {
  errors: InstructorFormErrors;
  formData: InstructorFormData;
}

function getWorkDaysLabel(workDays: number[] | undefined) {
  if (!workDays?.length) return '미선택';

  return WEEKDAY_OPTIONS
    .filter((day) => workDays.includes(day.value))
    .map((day) => day.label)
    .join(', ');
}

function SummaryRow({
  label,
  ready,
  value,
}: {
  label: string;
  ready: boolean;
  value: string;
}) {
  const Icon = ready ? CheckCircle2 : CircleAlert;

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ready ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function InstructorFormSummary({ errors, formData }: InstructorFormSummaryProps) {
  const workScheduleRequired = formData.salary_type === 'hourly' && formData.instructor_type === 'assistant';
  const workDaysLabel = getWorkDaysLabel(formData.work_days);
  const hasSubmitError = Boolean(errors.submit);

  return (
    <aside className="rounded-md border border-border bg-card" data-testid="instructor-form-summary">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
        <h2 className="mt-1 text-sm font-semibold text-foreground">입력 체크</h2>
        <p className="mt-1 text-xs text-muted-foreground">저장 전 확인</p>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100">
          <div className="flex items-start gap-2">
            <WalletCards className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs leading-5">
              급여 방식에 따라 필요한 금액 입력칸과 근무 설정이 자동으로 정리됩니다.
            </p>
          </div>
        </div>

        <SummaryRow label="강사명" ready={Boolean(formData.name.trim())} value={formData.name.trim() || '미입력'} />
        <SummaryRow label="연락처" ready={Boolean(formData.phone?.trim())} value={formData.phone?.trim() || '미입력'} />
        <SummaryRow label="급여 방식" ready={!errors.salary_type} value={SALARY_TYPE_LABELS[formData.salary_type]} />
        <SummaryRow
          label="강사 유형"
          ready={Boolean(formData.instructor_type)}
          value={formData.instructor_type ? INSTRUCTOR_TYPE_LABELS[formData.instructor_type] : '미선택'}
        />

        {workScheduleRequired ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">출근 요일</p>
                <p className="mt-1 break-words text-sm font-semibold text-foreground">{workDaysLabel}</p>
              </div>
            </div>
          </div>
        ) : null}

        {hasSubmitError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100">
            저장에 실패했습니다. 입력값을 유지한 상태에서 다시 시도할 수 있습니다.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
