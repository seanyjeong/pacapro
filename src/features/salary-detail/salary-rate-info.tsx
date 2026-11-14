import { SectionCard } from '@/components/ui/page';
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
    <SectionCard title="단가 정보" className="print-section" bodyClassName="print-compact">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {salaryType === 'hourly' && hourlyRate > 0 ? <Rate label="시급" value={`${formatCurrency(hourlyRate)}/시간`} /> : null}
        {salaryType === 'per_class' && morningRate > 0 ? <Rate label="오전" value={`${formatCurrency(morningRate)}/회`} /> : null}
        {salaryType === 'per_class' && afternoonRate > 0 ? <Rate label="오후" value={`${formatCurrency(afternoonRate)}/회`} /> : null}
        {salaryType === 'per_class' && eveningRate > 0 ? <Rate label="저녁" value={`${formatCurrency(eveningRate)}/회`} /> : null}
        {salaryType === 'per_class' && morningRate + afternoonRate + eveningRate === 0 && hourlyRate > 0 ? (
          <Rate label="수업당" value={`${formatCurrency(hourlyRate)}/회`} />
        ) : null}
      </div>
    </SectionCard>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted px-4 py-3">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
