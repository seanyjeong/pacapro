import { CheckCircle } from 'lucide-react';
import type { SalaryDetailWithRates } from './salary-detail-types';

interface SalaryPaidInfoProps {
  salary: SalaryDetailWithRates;
}

export function SalaryPaidInfo({ salary }: SalaryPaidInfoProps) {
  if (salary.payment_status !== 'paid' || !salary.payment_date) return null;

  return (
    <section className="print-section rounded-2xl bg-success-soft px-5 py-4 print-compact sm:px-6">
      <div className="flex items-center justify-between gap-3 text-[15px] text-success">
        <span className="flex items-center gap-2 font-semibold">
          <CheckCircle className="h-5 w-5" />
          지급 완료
        </span>
        <span className="font-bold tabular-nums">{new Date(salary.payment_date).toLocaleDateString('ko-KR')}</span>
      </div>
    </section>
  );
}
