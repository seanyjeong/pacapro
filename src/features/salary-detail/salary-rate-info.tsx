import type { SalaryDetailWithRates } from './salary-detail-types';
import { formatCurrency, toNumber } from './salary-detail-utils';

interface SalaryRateInfoProps {
  salary: SalaryDetailWithRates;
}

export function SalaryRateInfo({ salary }: SalaryRateInfoProps) {
  const salaryType = salary.salary_type;
  const hourlyRate = toNumber(salary.hourly_rate);
  const morningRate = toNumber(salary.morning_class_rate);
  const afternoonRate = toNumber(salary.afternoon_class_rate);
  const eveningRate = toNumber(salary.evening_class_rate);

  if (salaryType !== 'per_class' && salaryType !== 'hourly') return null;

  return (
    <section className="print-section rounded-lg border border-border/70 bg-muted/30 p-4 print-compact">
      <h2 className="mb-3 text-sm font-semibold text-foreground">단가 정보</h2>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {salaryType === 'hourly' && hourlyRate > 0 ? <Rate label="시급" value={`${formatCurrency(hourlyRate)}/시간`} /> : null}
        {salaryType === 'per_class' && morningRate > 0 ? <Rate label="오전" value={`${formatCurrency(morningRate)}/회`} /> : null}
        {salaryType === 'per_class' && afternoonRate > 0 ? <Rate label="오후" value={`${formatCurrency(afternoonRate)}/회`} /> : null}
        {salaryType === 'per_class' && eveningRate > 0 ? <Rate label="저녁" value={`${formatCurrency(eveningRate)}/회`} /> : null}
        {salaryType === 'per_class' && morningRate + afternoonRate + eveningRate === 0 && hourlyRate > 0 ? (
          <Rate label="수업당" value={`${formatCurrency(hourlyRate)}/회`} />
        ) : null}
      </div>
    </section>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-semibold text-foreground">{value}</span>
    </div>
  );
}
