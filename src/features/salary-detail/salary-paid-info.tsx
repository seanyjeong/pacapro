import type { SalaryDetailWithRates } from './salary-detail-types';

interface SalaryPaidInfoProps {
  salary: SalaryDetailWithRates;
}

export function SalaryPaidInfo({ salary }: SalaryPaidInfoProps) {
  if (salary.payment_status !== 'paid' || !salary.payment_date) return null;

  return (
    <section className="print-section rounded-lg border border-green-200 bg-green-50 p-4 print-compact">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-green-700">지급 완료</span>
        <span className="font-semibold text-green-900">{new Date(salary.payment_date).toLocaleDateString('ko-KR')}</span>
      </div>
    </section>
  );
}
