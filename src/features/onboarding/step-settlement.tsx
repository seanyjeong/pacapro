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
    <div className="space-y-6">
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-soft text-warning">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">급여 지급일</h3>
            <p className="text-sm text-muted-foreground">강사 급여 정산 기준일이에요.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_DAYS.map((day) => (
            <button
              key={day}
              aria-pressed={formData.salary_payment_day === day}
              className={[
                'h-11 rounded-xl px-4 text-[15px] font-semibold tabular-nums transition-colors',
                formData.salary_payment_day === day
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-primary-soft hover:text-primary',
              ].join(' ')}
              type="button"
              onClick={() => updateFormData('salary_payment_day', day)}
            >
              {day === 0 ? '말일' : `${day}일`}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">학원비 납부일</h3>
            <p className="text-sm text-muted-foreground">월별 청구 기본 기준이에요.</p>
          </div>
        </div>
        <label className="mb-1.5 block text-sm font-semibold text-secondary-foreground" htmlFor="tuition-due-day">
          학원비 기본 납부일
        </label>
        <select
          id="tuition-due-day"
          className="h-12 w-full rounded-xl border border-transparent bg-muted px-4 text-[15px] text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
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

      <section>
        <h3 className="mb-3 text-base font-bold text-foreground">정산 방식</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MONTH_OPTIONS.map((option) => (
            <button
              key={option.id}
              aria-pressed={formData.salary_month_type === option.id}
              className={[
                'rounded-xl border-2 p-4 text-left transition-colors',
                formData.salary_month_type === option.id
                  ? 'border-primary bg-primary-soft'
                  : 'border-transparent bg-muted hover:bg-primary-soft/60',
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
