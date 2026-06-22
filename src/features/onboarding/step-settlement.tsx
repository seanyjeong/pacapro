import { CalendarDays, CreditCard } from 'lucide-react';
import { PAYMENT_DAYS, TUITION_DUE_DAYS } from './onboarding-constants';
import type { OnboardingFormData, SalaryMonthType, UpdateOnboardingField } from './onboarding-types';

interface StepSettlementProps {
  formData: OnboardingFormData;
  updateFormData: UpdateOnboardingField;
}

const MONTH_OPTIONS: Array<{ id: SalaryMonthType; label: string; helper: string }> = [
  { id: 'current', label: '당월 정산', helper: '11월 근무분을 11월에 지급' },
  { id: 'next', label: '익월 정산', helper: '11월 근무분을 12월에 지급' },
];

export function StepSettlement({ formData, updateFormData }: StepSettlementProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
      <section className="rounded-md border border-border bg-background p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">급여 지급일</h3>
            <p className="text-sm text-muted-foreground">강사 급여 정산 기준일입니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_DAYS.map((day) => (
            <button
              key={day}
              aria-pressed={formData.salary_payment_day === day}
              className={[
                'h-10 rounded-md border px-4 text-sm font-medium transition',
                formData.salary_payment_day === day
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              ].join(' ')}
              type="button"
              onClick={() => updateFormData('salary_payment_day', day)}
            >
              {day === 0 ? '말일' : `${day}일`}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-sky-700">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">학원비 납부일</h3>
            <p className="text-sm text-muted-foreground">월별 청구 기본 기준입니다.</p>
          </div>
        </div>
        <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="tuition-due-day">
          학원비 기본 납부일
        </label>
        <select
          id="tuition-due-day"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30"
          value={formData.tuition_due_day}
          onChange={(event) => updateFormData('tuition_due_day', Number(event.target.value))}
        >
          {TUITION_DUE_DAYS.map((day) => (
            <option key={day} value={day}>
              매월 {day}일
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-md border border-border bg-background p-4 xl:col-span-2">
        <h3 className="mb-3 text-base font-semibold text-foreground">정산 방식</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MONTH_OPTIONS.map((option) => (
            <button
              key={option.id}
              aria-pressed={formData.salary_month_type === option.id}
              className={[
                'rounded-md border p-4 text-left transition',
                formData.salary_month_type === option.id
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-border bg-card hover:bg-muted',
              ].join(' ')}
              type="button"
              onClick={() => updateFormData('salary_month_type', option.id)}
            >
              <span className="block text-sm font-semibold text-foreground">{option.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{option.helper}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
