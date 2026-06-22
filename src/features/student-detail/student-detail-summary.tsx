import { Banknote, CalendarDays, GraduationCap, ReceiptText } from 'lucide-react';
import { ADMISSION_TYPE_LABELS, type StudentDetail, type StudentPayment } from '@/lib/types/student';
import { getEffectiveMonthlyTuition } from '@/lib/utils/student-helpers';
import { getClassSummary, getOutstandingAmount, formatWon } from './student-detail-utils';

interface StudentDetailSummaryProps {
  payments: StudentPayment[];
  student: StudentDetail;
}

export function StudentDetailSummary({ payments, student }: StudentDetailSummaryProps) {
  const outstanding = getOutstandingAmount(payments);
  const effectiveTuition = getEffectiveMonthlyTuition(student);
  const items = [
    { label: '수업', value: getClassSummary(student), icon: CalendarDays, tone: 'bg-slate-50 text-slate-700' },
    { label: '실납부', value: formatWon(effectiveTuition), icon: Banknote, tone: 'bg-emerald-50 text-emerald-700' },
    { label: '미납', value: formatWon(outstanding), icon: ReceiptText, tone: outstanding > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-700' },
    { label: '입시 유형', value: ADMISSION_TYPE_LABELS[student.admission_type], icon: GraduationCap, tone: 'bg-sky-50 text-sky-700' },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <section key={item.label} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-1 truncate text-base font-semibold text-foreground">{item.value}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${item.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
