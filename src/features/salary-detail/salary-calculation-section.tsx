import { Edit3, Save, X } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
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
    <section className="print-section overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 bg-emerald-50 p-3 print-compact">
        <h2 className="text-sm font-semibold text-emerald-900">급여 계산</h2>
      </div>
      <div className="space-y-2 p-4 text-sm print-compact">
        <Formula salary={salary} attendanceSummary={attendanceSummary} />
        <Line label="기본급" value={formatCurrency(salary.base_amount)} />
        <div className="flex items-center justify-between border-b border-border/70 py-2">
          <span className="text-muted-foreground">인센티브</span>
          {editingIncentive ? (
            <div className="flex items-center gap-2">
              <label htmlFor="salary-incentive-amount" className="sr-only">
                인센티브 금액
              </label>
              <MoneyInput
                id="salary-incentive-amount"
                value={incentiveInput}
                onChange={onIncentiveChange}
                className="w-32 py-1 text-sm"
              />
              <button
                type="button"
                aria-label="인센티브 저장"
                onClick={onSave}
                disabled={savingIncentive}
                className="rounded p-1 text-green-600 hover:bg-green-50"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="인센티브 수정 취소"
                onClick={onCancelEdit}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`font-medium ${salary.incentive_amount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                {salary.incentive_amount > 0 ? `+${formatCurrency(salary.incentive_amount)}` : '0원'}
              </span>
              {salary.payment_status === 'pending' ? (
                <button
                  type="button"
                  aria-label="인센티브 수정"
                  onClick={onStartEdit}
                  className="rounded p-1 text-muted-foreground hover:bg-muted no-print"
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
        <div className="mt-3 flex justify-between rounded-md bg-blue-50 px-3 py-3">
          <span className="font-semibold text-foreground">실수령액</span>
          <span className="text-xl font-bold text-blue-700">{formatCurrency(salary.net_salary)}</span>
        </div>
      </div>
    </section>
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
      return <div className="space-y-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{rows.map((row) => <p key={row}>{row}</p>)}</div>;
    }
  }

  if (salary.salary_type === 'hourly' && hourlyRate > 0) {
    return (
      <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        시급 {formatCurrency(hourlyRate)} x {attendanceSummary.total_hours}시간 = {formatCurrency(hourlyRate * attendanceSummary.total_hours)}
      </div>
    );
  }
  return null;
}

function Line({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border/70 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${danger ? 'text-red-600' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function InsuranceDetails({ details, total }: { details: Record<string, number>; total: number }) {
  return (
    <div className="border-b border-border/70 py-2">
      <div className="mb-2 flex justify-between">
        <span className="font-medium text-muted-foreground">4대보험 공제</span>
        <span className="font-medium text-red-600">-{formatCurrency(total)}</span>
      </div>
      <div className="space-y-1 rounded-md bg-red-50 p-2 text-sm">
        {INSURANCE_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-red-600">{formatCurrency(details[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
