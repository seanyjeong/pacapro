import { PAYMENT_STATUS_LABELS } from '@/lib/types/salary';
import type { AttendanceSummary, SalaryDetailWithRates } from './salary-detail-types';
import { getSalaryTypeLabel } from './salary-detail-utils';

interface SalaryBasicInfoProps {
  salary: SalaryDetailWithRates;
  attendanceSummary: AttendanceSummary | null;
}

export function SalaryBasicInfo({ salary, attendanceSummary }: SalaryBasicInfoProps) {
  return (
    <>
      <div className="hidden print:block border-b-2 border-gray-800 pb-3 text-center">
        <h1 className="text-xl font-bold">급 여 명 세 서</h1>
        <p className="text-sm text-gray-600">{salary.year_month} ({attendanceSummary?.work_year_month} 근무분)</p>
      </div>
      <section className="print-section rounded-lg border border-border/70 bg-card p-4 print-compact">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Info label="강사명" value={salary.instructor_name} />
          <Info label="급여유형" value={getSalaryTypeLabel(salary)} />
          <Info label="급여월" value={salary.year_month} />
          <Info label="상태" value={PAYMENT_STATUS_LABELS[salary.payment_status]} />
        </div>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-semibold text-foreground">{value}</span>
    </div>
  );
}
