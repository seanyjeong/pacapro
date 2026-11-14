import { Badge } from '@/components/ui/badge';
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
      <div className="hidden print:block border-b-2 border-muted-foreground/40 pb-3 text-center">
        <h1 className="text-xl font-bold">급 여 명 세 서</h1>
        <p className="text-sm text-secondary-foreground">{salary.year_month} ({attendanceSummary?.work_year_month} 근무분)</p>
      </div>
      <section className="print-section rounded-2xl bg-card p-5 sm:p-6 print-compact" aria-label="급여 기본 정보">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Info label="강사명" value={salary.instructor_name} />
          <Info label="급여유형" value={getSalaryTypeLabel(salary)} />
          <Info label="급여월" value={salary.year_month} />
          <div className="min-w-0 rounded-xl bg-muted px-4 py-3">
            <p className="text-[13px] font-medium text-muted-foreground">상태</p>
            <Badge className="mt-1" variant={salary.payment_status === 'paid' ? 'success' : 'warning'}>
              {PAYMENT_STATUS_LABELS[salary.payment_status]}
            </Badge>
          </div>
        </div>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted px-4 py-3">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-bold text-foreground">{value}</p>
    </div>
  );
}
