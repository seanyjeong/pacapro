import type { SalaryDetailWithRates } from './salary-detail-types';

interface SalaryPaidInfoProps {
  salary: SalaryDetailWithRates;
}

export function SalaryPaidInfo({ salary }: SalaryPaidInfoProps) {
  if (salary.payment_status !== 'paid' || !salary.payment_date) return null;

  return (
    <section className="print-section rounded-lg border border-success/30 bg-success-soft p-4 print-compact">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-success">지급 완료</span>
        <span className="font-semibold text-success">{new Date(salary.payment_date).toLocaleDateString('ko-KR')}</span>
      </div>
    </section>
  );
}
