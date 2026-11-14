import { Edit3, Save, X } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { SectionCard } from '@/components/ui/page';
import { TAX_TYPE_LABELS } from '@/lib/types/salary';
import type { AttendanceSummary, SalaryDetailWithRates } from './salary-detail-types';
import { formatCurrency, parseInsuranceDetails, toNumber } from './salary-detail-utils';

const CLASS_RATE_FIELDS = [
  { label: '오전', rateKey: 'morning_class_rate', countKey: 'morning_classes' },
  { label: '오후', rateKey: 'afternoon_class_rate', countKey: 'afternoon_classes' },
  { label: '저녁', rateKey: 'evening_class_rate', countKey: 'evening_classes' },
] as const;

const INSURANCE_FIELDS = [
  { key: 'nationalPension', label: '국민연금' },
  { key: 'healthInsurance', label: '건강보험' },
  { key: 'longTermCare', label: '장기요양보험' },
  { key: 'employmentInsurance', label: '고용보험' },
] as const;

interface SalaryCalculationSectionProps {
  salary: SalaryDetailWithRates;
  attendanceSummary: AttendanceSummary | null;
  editingIncentive: boolean;
  incentiveInput: number;
  savingIncentive: boolean;
  onIncentiveChange: (value: number) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

export function SalaryCalculationSection({
  salary,
  attendanceSummary,
  editingIncentive,
  incentiveInput,
  savingIncentive,
  onIncentiveChange,
  onStartEdit,
  onCancelEdit,
  onSave,
}: SalaryCalculationSectionProps) {
  const insuranceDetails = parseInsuranceDetails(salary.insurance_details);

  return (
    <SectionCard title="급여 계산" className="print-section" bodyClassName="print-compact">
      <div className="space-y-1 text-[15px]">
        <Formula salary={salary} attendanceSummary={attendanceSummary} />
        <Line label="기본급" value={formatCurrency(salary.base_amount)} />
        <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border/60 py-2">
          <span className="text-secondary-foreground">인센티브</span>
          {editingIncentive ? (
            <div className="flex items-center gap-1.5">
              <label htmlFor="salary-incentive-amount" className="sr-only">
                인센티브 금액
              </label>
              <MoneyInput
                id="salary-incentive-amount"
                value={incentiveInput}
                onChange={onIncentiveChange}
                className="h-10 w-32 text-sm"
              />
              <button
                type="button"
                aria-label="인센티브 저장"
                onClick={onSave}
                disabled={savingIncentive}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-success hover:bg-success-soft"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="인센티브 수정 취소"
                onClick={onCancelEdit}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`font-bold tabular-nums ${salary.incentive_amount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {salary.incentive_amount > 0 ? `+${formatCurrency(salary.incentive_amount)}` : '0원'}
              </span>
              {salary.payment_status === 'pending' ? (
                <button
                  type="button"
                  aria-label="인센티브 수정"
                  onClick={onStartEdit}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted no-print"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
        </div>
        {salary.total_deduction > 0 ? <Line label="공제액" value={`-${formatCurrency(salary.total_deduction)}`} danger /> : null}
        {insuranceDetails ? (
          <InsuranceDetails details={insuranceDetails} total={salary.tax_amount} />
        ) : (
          <Line label={`세금 (${TAX_TYPE_LABELS[salary.tax_type] || salary.tax_type})`} value={`-${formatCurrency(salary.tax_amount)}`} danger />
        )}
        <div className="!mt-4 flex items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-4">
          <span className="font-bold text-foreground">실수령액</span>
          <span className="text-[24px] font-extrabold tabular-nums tracking-tight text-primary">{formatCurrency(salary.net_salary)}</span>
        </div>
      </div>
    </SectionCard>
  );
}

function Formula({ salary, attendanceSummary }: { salary: SalaryDetailWithRates; attendanceSummary: AttendanceSummary | null }) {
  if (!attendanceSummary) return null;
  const hourlyRate = toNumber(salary.hourly_rate);

  if (salary.salary_type === 'per_class') {
    const rows = CLASS_RATE_FIELDS.flatMap(({ label, rateKey, countKey }) => {
      const rate = toNumber(salary[rateKey]);
      const count = attendanceSummary[countKey];
      if (rate <= 0 || count <= 0) return [];
      return [`${label}: ${formatCurrency(rate)} x ${count}회 = ${formatCurrency(rate * count)}`];
    });

    if (rows.length === 0 && hourlyRate > 0 && attendanceSummary.total_classes > 0) {
      rows.push(`수업료 ${formatCurrency(hourlyRate)} x ${attendanceSummary.total_classes}회 = ${formatCurrency(hourlyRate * attendanceSummary.total_classes)}`);
    }

    if (rows.length > 0) {
      return <div className="mb-2 space-y-1 rounded-xl bg-muted px-4 py-3 text-[13px] tabular-nums text-secondary-foreground">{rows.map((row) => <p key={row}>{row}</p>)}</div>;
    }
  }

  if (salary.salary_type === 'hourly' && hourlyRate > 0) {
    return (
      <div className="mb-2 rounded-xl bg-muted px-4 py-3 text-[13px] tabular-nums text-secondary-foreground">
        시급 {formatCurrency(hourlyRate)} x {attendanceSummary.total_hours}시간 = {formatCurrency(hourlyRate * attendanceSummary.total_hours)}
      </div>
    );
  }
  return null;
}

function Line({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border/60 py-2">
      <span className="text-secondary-foreground">{label}</span>
      <span className={`font-bold tabular-nums ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function InsuranceDetails({ details, total }: { details: Record<string, number>; total: number }) {
  return (
    <div className="border-b border-border/60 py-3">
      <div className="mb-2 flex justify-between gap-3">
        <span className="text-secondary-foreground">4대보험 공제</span>
        <span className="font-bold tabular-nums text-destructive">-{formatCurrency(total)}</span>
      </div>
      <div className="space-y-1 rounded-xl bg-destructive-soft px-4 py-3 text-sm">
        {INSURANCE_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex justify-between gap-3">
            <span className="text-secondary-foreground">{label}</span>
            <span className="font-semibold tabular-nums text-destructive">{formatCurrency(details[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
